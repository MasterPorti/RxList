import { Plan, type Doctor, type Patient, type Store } from "./types";
import { normalizeName } from "./domain";

type Context = Pick<Store, "floors" | "patients" | "shifts" | "medications" | "tasks" | "vitals">;
type LocalResult = { provider: "local"; proposal: Plan; route: "local"; contextStats: ContextStats };
type AgyResult = { provider: "agy"; message: string; context: Context; route: "agy"; contextStats: ContextStats };
export type GatewayResult = LocalResult | AgyResult;
export type ContextStats = { patients: number; floors: number; shifts: number; medications: number; tasks: number; vitals: number };

const clean = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const latest = (value: string) => value.match(/<ULTIMO_MENSAJE_DEL_DOCTOR>\s*([\s\S]*?)\s*<\/ULTIMO_MENSAJE_DEL_DOCTOR>/i)?.[1]?.trim() || value.trim();
const local = (message: string, intent: string, operations: any[] = []): LocalResult => ({ provider: "local", route: "local", proposal: Plan.parse({ type: "no_change", intent, message, operations }), contextStats: { patients: 0, floors: 0, shifts: 0, medications: 0, tasks: 0, vitals: 0 } });
const localProposal = (message: string, intent: string, operations: any[] = []): LocalResult => ({ provider: "local", route: "local", proposal: Plan.parse({ type: "proposal", intent, message, operations }), contextStats: { patients: 0, floors: 0, shifts: 0, medications: 0, tasks: 0, vitals: 0 } });
const clarification = (message: string, intent: string, missing: string[]): LocalResult => ({ provider: "local", route: "local", proposal: Plan.parse({ type: "clarification", intent, message, missing, operations: [] }), contextStats: { patients: 0, floors: 0, shifts: 0, medications: 0, tasks: 0, vitals: 0 } });

function findPatient(query: string, patients: Patient[]) {
  const normalized = clean(query);
  const exact = patients.find(patient => normalized.includes(clean(patient.fullName)));
  if (exact) return exact;
  const allParts = patients.filter(patient => {
    const parts = clean(patient.fullName).split(" ");
    return parts.length > 1 && parts.every(part => normalized.includes(part));
  });
  if (allParts.length === 1) return allParts[0];
  const queryWords = new Set(normalized.split(/[^a-z0-9áéíóúüñ]+/i).filter(word => word.length >= 4));
  const partial = patients.filter(patient => clean(patient.fullName).split(" ").some(part => queryWords.has(part)));
  return partial.length === 1 ? partial[0] : undefined;
}

function patientLabel(patient: Patient) {
  const floor = typeof patient.floor === "number" ? `Piso ${patient.floor}` : "Sin piso";
  return `${patient.fullName} · ${floor}${patient.bed ? ` · Cama ${patient.bed}` : ""}`;
}

function floorFromText(text: string) {
  const normalized = clean(text);
  if (/pediatria/.test(normalized)) return 2;
  if (/medicina interna/.test(normalized)) return 1;
  if (/cirugia/.test(normalized)) return 3;
  if (/urgencias|emergencias/.test(normalized)) return 4;
  const match = normalized.match(/piso\s*(1|2|3|4|uno|dos|tres|cuatro)\b/);
  if (!match) return undefined;
  return ({ uno: 1, dos: 2, tres: 3, cuatro: 4 } as Record<string, number>)[match[1]] || Number(match[1]);
}

function localQuery(message: string, store: Store, doctor: Doctor): LocalResult | null {
  const text = latest(message);
  const normalized = clean(text);
  const mutation = /\b(mueve|mover|traslada|trasladar|asigna|asignar|crea|crear|registra|registrar|ingresa|ingresar|alta|da de alta|elimina|cambia|cambiar|añade|agrega)\b/i.test(text);
  if (mutation) return null;

  const patient = findPatient(text, store.patients);
  if (/signos vitales|presi[oó]n arterial|temperatura|saturaci[oó]n|frecuencia cardiaca|frecuencia respiratoria/i.test(text) && patient) {
    const vitals = store.vitals.filter(vital => vital.patientId === patient.id).sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
    if (!vitals.length) return local(`No hay signos vitales históricos registrados para **${patient.fullName}**.`, "query_patient");
    const rows = vitals.map(vital => `| ${new Date(vital.recordedAt).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })} | ${vital.temperature || "—"} °C | ${vital.bloodPressure || "—"} | ${vital.heartRate || "—"} | ${vital.respiratoryRate || "—"} | ${vital.oxygenSaturation || "—"}% |`);
    return local(`### Signos vitales históricos de ${patient.fullName}\n\n| Fecha | Temperatura | Presión arterial | FC | FR | SpO₂ |\n|---|---:|---|---:|---:|---:|\n${rows.join("\n")}`, "query_patient");
  }
  if (patient && /informaci[oó]n cl[ií]nica|informaci[oó]n operativa|informaci[oó]n completa|datos generales|ficha cl[ií]nica/i.test(text)) {
    const floor = store.floors.find(item => item.id === patient.floor);
    const medications = store.medications.filter(item => item.patientId === patient.id && item.status === "active");
    const tasks = store.tasks.filter(item => item.patientId === patient.id && ["pending", "in_progress"].includes(item.status));
    const vitals = store.vitals.filter(item => item.patientId === patient.id).sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)).slice(0, 5);
    const vitalRows = vitals.map(vital => `| ${new Date(vital.recordedAt).toLocaleDateString("es-MX")} | ${vital.temperature || "—"} °C | ${vital.bloodPressure || "—"} | ${vital.heartRate || "—"} | ${vital.respiratoryRate || "—"} | ${vital.oxygenSaturation || "—"}% |`);
    const medicationText = medications.length ? medications.map(item => `- ${item.name}${item.dose ? ` (${item.dose})` : ""} · ${item.times.join(", ")}`).join("\n") : "- No hay medicamentos activos registrados.";
    const taskText = tasks.length ? tasks.map(item => `- ${item.title} · ${new Date(item.scheduledAt).toLocaleString("es-MX")}`).join("\n") : "- No hay tareas pendientes.";
    return local(`### Información clínica y operativa: ${patient.fullName}\n\n**Ubicación:** ${floor?.name || `Piso ${patient.floor}`} · Cama ${patient.bed || "sin asignar"}\n\n**Motivo de ingreso:** ${patient.reason || "No registrado"}\n\n**Alergias:** ${patient.allergies || "No registradas"}\n\n**Contacto de emergencia:** ${patient.emergencyContact || "No registrado"} (${patient.emergencyPhone || "sin teléfono"})\n\n**Notas:** ${patient.notes || "Sin notas adicionales."}\n\n### Signos vitales recientes\n\n${vitalRows.length ? `| Fecha | Temperatura | Presión arterial | FC | FR | SpO₂ |\n|---|---:|---|---:|---:|---:|\n${vitalRows.join("\n")}` : "No hay signos vitales registrados."}\n\n### Medicación activa\n\n${medicationText}\n\n### Tareas pendientes\n\n${taskText}`, "query_patient");
  }
  if (/contacto(?: de emergencia)?|emergencia/i.test(text) && patient) {
    return local(`El contacto de emergencia de **${patient.fullName}** es **${patient.emergencyContact}** (${patient.emergencyPhone}).`, "query_patient");
  }
  if (/medicamento|medicación|tratamiento|qué toma|que toma/i.test(text)) {
    const medications = store.medications.filter(m => m.status === "active" && (!patient || m.patientId === patient.id));
    if (!medications.length) return local(patient ? `**${patient.fullName}** no tiene medicamentos activos registrados.` : "No hay medicamentos activos registrados.", "query_patient");
    const rows = medications.map(m => {
      const owner = store.patients.find(p => p.id === m.patientId)?.fullName || "Paciente";
      return `| ${owner} | ${m.name} | ${m.dose || "—"} | ${m.times.join(", ")} |`;
    });
    return local(`### Medicamentos activos\n\n| Paciente | Medicamento | Dosis | Horarios |\n|---|---|---|---|\n${rows.join("\n")}`, "query_patient");
  }
  const floorId = floorFromText(text);
  if (floorId && /pacientes?|informaci[oó]n|ocupaci[oó]n|camas?/i.test(text) && !/enferm|enfem|personal/i.test(text)) {
    const patients = store.patients.filter(patient => patient.status !== "discharged" && patient.floor === floorId);
    if (!patients.length) return local(`No hay pacientes ingresados en ${store.floors.find(floor => floor.id === floorId)?.name || `el piso ${floorId}`}.`, "query_floor");
    const floorName = store.floors.find(floor => floor.id === floorId)?.name || `Piso ${floorId}`;
    const rows = patients.map(patient => `| ${patient.fullName} | ${patient.bed ? `Cama ${patient.bed}` : "Sin cama"} | ${patient.reason || "—"} | ${patient.allergies || "—"} | ${patient.emergencyContact || "—"} (${patient.emergencyPhone || "sin teléfono"}) |`);
    return local(`### Pacientes de ${floorName}\n\n| Paciente | Ubicación | Motivo de ingreso | Alergias | Contacto de emergencia |\n|---|---|---|---|---|\n${rows.join("\n")}`, "query_floor");
  }
  if (/qué pacientes|que pacientes|lista de pacientes|pacientes tengo|pacientes hay/i.test(text)) {
    const allPatients = store.patients.filter(p => p.status !== "discharged" && (!floorId || p.floor === floorId));
    const patients = allPatients.slice(0, 12);
    const scope = floorId ? ` del piso ${floorId}` : "";
    const suffix = allPatients.length > patients.length ? `\n\n_Mostrando ${patients.length} de ${allPatients.length} pacientes._` : "";
    if (!patients.length) return local("No hay pacientes ingresados.", "query_patient");
    return local(`### Pacientes ingresados${scope}\n\n${patients.map(patientLabel).map(row => `- ${row}`).join("\n")}${suffix}`, "query_patient");
  }
  if (/camas? (libres|disponibles)|disponibilidad de camas|hay camas/i.test(text)) {
    const rows = store.floors.map(floor => {
      const occupied = store.patients.filter(p => p.status !== "discharged" && p.floor === floor.id).map(p => p.bed).filter(Boolean) as number[];
      const available = Array.from({ length: floor.beds }, (_, i) => i + 1).filter(bed => !occupied.includes(bed));
      return `| Piso ${floor.id} · ${floor.name} | ${available.length} | ${available.slice(0, 12).join(", ") || "—"} |`;
    });
    return local(`### Camas disponibles\n\n| Piso | Libres | Números |\n|---|---:|---|\n${rows.join("\n")}`, "query_floor");
  }
  if (/enfermeras?|enfermer[oa]s?|enferm|enfem|personal|quién está|quien esta/i.test(text)) {
    const nurseFloor = floorFromText(text);
    const nurses = doctor.nurses.filter(nurse => !nurseFloor || nurse.floor === nurseFloor);
    return local(`### Personal${nurseFloor ? ` del piso ${nurseFloor}` : ""}\n\n${nurses.length ? nurses.map(nurse => `- ${nurse.name} · ${typeof nurse.floor === "number" ? `Piso ${nurse.floor}` : "Sin piso"}`).join("\n") : "No hay personal coincidente."}`, "query_floor");
  }
  return null;
}

function localPatientMove(message: string, store: Store): LocalResult | null {
  const current = latest(message);
  if (!/\b(mueve|mover|muevela|mu[eé]vela|mu[eé]velo|traslada|trasladar)\b/i.test(current)) return null;
  const destination = floorFromText(current);
  if (!destination) return null;
  const patient = findPatient(message, store.patients);
  if (!patient || typeof patient.floor !== "number") return null;
  if (patient.floor === destination) return local(`**${patient.fullName}** ya se encuentra en el piso ${destination}.`, "move_patient");
  const floor = store.floors.find(item => item.id === destination);
  return localProposal(`Se propone trasladar a **${patient.fullName}** del piso ${patient.floor} al piso ${destination} (${floor?.name || "destino"}). Confirma para aplicar el cambio.`, "move_patient", [{ action: "move_patient", patientId: patient.id, from: patient.floor, to: destination }]);
}

function localNurseMessage(message: string, store: Store): LocalResult | null {
  const current = latest(message);
  if (!/(?:manda|env[ií]a|dile|avisa).*(?:mensaje|enfermer)/i.test(current)) return null;
  const floorId = floorFromText(message);
  if (!floorId) return clarification("¿A qué piso o enfermera deseas enviar el mensaje?", "send_message", ["floor"]);
  const body = current.split(/(?:dile que|diles que|con esta informaci[oó]n|mensaje:)/i)[1]?.trim() || current.replace(/.*?(?:mensaje|enfermer(?:a|as)?)/i, "").replace(/^(?:del?|de las?)\s+/i, "").trim();
  if (!body || body.length < 8) return clarification("¿Qué información deseas enviar a las enfermeras de ese piso?", "send_message", ["body"]);
  const nurses = store.users.filter(user => user.role === "doctor").flatMap(user => user.nurses.filter(nurse => nurse.floor === floorId && nurse.userId).map(nurse => nurse.userId as string));
  if (!nurses.length) return local(`No hay enfermeras asignadas al piso ${floorId}.`, "send_message");
  const floor = store.floors.find(item => item.id === floorId);
  return localProposal(`Se propone enviar este mensaje a las enfermeras de ${floor?.name || `piso ${floorId}`}: “${body}”.`, "send_message", [{ action: "send_message", floor: floorId, body, recipientIds: nurses }]);
}

function compactContext(message: string, store: Store): Context {
  // Gemini interpreta la solicitud. Esta capa no intenta detectar pisos,
  // nombres ni intenciones: entrega el contexto operativo completo.
  const patients = store.patients.filter(patient => patient.status !== "discharged");
  const patientIds = new Set(patients.map(patient => patient.id));
  return {
    floors: store.floors,
    patients,
    shifts: store.shifts,
    medications: store.medications.filter(medication => patientIds.has(medication.patientId)),
    tasks: store.tasks.filter(task => patientIds.has(task.patientId)),
    vitals: store.vitals.filter(vital => patientIds.has(vital.patientId)),
  };
}

function contextStats(context: Context): ContextStats {
  return { patients: context.patients.length, floors: context.floors.length, shifts: context.shifts.length, medications: context.medications.length, tasks: context.tasks.length, vitals: context.vitals.length };
}

function patientRegistrationContinuation(message: string): LocalResult | null {
  const current = clean(latest(message));
  const conversation = clean(message);
  const isPatientFlow = /como paciente|\bpaciente\b|registrar (?:a )?.*paciente|para registrar .*paciente|datos obligatorios/.test(conversation);
  const isoDate = current.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);
  const validIsoDate = !isoDate || (() => { const year = Number(isoDate[1]); const month = Number(isoDate[2]); const day = Number(isoDate[3]); const date = new Date(Date.UTC(year, month - 1, day)); return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day; })();
  const hasDate = /\b\d{1,2}\s+de\s+[a-z]+\s+del?\s+(?:dos\s*mil|\d{4})|\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/.test(current);
  const hasPhone = /(?:tel[eé]fono|celular|m[oó]vil|contacto)\D*(?:\+?\d[\d\s().-]{7,})\b|\b\d{10}\b/i.test(current);
  const hasReason = /motivo(?: de ingreso)?|causa(?: de ingreso)?|ingres[oa] por|duele|dolor|panza/i.test(current);
  const hasAllergies = /alergias?|al[eé]rgic|sin alergias/i.test(current);
  const hasEmergencyContact = /contacto de emergencia|familiar de emergencia/i.test(current);
  const hasLocation = /\bpiso\s*[1-4]\b/i.test(current) && /\bcama\s*\d+\b/i.test(current);
  if (isPatientFlow && !hasLocation && (hasDate || hasPhone || hasReason || hasAllergies || hasEmergencyContact)) {
    const hasFloor = /\bpiso\s*[1-4]\b/i.test(current);
    const completePatientData = hasDate && validIsoDate && hasReason && hasAllergies && hasEmergencyContact && hasPhone;
    if (completePatientData && hasFloor) return null;
    if (completePatientData && !hasFloor) return clarification("Ya tengo los datos del paciente. Indica el piso y asignaré automáticamente una cama libre.", "create_patient", ["floor"]);
    const missing = [
      ...(hasDate && !validIsoDate ? ["birthDate"] : !hasDate ? ["birthDate"] : []),
      ...(!hasReason ? ["reason"] : []), ...(!hasAllergies ? ["allergies"] : []),
      ...(!hasEmergencyContact ? ["emergencyContact"] : []), ...(!hasPhone ? ["emergencyPhone"] : []),
      ...(!hasFloor ? ["floor"] : []),
    ];
    if (!(hasDate && validIsoDate && hasReason && hasAllergies && hasEmergencyContact && hasPhone)) return null;
    const dateMessage = hasDate && !validIsoDate ? " La fecha de nacimiento no es válida." : "";
    return clarification(`Para registrar al paciente necesito fecha de nacimiento, motivo de ingreso, alergias, contacto de emergencia, teléfono y piso.${dateMessage}`, "create_patient", missing);
  }
  return null;
}

export function routePrompt(message: string, store: Store, doctor: Doctor): GatewayResult {
  const context = compactContext(message, store);
  return { provider: "agy", route: "agy", message, context, contextStats: contextStats(context) };
}
