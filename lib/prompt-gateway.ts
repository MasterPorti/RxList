import { Plan, type Doctor, type Patient, type Store } from "./types";
import { normalizeName } from "./domain";

type Context = Pick<Store, "floors" | "patients" | "shifts" | "medications" | "tasks">;
type LocalResult = { provider: "local"; proposal: Plan; route: "local"; contextStats: ContextStats };
type AgyResult = { provider: "agy"; message: string; context: Context; route: "agy"; contextStats: ContextStats };
export type GatewayResult = LocalResult | AgyResult;
export type ContextStats = { patients: number; floors: number; shifts: number; medications: number; tasks: number };

const clean = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const latest = (value: string) => value.match(/<ULTIMO_MENSAJE_DEL_DOCTOR>\s*([\s\S]*?)\s*<\/ULTIMO_MENSAJE_DEL_DOCTOR>/i)?.[1]?.trim() || value.trim();
const local = (message: string, intent: string, operations: any[] = []): LocalResult => ({ provider: "local", route: "local", proposal: Plan.parse({ type: "no_change", intent, message, operations }), contextStats: { patients: 0, floors: 0, shifts: 0, medications: 0, tasks: 0 } });
const clarification = (message: string, intent: string, missing: string[]): LocalResult => ({ provider: "local", route: "local", proposal: Plan.parse({ type: "clarification", intent, message, missing, operations: [] }), contextStats: { patients: 0, floors: 0, shifts: 0, medications: 0, tasks: 0 } });

function findPatient(query: string, patients: Patient[]) {
  const normalized = clean(query);
  return patients.find(patient => normalized.includes(clean(patient.fullName))) || patients.find(patient => {
    const parts = clean(patient.fullName).split(" ");
    return parts.length > 1 && parts.every(part => normalized.includes(part));
  });
}

function patientLabel(patient: Patient) {
  const floor = typeof patient.floor === "number" ? `Piso ${patient.floor}` : "Sin piso";
  return `${patient.fullName} · ${floor}${patient.bed ? ` · Cama ${patient.bed}` : ""}`;
}

function localQuery(message: string, store: Store, doctor: Doctor): LocalResult | null {
  const text = latest(message);
  const normalized = clean(text);
  const mutation = /\b(mueve|mover|traslada|trasladar|asigna|asignar|crea|crear|registra|registrar|ingresa|ingresar|alta|da de alta|elimina|cambia|cambiar|añade|agrega)\b/i.test(text);
  if (mutation) return null;

  const patient = findPatient(text, store.patients);
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
  if (/qué pacientes|que pacientes|lista de pacientes|pacientes tengo|pacientes hay/i.test(text)) {
    const patients = store.patients.filter(p => p.status !== "discharged");
    if (!patients.length) return local("No hay pacientes ingresados.", "query_patient");
    return local(`### Pacientes ingresados\n\n${patients.map(patientLabel).map(row => `- ${row}`).join("\n")}`, "query_patient");
  }
  if (/camas? (libres|disponibles)|disponibilidad de camas|hay camas/i.test(text)) {
    const rows = store.floors.map(floor => {
      const occupied = store.patients.filter(p => p.status !== "discharged" && p.floor === floor.id).map(p => p.bed).filter(Boolean) as number[];
      const available = Array.from({ length: floor.beds }, (_, i) => i + 1).filter(bed => !occupied.includes(bed));
      return `| Piso ${floor.id} · ${floor.name} | ${available.length} | ${available.slice(0, 12).join(", ") || "—"} |`;
    });
    return local(`### Camas disponibles\n\n| Piso | Libres | Números |\n|---|---:|---|\n${rows.join("\n")}`, "query_floor");
  }
  if (/enfermeras?|personal|quién está|quien esta/i.test(text)) {
    const floorMatch = normalized.match(/piso\s*(1|2|3|4)/);
    const nurses = doctor.nurses.filter(nurse => !floorMatch || nurse.floor === Number(floorMatch[1]));
    return local(`### Personal${floorMatch ? ` del piso ${floorMatch[1]}` : ""}\n\n${nurses.length ? nurses.map(nurse => `- ${nurse.name} · ${typeof nurse.floor === "number" ? `Piso ${nurse.floor}` : "Sin piso"}`).join("\n") : "No hay personal coincidente."}`, "query_floor");
  }
  return null;
}

function compactContext(message: string, store: Store): Context {
  const text = clean(latest(message));
  const mentioned = store.patients.filter(patient => text.includes(clean(patient.fullName)) || clean(patient.fullName).split(" ").filter(part => part.length > 3).every(part => text.includes(part)));
  const patients = mentioned.length ? mentioned : store.patients.filter(patient => patient.status !== "discharged").slice(0, 12);
  const patientIds = new Set(patients.map(patient => patient.id));
  return {
    floors: store.floors,
    patients,
    shifts: store.shifts,
    medications: store.medications.filter(medication => patientIds.has(medication.patientId)).slice(0, 24),
    tasks: store.tasks.filter(task => patientIds.has(task.patientId)).slice(0, 40),
  };
}

function contextStats(context: Context): ContextStats {
  return { patients: context.patients.length, floors: context.floors.length, shifts: context.shifts.length, medications: context.medications.length, tasks: context.tasks.length };
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
  const continuation = patientRegistrationContinuation(message);
  if (continuation) return continuation;
  const localResult = localQuery(message, store, doctor);
  if (localResult) return { ...localResult, contextStats: contextStats(compactContext(message, store)) };
  const context = compactContext(message, store);
  return { provider: "agy", route: "agy", message, context, contextStats: contextStats(context) };
}
