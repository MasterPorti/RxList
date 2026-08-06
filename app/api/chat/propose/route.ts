import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readSession } from "../../../../lib/auth";
import { getStore, saveStore } from "../../../../lib/store";
import { proposeWithAgy } from "../../../../lib/agy";
import { routePrompt } from "../../../../lib/prompt-gateway";
import { Plan } from "../../../../lib/types";
import { agyEnabled } from "../../../../lib/agy-status";
import { proposeWithGemini, streamGeminiProposal } from "../../../../lib/gemini";
import { normalizeName } from "../../../../lib/domain";

const patientRequiredFields = ["fullName", "birthDate", "reason", "allergies", "emergencyContact", "emergencyPhone", "floor"];

function asFloor(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 4) return value;
  const text = String(value ?? "").toLocaleLowerCase();
  if (/piso\s*1|medicina interna/.test(text)) return 1;
  if (/piso\s*2|pediatr[ií]a/.test(text)) return 2;
  if (/piso\s*3|cirug[ií]a/.test(text)) return 3;
  if (/piso\s*4|urgencias|emergencias/.test(text)) return 4;
  return undefined;
}

function normalizePatientProposal(plan: Plan, store: Awaited<ReturnType<typeof getStore>>): Plan {
  const operations = plan.operations.map((raw: any) => {
    if (raw?.action === "move_patient") {
      const source = [raw.fullName, raw.name, raw.patientName, raw.patient, plan.message].filter(Boolean).join(" ");
      const patient = store.patients.find(item => item.id === raw.patientId || item.id === raw.id) || store.patients.find(item => source.toLocaleLowerCase().includes(normalizeName(item.fullName).toLocaleLowerCase()));
      return {
        ...raw,
        patientId: patient?.id || raw.patientId || raw.id || raw.patient,
        fullName: patient?.fullName || raw.fullName || raw.name || raw.patientName,
        to: asFloor(raw.to ?? raw.floor ?? raw.destinationFloor ?? raw.piso ?? plan.message),
      };
    }
    if (raw?.action === "assign_patient") {
      const source = [raw.fullName, raw.name, raw.patientName, raw.patient, plan.message].filter(Boolean).join(" ");
      const patient = store.patients.find(item => item.id === raw.patientId || item.id === raw.id) || store.patients.find(item => source.toLocaleLowerCase().includes(normalizeName(item.fullName).toLocaleLowerCase()));
      return {
        ...raw,
        patientId: patient?.id || raw.patientId || raw.id || raw.patient,
        fullName: patient?.fullName || raw.fullName || raw.name || raw.patientName,
        floor: asFloor(raw.floor ?? raw.to ?? raw.destinationFloor ?? raw.piso ?? plan.message),
      };
    }
    if (raw?.action !== "create_patient") return raw;
    const operation: any = {
      ...raw,
      fullName: raw.fullName || raw.name || raw.patientName,
      birthDate: raw.birthDate || raw.dateOfBirth || raw.date,
      reason: raw.reason || raw.admissionReason || raw.motivo,
      allergies: raw.allergies ?? raw.alergias,
      emergencyContact: raw.emergencyContact || raw.contactName || raw.emergencyName,
      emergencyPhone: raw.emergencyPhone || raw.contactPhone || raw.emergencyContactPhone || raw.phone,
      floor: asFloor(raw.floor ?? raw.assignedFloor ?? raw.piso),
    };
    if (operation.bed !== undefined && typeof operation.bed !== "number") {
      const bed = Number(operation.bed);
      if (Number.isInteger(bed) && bed > 0) operation.bed = bed;
      else delete operation.bed;
    }
    return operation;
  });
  const patient = operations.find((operation: any) => operation.action === "create_patient");
  if (!patient) return Plan.parse({ ...plan, operations });
  const missing = patientRequiredFields.filter(field => {
    const value = patient[field];
    return value === undefined || value === null || String(value).trim() === "";
  });
  if (missing.length) {
    return Plan.parse({ ...plan, type: "clarification", intent: "create_patient", message: "Tengo algunos datos del paciente. Completa los campos faltantes para continuar.", missing, operations: [patient] });
  }
  if (plan.type === "proposal" && /\b(se ha registrado|ya se registr[oó]|registro realizado)\b/i.test(plan.message)) {
    return Plan.parse({ ...plan, operations, message: `Se propone registrar a ${patient.fullName} en el piso ${patient.floor}.` });
  }
  return Plan.parse({ ...plan, operations });
}

function assignFreeBeds(plan: Plan, store: Awaited<ReturnType<typeof getStore>>) {
  let noFreeBed = false;
  const operations = plan.operations.map((operation: any) => {
    if (operation.action !== "create_patient" || typeof operation.floor !== "number") return operation;
    const occupied = new Set(store.patients.filter(patient => patient.status !== "discharged" && patient.floor === operation.floor).map(patient => patient.bed).filter(Boolean));
    const floor = store.floors.find(item => item.id === operation.floor);
    const freeBed = floor ? Array.from({ length: floor.beds }, (_, index) => index + 1).find(bed => !occupied.has(bed)) : undefined;
    if (freeBed === undefined) noFreeBed = true;
    return freeBed ? { ...operation, bed: freeBed } : operation;
  });
  const created = operations.find((operation: any) => operation.action === "create_patient");
  if (created && noFreeBed) {
    return Plan.parse({ ...plan, type: "clarification", message: `No hay camas libres en el piso ${created.floor}. Elige otro piso para continuar.`, missing: ["floor"], operations: [] });
  }
  if (created && created.bed !== undefined && created.bed !== plan.operations.find((operation: any) => operation.action === "create_patient")?.bed) {
    return Plan.parse({ ...plan, operations, message: `${plan.message} La cama ${created.bed} se asignará automáticamente porque está libre.` });
  }
  return plan;
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  const session = await readSession((await cookies()).get("rxlist_session")?.value || "");
  if (!session?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const store = await getStore();
  const user = store.users.find(x => x.id === session.id);
  if (!user || user.role !== "doctor") return NextResponse.json({ error: "doctor_only" }, { status: 403 });
  const body = await req.json();
  const { message } = body;
  const selectedProvider = body.provider === "gemini" ? "gemini" : "agy";
  const current = String(message || "").slice(0, 1000);
  const history = (store.chatHistory[user.id] || []).filter(line => !line.includes("No pude conectar con AGY") && !line.includes("No se realizó ningún cambio")).slice(-6);
  const prompt = `<HISTORIAL>\n${history.join("\n")}\n</HISTORIAL>\n<ULTIMO_MENSAJE_DEL_DOCTOR>\n${current}\n</ULTIMO_MENSAJE_DEL_DOCTOR>`;
  const gateway = routePrompt(prompt, store, user);
  if (selectedProvider === "agy" && gateway.provider !== "local" && !(await agyEnabled())) {
    const proposal = Plan.parse({ type: "clarification", message: "AGY está apagado por administración. Enciéndelo desde el panel admin para usar el asistente de operaciones.", operations: [] });
    return NextResponse.json({ proposal, provider: "agy-disabled", revision: store.revision, debug: { route: gateway.route, provider: "agy-disabled", durationMs: Date.now() - startedAt, context: gateway.contextStats, historyLines: history.length, messageLength: current.length, promptLength: prompt.length, agyTimeoutMs: Number(process.env.AGY_TIMEOUT_MS || 30000) } });
  }
  if (selectedProvider === "gemini" && gateway.provider !== "local" && body.stream === true) {
    const stream = streamGeminiProposal(prompt, user, gateway.context, async proposal => {
      const completed = assignFreeBeds(normalizePatientProposal(proposal, store), store);
      store.chatHistory[user.id] = [...history, `Doctor: ${current}`, `Asistente: ${completed.message}`].slice(-8);
      await saveStore(store);
      return completed;
    });
    return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
  }
  const rawResult = gateway.provider === "local" ? gateway : selectedProvider === "gemini" ? await proposeWithGemini(prompt, user, gateway.context) : await proposeWithAgy(prompt, user, gateway.context);
  const result = { ...rawResult, proposal: assignFreeBeds(normalizePatientProposal(rawResult.proposal, store), store) };
  const next = [...history, `Doctor: ${current}`, `Asistente: ${result.proposal.message}`].slice(-8);
  store.chatHistory[user.id] = next;
  await saveStore(store);
  return NextResponse.json({ proposal: result.proposal, provider: result.provider, revision: store.revision, debug: {
    route: gateway.route,
    provider: result.provider,
    durationMs: Date.now() - startedAt,
    context: gateway.contextStats,
    historyLines: history.length,
    messageLength: current.length,
    promptLength: prompt.length,
    agyTimeoutMs: Number(process.env.AGY_TIMEOUT_MS || 30000),
  } });
}
