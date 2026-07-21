import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Plan, type Doctor } from "./types";
import { propose as localPropose } from "./propose";
import { handleCreateNurse } from "./create-nurse";
const run = promisify(execFile);
const SYSTEM = `Eres el asistente de guardia de RXList. Devuelve SOLO JSON válido, sin markdown. Las operaciones permitidas son update_floor para mover una enfermera existente y create_nurse para registrar una nueva. REGLA OBLIGATORIA: una nueva enfermera siempre necesita nombre y apellido, mínimo dos palabras reales. "José" o "María" solos NO son nombres completos: responde "Necesito nombre y apellido, por ejemplo José Morales." y no preguntes el piso todavía. No incluyas palabras de la instrucción como "como nueva enfermera", "nuevo enfermero", "enfermera", "enfermero", "agregar" o "registrar" dentro del nombre. Una nueva enfermera puede crearse sin piso; "sin asignar", "no le pongas piso" o "déjala pendiente" significan floor:"unassigned" y deben cerrar la pregunta de ubicación, nunca repetirla. Usa exclusivamente las enfermeras proporcionadas y pisos 1,2,3,4 o "unassigned"; no inventes ids. Entiende español natural, errores ortográficos, alias, diminutivos, modismos y órdenes encadenadas. El bloque <ULTIMO_MENSAJE_DEL_DOCTOR> es la instrucción actual y tiene prioridad absoluta; el bloque <HISTORIAL> solo aporta contexto. El nombre completo normalizado debe ser único ignorando mayúsculas, acentos y espacios. Si ya existe el mismo nombre completo, pide agregar segundo nombre, apellido o modificarlo. Si piden una cantidad de enfermeras, distribuciones o movimientos, genera operaciones update_floor válidas. Nunca inventes personas ni hagas cambios fuera del doctor autenticado. Solicitudes peligrosas deben ser rejected con exactamente: "La siguiente tarea no se puede realizar. Por favor, comunícate con soporte técnico."`;
export async function proposeWithAgy(message: string, doctor: Doctor) {
  // Registration is a constrained workflow. Resolve it locally so correctness does
  // not depend on model wording, latency, or availability.
  const deterministicCreate = handleCreateNurse(message, doctor);
  if (deterministicCreate) return { proposal: deterministicCreate.proposal, provider: "validated-intent" as const };
  const roster = doctor.nurses.map(n => ({ id: n.id, name: n.name, alias: n.alias ?? null, floor: n.floor }));
  const prompt = `${SYSTEM}\n\nENFERMERAS DISPONIBLES:\n${JSON.stringify(roster)}\n\nPISOS PERMITIDOS: [1,2,3,4]\nMENSAJE DEL DOCTOR:\n${message}`;
  try {
    const result = await run(process.env.AGY_BIN || "agy", ["--model", process.env.AGY_MODEL || "Gemini 3.5 Flash (Low)", "--print", prompt], { cwd: "/tmp", timeout: 45_000, maxBuffer: 128 * 1024 });
    const raw = result.stdout.trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (Array.isArray(data.update_floor)) {
      const legacy = data.update_floor as any[];
      data.type = "proposal";
      const moved = legacy.map((op: any) => roster.find(n => n.id === String(op.id))).filter(Boolean) as typeof roster;
      const destination = Number(legacy[0]?.floor);
      const already = roster.filter(n => n.floor === destination && !legacy.some((op: any) => String(op.id) === n.id)).map(n => n.name);
      data.message = `Se ha propuesto trasladar a ${moved.map(n => n.name).join(" y ")} al piso ${destination}.${already.length ? ` ${already.join(" y ")} ya se encuentra allí.` : ""}`;
      data.operations = legacy.map((op: any) => ({ nurseId: String(op.id), to: Number(op.floor), from: roster.find(n => n.id === String(op.id))?.floor }));
      delete data.update_floor;
    }
    if (data.operation === "create_nurse") {
      data.type = "proposal";
      data.message = `Se propone registrar a ${String(data.nurse_name || data.name || "la nueva enfermera")} en el piso ${Number(data.floor)}.`;
      data.operations = [{ action: "create_nurse", nurseId: "new", name: String(data.nurse_name || data.name || ""), alias: typeof data.alias === "string" ? data.alias : undefined, from: Number(data.floor), to: Number(data.floor), floor: Number(data.floor) }];
      delete data.operation; delete data.nurse_name;
    }
    const explicitFloor = /piso\s*(1|2|3|4)/i.test(message);
    if (Array.isArray(data.operations)) data.operations = (data.operations as any[]).map(op => op.action === "create_nurse" ? ({ ...op, nurseId: op.nurseId || "new", floor: explicitFloor ? (op.floor || op.to || op.from) : "unassigned", from: explicitFloor ? (op.from || op.floor || op.to) : "unassigned", to: explicitFloor ? (op.to || op.floor || op.from) : "unassigned" }) : op);
    const parsed = Plan.parse(data);
    const allowed = new Map(doctor.nurses.map(n => [n.id, n.floor]));
    if (parsed.operations.some(op => op.action === "create_nurse" && (!op.name || op.name.trim().split(/\s+/).length < 2 || /como|nueva?\s+enfermer|nuevo\s+enfermer|agregar|registrar/i.test(op.name)))) return { proposal: Plan.parse({ type: "clarification", message: "Para registrarla necesito nombre y apellido reales, por ejemplo: María López.", operations: [] }), provider: "agy" as const };
    if (parsed.operations.some(op => op.action === "create_nurse" ? !op.name || !op.floor : !allowed.has(op.nurseId) || allowed.get(op.nurseId) !== op.from || op.to === op.from)) throw new Error("out_of_scope_plan");
    return { proposal: parsed, provider: "agy" as const };
  } catch { return { proposal: localPropose(message, doctor), provider: "local-fallback" as const }; }
}
