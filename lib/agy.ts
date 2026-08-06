import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Plan, type Doctor, type Store } from "./types";
import { normalizeName } from "./domain";
const run = promisify(execFile);
const AGY_BIN = process.env.AGY_BIN || "/home/porti/.local/bin/agy";
const AGY_TIMEOUT = Number(process.env.AGY_TIMEOUT_MS || 30_000);
function informationalMarkdown(value:string){
  if (!/<enfermeros?\b/i.test(value)) return value;
  const rows=[...value.matchAll(/<enfermero>([\s\S]*?)<\/enfermero>/gi)].map(match=>{
    const block=match[1];
    const read=(tag:string)=>block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`,`i`))?.[1]?.trim()||"—";
    return `| ${read("nombre")} | ${read("alias")} | ${read("piso")} |`;
  });
  if (!rows.length) return value.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
  return `### Enfermeras\n\n| Nombre | Alias | Piso |\n|---|---|---|\n${rows.join("\n")}`;
}
function hideInternalIds(value:string){
  return value
    .replace(/\s*\((?:id|identificador)\s*:\s*[a-f0-9]{8}-[a-f0-9-]{27,}\)/gi, "")
    .replace(/\s*\[(?:id|identificador)\s*:\s*[a-f0-9]{8}-[a-f0-9-]{27,}\]/gi, "")
    .replace(/\s+(?:id|identificador)\s*:\s*[a-f0-9]{8}-[a-f0-9-]{27,}/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
function doctorDischargeReason(message:string){
  const match=message.match(/(?:porque|por motivo de|motivo(?: del alta)?|causa(?: del alta)?)[\s:]+(.+)/i);
  return match?.[1]?.trim()||"";
}
function sanitizeDischargeReasons(operations:unknown[],message:string){
  const reason=doctorDischargeReason(message);
  return operations.map((op:any)=>op.action==="discharge_patient" ? {...op,reason:reason||undefined} : op);
}
function parseAgyOutput(stdout:string){
  const raw=stdout.trim().replace(/^```(?:json)?\s*/i,"").replace(/```\s*$/i,"").trim();
  try{return JSON.parse(raw) as Record<string,unknown>}catch{
    const start=raw.indexOf("{");const end=raw.lastIndexOf("}");
    if(start>=0&&end>start)return JSON.parse(raw.slice(start,end+1)) as Record<string,unknown>;
    throw new Error("agy_invalid_json");
  }
}
function normalizeAgyData(data:Record<string,unknown>){
  if (data.missing == null) delete data.missing;
  if (data.operations == null) data.operations=[];
  if (data.message == null) data.message="";
  return data;
}
const SYSTEM = 'Eres el asistente de guardia de RXList. Entiende lenguaje natural en español, incluidos errores ortográficos y fechas como 30 de noviembre del 2004, y devuelve SOLO JSON válido con type, intent, message, missing y operations. Las operaciones permitidas son update_floor, create_nurse, create_patient, assign_patient, move_patient, discharge_patient, create_shift, create_medication y create_task. Usa solo ids y datos del contexto; no inventes pacientes, enfermeras, camas ni pisos. Nunca ejecutes acciones: el servidor validará la propuesta y el doctor debe aceptarla. Para consultas informativas, responde en español usando Markdown legible (listas o tablas) y NUNCA XML, HTML ni etiquetas técnicas. Nunca muestres IDs, UUIDs ni identificadores internos en message; el doctor solo necesita nombres, pisos, camas y estados. REGLA DE REPORTES: si el doctor pide generar, crear, preparar o hacer un reporte o informe de un paciente, responde con una ficha completa y formal usando todos los datos disponibles de ese paciente: nombre, fecha de nacimiento, piso/servicio, estado, motivo de ingreso, alergias, contacto de emergencia, notas, signos vitales históricos, medicación activa y tareas pendientes. Empieza indicando que el informe está listo para revisar e imprimir. No inventes datos faltantes y no conviertas la respuesta en una operación clínica. REGLA DE AMBIGÜEDAD: si el doctor dice solo "agrega a [nombre]", "registra a [nombre]" o "crea a [nombre]" sin indicar paciente/enfermero y sin aportar datos que resuelvan el tipo, NO elijas paciente por defecto. Devuelve clarification y pregunta exactamente si desea agregarlo como paciente o como enfermero. No pidas fecha de nacimiento hasta que confirme que es paciente. REGLA DE CORRECCIÓN PRIORITARIA: si el doctor dice "como enfermero", "como enfermera", "de enfermero" o "de enfermera", está corrigiendo la solicitud para crear personal; debes usar create_nurse y nunca create_patient, aunque el mismo nombre exista como paciente. Usa el nombre completo que aparezca en el historial y pide únicamente los datos que falten para el alta de enfermera. REGLA DE PACIENTES: si el paciente ya aparece en PACIENTES, cualquier frase como "ponlo", "asígnalo", "muévelo", "cámbialo de piso" o "llévalo a" significa asignar o trasladar a ese paciente existente; debes usar assign_patient o move_patient con su patientId exacto y NUNCA create_patient. Solo usa create_patient cuando el paciente no exista en PACIENTES. Un paciente nuevo requiere datos del paciente, causa de ingreso, alergias, contacto de emergencia con nombre y teléfono y piso; la cama es opcional: si no se indica, devuelve la propuesta sin cama y el servidor asignará automáticamente la primera cama libre del piso. Convierte fechas escritas en español a YYYY-MM-DD. Mapea urgencias/emergencias a piso 4, pediatría a piso 2, cirugía a piso 3 y medicina interna a piso 1. Para create_medication, acepta frases como "cada 8 horas", "por 12 horas" o "tres veces al día": guarda la frecuencia en frequency; si el doctor da horarios explícitos, usa times como HH:mm. No recomiendes tratamientos ni dosis. Las tareas generales de enfermería se registran con create_task y requieren patientId, title, scheduledAt en formato YYYY-MM-DDTHH:mm:ss; no inventes tratamientos. Los turnos son day 06:00-18:00 y night 18:00-06:00. Si faltan datos usa clarification y missing. Las solicitudes peligrosas deben ser rejected.';
const BED_RULE = "REGLA DE CAMAS DESACTIVADAS: no muestres, menciones ni asignes números de cama. No generes operaciones para asignar camas. Si el doctor pide una cama, responde que el sistema trabaja con cantidad de pacientes y cola operativa, y ofrece registrar la tarea en la cola. Para trasladar un paciente usa únicamente el piso destino.";
const INFORMATION_TABLE_RULE = "FORMATO DE CONSULTAS: cuando el doctor pida información, decide el formato más claro. Usa una tabla Markdown sólo cuando ayude a ordenar varios elementos, comparar datos o mostrar una lista de estado/disponibilidad; no conviertas todas las respuestas en tablas. Para una explicación, una sola entidad o una respuesta breve, usa texto normal o una lista corta. Si usas tabla, incluye encabezados claros, una fila por elemento y no muestres IDs internos, HTML ni XML. Nunca muestres números de cama ni capacidad de camas: usa únicamente cantidad de pacientes, piso/servicio y cola de tareas. Si preguntan por signos vitales, presión arterial, temperatura, frecuencia cardiaca, frecuencia respiratoria o saturación, usa los registros históricos del contexto y no digas que no existen si sí aparecen. REGLA DE LISTADOS COMPLETOS: si el doctor pide 'todos los pacientes', 'una tabla con todos', 'qué pacientes tenemos', 'del hospital completo' o una consulta equivalente, debes devolver una tabla Markdown con una fila por cada paciente que aparece en PACIENTES, sin resumir, omitir filas ni responder solo con una introducción. Usa las columnas Piso, Paciente y Motivo de ingreso. REGLA DE OCUPACIÓN: informa únicamente la cantidad de pacientes por piso y el total; no muestres camas ocupadas, camas libres, capacidad ni porcentajes. REGLA DE SEGUIMIENTO: si el último mensaje dice 'dame toda la información', 'dame toda la información que tengas', 'información completa' o una frase equivalente y en el historial inmediato se acaba de mencionar un paciente concreto, interpreta la solicitud como una ficha completa de ese paciente. Devuelve nombre, fecha de nacimiento, piso/servicio, estado, motivo de ingreso, alergias, contacto de emergencia, notas, signos vitales históricos, medicación activa y tareas pendientes. No la conviertas en un reporte de ocupación y no hables de camas salvo que el doctor las pida explícitamente (en ese caso recuerda que las camas están desactivadas).";
const MESSAGING_RULE = "REGLA DE MENSAJERÍA: si el doctor pide enviar, mandar o dejar un mensaje a una enfermera o a las enfermeras de un piso, devuelve type:'proposal', intent:'send_message' y una operación send_message con body, floor cuando aplique y recipientIds usando exactamente los userId de ENFERMERAS DISPONIBLES. Si pide un piso, incluye todos los userId de enfermeras de ese piso. Nunca afirmes que el mensaje fue enviado antes de que el doctor pulse Aceptar y aplicar; antes de eso escribe 'Se propone enviar...'. REGLA DE MENSAJES CLÍNICOS COMPLETOS: si el mensaje trata sobre mover, cambiar de piso, trasladar o preparar la recepción de un paciente, el body debe ser profesional y completo: incluye el nombre completo del paciente, piso/servicio actual según PACIENTES, piso/servicio destino solicitado, motivo de ingreso si está disponible y una instrucción clara a enfermería para preparar la recepción y confirmar cualquier pendiente. No escribas mensajes vagos como 'se va a cambiar'; redacta, por ejemplo: 'Mariana, prepara la recepción de Jessica Montesinos para su traslado al piso 3 (Cirugía). Actualmente figura en el piso 2. Motivo de ingreso: bronquitis. Confirma cuando esté preparada la recepción.' Si el paciente ya aparece en el piso destino, dilo claramente y solicita confirmar si se trata de una recepción ya realizada o de un nuevo traslado; no inventes un piso actual.";

export function buildAgyPrompt(message: string, doctor: Doctor, context?: Pick<Store,"floors"|"patients"|"shifts"|"medications"|"tasks"|"vitals">) {
  // El modelo no necesita conocer camas ni capacidad para responder consultas.
  // Mantener esos campos fuera del prompt evita que reaparezcan aunque el
  // doctor pregunte de forma ambigua por la información de un paciente.
  const publicFloors = (context?.floors || []).map(({ beds: _beds, ...floor }) => floor);
  const publicPatients = (context?.patients || []).map(({ bed: _bed, ...patient }) => patient);
  const authoritative = (context?.floors || []).map(floor => {
    const patients = (context?.patients || []).filter(patient => patient.status !== "discharged" && patient.floor === floor.id);
    return `PISO ${floor.id} — ${floor.name}: ${patients.length} pacientes ingresados. ${patients.map(patient => `${patient.fullName} (motivo: ${patient.reason})`).join("; ") || "Ninguno."}`;
  }).join("\n");
  message = `${BED_RULE}\n${MESSAGING_RULE}\nREGLA DE DATOS: el siguiente resumen es la fuente operativa. Nunca digas que un piso está vacío si aquí aparecen pacientes.\n${authoritative}\n${message}`;
  const operational = `${INFORMATION_TABLE_RULE}\nREGLA OPERATIVA VIGENTE: los turnos day son 05:00-17:00 y los turnos night son 17:00-05:00. Usa siempre esos horarios. REGLA DE INGRESO: registrar un paciente significa que ya llegó al hospital; el mínimo obligatorio es datos del paciente, causa de ingreso, alergias, contacto de emergencia y piso. La cama es opcional porque el servidor asignará automáticamente una cama libre. El contacto de emergencia requiere nombre y teléfono. Para dar de alta a un paciente requiere la causa de salida.\n`;
  const roster = doctor.nurses.map(n => ({ id: n.id, userId: n.userId ?? null, name: n.name, alias: n.alias ?? null, floor: n.floor }));
  const proposalLanguageRule = "REGLA DE PROPUESTAS: type proposal significa que todavía no se ha aplicado nada. En message usa 'Se propone...' y nunca digas 'se ha registrado', 'ya se registró' ni que una acción terminó. El servidor asigna la cama y el doctor debe aceptar antes de guardar.";
  message = `${message}\nSIGNOS VITALES HISTÓRICOS:\n${JSON.stringify(context?.vitals || [])}`;
  return `${SYSTEM}\n\n${proposalLanguageRule}\n\nREGLA DE EXTRACCIÓN PARA FORMULARIO: si el doctor indica explícitamente que desea agregar o registrar un PACIENTE pero faltan datos, devuelve type:"clarification", intent:"create_patient" y una operación create_patient parcial que contenga únicamente los campos que sí aparecen en el mensaje o historial. Nunca inventes valores. Usa missing para los campos faltantes. Esta operación parcial se usará para llenar automáticamente un formulario; los campos ausentes deben quedar vacíos. Si el doctor no especifica paciente o enfermero, no generes operación y pregunta cuál desea agregar.\n\nREGLA DE ALTA DE ENFERMERA: una enfermera nueva requiere nombre completo y fecha de nacimiento. El piso es opcional si no se indicó. No generes create_nurse sin esos dos datos.\n\nENFERMERAS DISPONIBLES:\n${JSON.stringify(roster)}\n\nPISOS: ${JSON.stringify(publicFloors.length ? publicFloors : [{id:1,name:"Medicina interna"},{id:2,name:"Pediatría"},{id:3,name:"Cirugía"},{id:4,name:"Urgencias"}])}\nPACIENTES:\n${JSON.stringify(publicPatients)}\nTURNOS:\n${JSON.stringify(context?.shifts || [])}\nMEDICAMENTOS Y TAREAS:\n${JSON.stringify({medications:context?.medications || [],tasks:context?.tasks || []})}\nMENSAJE DEL DOCTOR:\n${operational}${message}`;
}
export async function proposeWithAgy(message: string, doctor: Doctor, context?: Pick<Store,"floors"|"patients"|"shifts"|"medications"|"tasks"|"vitals">) {
  message = "REGLA OPERATIVA VIGENTE: los turnos day son 05:00-17:00 y los turnos night son 17:00-05:00. Usa siempre esos horarios. REGLA DE INGRESO: registrar un paciente significa que ya llegó al hospital; el mínimo obligatorio es datos del paciente, causa de ingreso, alergias, contacto de emergencia y piso. La cama es opcional porque el servidor asignará automáticamente una cama libre. El contacto de emergencia requiere nombre y teléfono. Para dar de alta a un paciente requiere la causa de salida.\n" + message;
  const roster = doctor.nurses.map(n => ({ id: n.id, name: n.name, alias: n.alias ?? null, floor: n.floor }));
  const prompt = buildAgyPrompt(`${BED_RULE}\n${message.replace(/^REGLA OPERATIVA VIGENTE:[\s\S]*?causa de salida\.\n/, "")}`, doctor, context);
  try {
    const result = await run(AGY_BIN, ["--model", process.env.AGY_MODEL || "Gemini 3.5 Flash (Low)", "--print", prompt], { cwd: "/tmp", timeout: AGY_TIMEOUT, maxBuffer: 128 * 1024 });
    let data:Record<string,unknown>;
    try { data=normalizeAgyData(parseAgyOutput(result.stdout)); } catch {
      const retry=await run(AGY_BIN,["--model",process.env.AGY_MODEL||"Gemini 3.5 Flash (Low)","--print",prompt+"\nRESPUESTA INVÁLIDA. Devuelve únicamente un objeto JSON válido, sin introducción, sin explicación, sin Markdown y sin bloques de código. Respeta exactamente type, message, missing e operations."],{cwd:"/tmp",timeout:AGY_TIMEOUT,maxBuffer:128*1024});
      data=normalizeAgyData(parseAgyOutput(retry.stdout));
    }
    if (typeof data.message === "string") data.message = hideInternalIds(informationalMarkdown(data.message));
    const intentAliases:Record<string,string> = { create_and_assign_patient:"create_patient", assign_and_create_patient:"create_patient", move_nurse:"update_floor", move_nurse_floor:"update_floor", assign_and_move_patient:"move_patient" };
    if (typeof data.action === "string" && intentAliases[data.action]) data.action = intentAliases[data.action];
    if (typeof data.intent === "string" && intentAliases[data.intent]) data.intent = intentAliases[data.intent];
    // AGY puede devolver el formato legado { action, ...datos }.
    // Normalízalo antes de decidir si es alta o traslado para no perder contexto.
    if (typeof data.action === "string" && !Array.isArray(data.operations)) {
      const { action, ...fields } = data;
      data.operations = [{ action, ...fields }];
      data.type = data.type || "proposal";
    }
    const moveLanguage = /\b(pon(?:lo|la|los|las)?|asign(?:a|alo|ala|arlo|arla)?|muev(?:e|elo|ela|erlo|erla)?|cambi(?:a|alo|ala)?\s+de\s+piso|ll[eé]valo)\b/i.test(message);
    const nurseLanguage = /\b(como|de|para)\s+(?:un[ao]?\s+)?enfermer[oa]\b/i.test(message);
    const latestMessage = message.match(/<ULTIMO_MENSAJE_DEL_DOCTOR>\s*([\s\S]*?)\s*<\/ULTIMO_MENSAJE_DEL_DOCTOR>/i)?.[1] || message;
    const ambiguousAdd = /\b(agrega|añade|registra|crea)\b/i.test(latestMessage) && !/\b(paciente|enferm(?:ero|era)|doctor|médico)\b/i.test(latestMessage);
    const unassignAll = /\b(tod(?:as|os)|todas las enfermeras|todo el personal)\b[\s\S]*(sin piso|sin asignar|desasignad)/i.test(latestMessage);
    const knownPatients = context?.patients || [];
    const patientMentioned = knownPatients.some(p => message.toLocaleLowerCase().includes(p.fullName.toLocaleLowerCase()));
    const proposedCreateForKnownPatient = Array.isArray(data.operations) && (data.operations as any[]).some(op => op.action === "create_patient" && (patientMentioned || knownPatients.length === 1));
    const proposedPatientWhenNurseRequested = nurseLanguage && Array.isArray(data.operations) && (data.operations as any[]).some(op => op.action === "create_patient");
    const proposedPatientForAmbiguousAdd = ambiguousAdd && Array.isArray(data.operations) && (data.operations as any[]).some(op => op.action === "create_patient");
    const hasUnassignOperations = Array.isArray(data.operations) && (data.operations as any[]).some(op => op.action === "update_floor" && op.to === "unassigned");
    if (unassignAll && !hasUnassignOperations) {
      const retry = await run(AGY_BIN, ["--model", process.env.AGY_MODEL || "Gemini 3.5 Flash (Low)", "--print", prompt + "\nCORRECCIÓN OBLIGATORIA: 'todas las enfermeras sin piso' es una orden válida en lote. Devuelve type proposal con una operación update_floor por cada enfermera del contexto, usando su nurseId exacto, su floor actual en from y to:'unassigned'. No preguntes qué enfermera ni qué piso."], { cwd: "/tmp", timeout: AGY_TIMEOUT, maxBuffer: 128 * 1024 });
      data = normalizeAgyData(parseAgyOutput(retry.stdout));
      if (typeof data.action === "string" && intentAliases[data.action]) data.action = intentAliases[data.action];
      if (typeof data.intent === "string" && intentAliases[data.intent]) data.intent = intentAliases[data.intent];
      if (typeof data.action === "string" && !Array.isArray(data.operations)) { const { action, ...fields } = data; data.operations = [{ action, ...fields }]; data.type = data.type || "proposal"; }
    }
    if (!unassignAll && proposedPatientForAmbiguousAdd) {
      const retry = await run(AGY_BIN, ["--model", process.env.AGY_MODEL || "Gemini 3.5 Flash (Low)", "--print", prompt + "\nCORRECCIÓN OBLIGATORIA: la instrucción actual solo dice agregar/registrar a una persona y no indica si es paciente o enfermero. No elijas paciente por defecto y no generes operaciones. Devuelve clarification preguntando: ¿Quieres agregarlo como paciente o como enfermero?"], { cwd: "/tmp", timeout: AGY_TIMEOUT, maxBuffer: 128 * 1024 });
      data = normalizeAgyData(parseAgyOutput(retry.stdout));
      if (typeof data.action === "string" && intentAliases[data.action]) data.action = intentAliases[data.action];
      if (typeof data.intent === "string" && intentAliases[data.intent]) data.intent = intentAliases[data.intent];
      if (typeof data.action === "string" && !Array.isArray(data.operations)) {
        const { action, ...fields } = data;
        data.operations = [{ action, ...fields }];
        data.type = data.type || "proposal";
      }
    }
    if (!proposedPatientForAmbiguousAdd && proposedPatientWhenNurseRequested) {
      const retry = await run(AGY_BIN, ["--model", process.env.AGY_MODEL || "Gemini 3.5 Flash (Low)", "--print", prompt + "\nCORRECCIÓN OBLIGATORIA DEL DOCTOR: la frase 'no como enfermero/enfermera' corrige la solicitud. No crees ni registres un paciente. Devuelve create_nurse con el nombre completo del historial. Si falta el piso, usa clarification y pregunta solo el piso."], { cwd: "/tmp", timeout: AGY_TIMEOUT, maxBuffer: 128 * 1024 });
      data = normalizeAgyData(parseAgyOutput(retry.stdout));
      if (typeof data.action === "string" && intentAliases[data.action]) data.action = intentAliases[data.action];
      if (typeof data.intent === "string" && intentAliases[data.intent]) data.intent = intentAliases[data.intent];
      if (typeof data.action === "string" && !Array.isArray(data.operations)) {
        const { action, ...fields } = data;
        data.operations = [{ action, ...fields }];
        data.type = data.type || "proposal";
      }
    }
    if (!proposedPatientWhenNurseRequested && moveLanguage && proposedCreateForKnownPatient) {
      const retry = await run(AGY_BIN, ["--model", process.env.AGY_MODEL || "Gemini 3.5 Flash (Low)", "--print", prompt + "\nCORRECCIÓN OBLIGATORIA: el paciente ya existe en PACIENTES. No lo registres de nuevo. Interpreta la solicitud como un traslado o asignación y devuelve type proposal con move_patient o assign_patient, usando exclusivamente el patientId exacto del paciente existente y el piso destino indicado."], { cwd: "/tmp", timeout: AGY_TIMEOUT, maxBuffer: 128 * 1024 });
      data = normalizeAgyData(parseAgyOutput(retry.stdout));
      if (typeof data.action === "string" && intentAliases[data.action]) data.action = intentAliases[data.action];
      if (typeof data.intent === "string" && intentAliases[data.intent]) data.intent = intentAliases[data.intent];
      if (typeof data.action === "string" && !Array.isArray(data.operations)) {
        const { action, ...fields } = data;
        data.operations = [{ action, ...fields }];
        data.type = data.type || "proposal";
      }
    }
    if (data.intent === "create_nurse" && data.type === "clarification" && !Array.isArray(data.operations)) {
      const retry = await run(AGY_BIN, ["--model", process.env.AGY_MODEL || "Gemini 3.5 Flash (Low)", "--print", prompt + "\nREINTENTO OBLIGATORIO: el mensaje contiene nombre y piso. Devuelve type proposal y una operación create_nurse con name y floor; no pidas datos que ya están presentes."], { cwd: "/tmp", timeout: AGY_TIMEOUT, maxBuffer: 128 * 1024 });
      data = normalizeAgyData(parseAgyOutput(retry.stdout));
      if (typeof data.action === "string" && intentAliases[data.action]) data.action = intentAliases[data.action];
      if (typeof data.intent === "string" && intentAliases[data.intent]) data.intent = intentAliases[data.intent];
    }
    if (Array.isArray(data.update_floor)) {
      const legacy = data.update_floor as any[];
      data.type = "proposal";
      const moved = legacy.map((op: any) => roster.find(n => n.id === String(op.id))).filter(Boolean) as typeof roster;
      const destination = Number(legacy[0]?.floor);
      const already = roster.filter(n => n.floor === destination && !legacy.some((op: any) => String(op.id) === n.id)).map(n => n.name);
      data.message = `Se ha propuesto trasladar a ${moved.map(n => n.name).join(" y ")} al piso ${destination}.${already.length ? ` ${already.join(" y ")} ya se encuentra allí.` : ""}`;
      data.operations = legacy.map((op: any) => ({ action: "update_floor", nurseId: String(op.id), to: Number(op.floor), from: roster.find(n => n.id === String(op.id))?.floor }));
      delete data.update_floor;
    }
    if (data.operation === "create_nurse") {
      data.type = "proposal";
      data.message = `Se propone registrar a ${String(data.nurse_name || data.name || "la nueva enfermera")} en el piso ${Number(data.floor)}.`;
      data.operations = [{ action: "create_nurse", nurseId: "new", name: String(data.nurse_name || data.name || ""), alias: typeof data.alias === "string" ? data.alias : undefined, from: Number(data.floor), to: Number(data.floor), floor: Number(data.floor) }];
      delete data.operation; delete data.nurse_name;
    }
    const intentAction = ["create_nurse","update_floor","create_patient","assign_patient","move_patient","discharge_patient","create_shift","create_medication","create_task","send_message"].includes(String(data.intent)) ? String(data.intent) : undefined;
    if (Array.isArray(data.operations) && intentAction) data.operations = (data.operations as any[]).map(op => ({ ...op, action: op.action || intentAction }));
    const explicitFloor = /piso\s*(1|2|3|4)/i.test(message);
    if (Array.isArray(data.operations)) data.operations = (data.operations as any[]).map(op => {
      if (op.action === "move_nurse" || op.action === "update_floor") {
        const nurse = roster.find(n => n.id === op.nurseId || normalizeName(n.name) === normalizeName(String(op.nurseId)) || normalizeName(n.alias || "") === normalizeName(String(op.nurseId)));
        return { ...op, action: "update_floor", nurseId: nurse?.id || op.nurseId, from: nurse?.floor ?? op.from };
      }
      if (op.action === "create_nurse") return { ...op, nurseId: op.nurseId || "new", floor: explicitFloor ? (op.floor || op.to || op.from) : "unassigned", from: explicitFloor ? (op.from || op.floor || op.to) : "unassigned", to: explicitFloor ? (op.to || op.floor || op.from) : "unassigned" };
      if (op.action === "create_patient") return { ...op, patientId: op.patientId || "new", fullName: op.fullName || op.name };
      return op;
    });
    if (Array.isArray(data.operations)) {
      const created = (data.operations as any[]).find(op => op.action === "create_patient");
      const followUp = (data.operations as any[]).find(op => op.action === "assign_patient");
      if (created && followUp) {
        created.floor = created.floor || followUp.floor;
        created.bed = created.bed || followUp.bed;
        data.operations = (data.operations as any[]).filter(op => op !== followUp);
      }
    }
    if (Array.isArray(data.operations)) {
      const nurseFloors = new Map(roster.map(n => [n.id, n.floor]));
      data.operations = (data.operations as any[]).map(op => op.action === "update_floor" ? ({ ...op, from: op.from ?? nurseFloors.get(op.nurseId) }) : op);
    }
    // En conversaciones de varios turnos, AGY puede reconocer el alta pero
    // olvidar copiar el motivo que el doctor respondió en el último mensaje.
    // Conservamos ese dato para que el confirmador no tenga que volver a pedirlo.
    if (Array.isArray(data.operations)) {
      data.operations = sanitizeDischargeReasons(data.operations, latestMessage);
    }
    const incomplete = (data.operations as any[] | undefined)?.some(op =>
      (op.action === "create_patient" && (!op.fullName || !op.birthDate || !op.reason || !op.allergies || !op.emergencyContact || !op.emergencyPhone || typeof op.floor !== "number")) ||
      (op.action === "discharge_patient" && !op.reason) ||
      (op.action === "create_nurse" && (!op.name || !op.birthDate)) ||
      (op.action === "assign_patient" && (!op.patientId || !op.floor)) ||
      (op.action === "move_patient" && (!op.patientId || !op.to)) ||
      (op.action === "update_floor" && (!op.nurseId || !op.to)) ||
      (op.action === "create_medication" && (!op.patientId || !op.name || ((!Array.isArray(op.times) || !op.times.length) && !op.frequency))) ||
      (op.action === "create_task" && (!op.patientId || !op.title || !op.scheduledAt))
    );
    if (incomplete) {
      const retry = await run(AGY_BIN, ["--model", process.env.AGY_MODEL || "Gemini 3.5 Flash (Low)", "--print", prompt + "\nVALIDACIÓN OBLIGATORIA: la respuesta anterior tenía una operación incompleta. Devuelve SOLO una propuesta válida. Cada operación debe incluir action. create_patient requiere fullName, birthDate, reason, allergies, emergencyContact, emergencyPhone y floor; la cama puede omitirse porque el servidor asignará una libre; create_nurse requiere name y birthDate; assign_patient requiere patientId y floor; move_patient requiere patientId y to; update_floor requiere nurseId y to; create_medication requiere patientId, name y times explícitos o frequency como cada 8 horas; create_task requiere patientId, title y scheduledAt en formato YYYY-MM-DDTHH:mm:ss. Si falta un dato, devuelve clarification y missing en lugar de una operación vacía. No inventes valores ni recomiendes tratamientos."], { cwd: "/tmp", timeout: AGY_TIMEOUT, maxBuffer: 128 * 1024 });
      data = normalizeAgyData(parseAgyOutput(retry.stdout));
      if (typeof data.action === "string" && intentAliases[data.action]) data.action = intentAliases[data.action];
      if (typeof data.intent === "string" && intentAliases[data.intent]) data.intent = intentAliases[data.intent];
      if (typeof data.action === "string" && !Array.isArray(data.operations)) {
        const { action, ...fields } = data;
        data.operations = [{ action, ...fields }];
        data.type = data.type || "proposal";
      }
      const retryIntent = ["create_nurse","update_floor","create_patient","assign_patient","move_patient","discharge_patient","create_shift","create_medication","create_task","send_message"].includes(String(data.intent)) ? String(data.intent) : undefined;
      if (Array.isArray(data.operations) && retryIntent) data.operations = (data.operations as any[]).map(op => ({ ...op, action: op.action || retryIntent }));
      if (Array.isArray(data.operations)) data.operations = sanitizeDischargeReasons(data.operations, latestMessage);
    }
    const dischargeRequested = /\b(?:da|dar|realiza|hacer|gestiona)\s+(?:de\s+)?alta\b|\balta(?:\s+médica)?\b/i.test(latestMessage);
    const explicitDischargeReason = doctorDischargeReason(latestMessage);
    if (dischargeRequested && !explicitDischargeReason) {
      data.type = "clarification";
      data.intent = "discharge_patient";
      data.message = "¿Cuál es la causa de salida de este paciente?";
      data.missing = ["reason"];
      data.operations = [];
    }
    // Algunas respuestas compuestas de AGY crean al paciente y luego lo asignan
    // con un id provisional. La alta ya puede llevar el piso destino; evita que
    // ese segundo paso llegue al confirmador como una referencia inexistente.
    if (Array.isArray(data.operations)) {
      const created = (data.operations as any[]).find(op => op.action === "create_patient");
      const followUp = (data.operations as any[]).find(op => op.action === "assign_patient");
      if (created && followUp) {
        created.floor = created.floor || followUp.floor;
        created.bed = created.bed || followUp.bed;
        data.operations = (data.operations as any[]).filter(op => op !== followUp);
      }
    }
    if (typeof data.message === "string") data.message = hideInternalIds(informationalMarkdown(data.message));
    const validTypes = new Set(["proposal","clarification","rejected","no_change"]);
    if (!validTypes.has(String(data.type))) data.type = Array.isArray(data.operations) && data.operations.length ? "proposal" : "clarification";
    if (Array.isArray(data.operations) && data.operations.length && !["proposal","clarification","rejected","no_change"].includes(String(data.type))) data.type = "proposal";
    const validIntents = new Set(["create_nurse","move_nurse","update_floor","create_patient","assign_patient","move_patient","discharge_patient","create_shift","check_availability","create_medication","create_task","complete_task","send_message","query_floor","query_patient"]);
    if (data.intent !== undefined && !validIntents.has(String(data.intent))) delete data.intent;
    const parsed = Plan.parse(data); const operations = parsed.operations as any[];
    const allowed = new Map(doctor.nurses.map(n => [n.id, n.floor]));
    for (const op of operations) if (op.action === "update_floor" && op.from === undefined && allowed.has(op.nurseId)) op.from = allowed.get(op.nurseId);
    if (operations.some(op => op.action === "create_nurse" && (!op.name || !op.birthDate || op.name.trim().split(/\s+/).length < 2 || /como|nueva?\s+enfermer|nuevo\s+enfermer|agregar|registrar/i.test(op.name)))) return { proposal: Plan.parse({ type: "clarification", message: "Para registrar a la enfermera necesito nombre completo y fecha de nacimiento.", missing:["fullName","birthDate"], operations: [] }), provider: "agy" as const };
    if (operations.some(op => op.action === "update_floor" && (!allowed.has(op.nurseId) || allowed.get(op.nurseId) !== op.from || op.to === op.from))) {
      console.error("[RXList] AGY proposed an out-of-scope nurse move", JSON.stringify(operations));
      throw new Error("out_of_scope_plan");
    }
    return { proposal: parsed, provider: "agy" as const };
  } catch (error) { console.error("[RXList] AGY request failed", error); return { proposal: Plan.parse({ type:"clarification", message:"No pude conectar con AGY. No se realizó ningún cambio. Verifica que el servicio AGY esté disponible e inténtalo de nuevo.", operations:[] }), provider:"agy-unavailable" as const }; }
}
