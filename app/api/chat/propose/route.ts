import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readSession } from "../../../../lib/auth";
import { getStore, saveStore } from "../../../../lib/store";
import { proposeWithAgy } from "../../../../lib/agy";
import { routePrompt } from "../../../../lib/prompt-gateway";
import { Plan } from "../../../../lib/types";

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
  const { message } = await req.json();
  const current = String(message || "").slice(0, 1000);
  const history = (store.chatHistory[user.id] || []).filter(line => !line.includes("No pude conectar con AGY") && !line.includes("No se realizó ningún cambio")).slice(-6);
  const prompt = `<HISTORIAL>\n${history.join("\n")}\n</HISTORIAL>\n<ULTIMO_MENSAJE_DEL_DOCTOR>\n${current}\n</ULTIMO_MENSAJE_DEL_DOCTOR>`;
  const gateway = routePrompt(prompt, store, user);
  const rawResult = gateway.provider === "local" ? gateway : await proposeWithAgy(prompt, user, gateway.context);
  const result = { ...rawResult, proposal: assignFreeBeds(rawResult.proposal, store) };
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
