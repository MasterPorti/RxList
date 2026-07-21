import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readSession } from "../../../../lib/auth";
import { getStore } from "../../../../lib/store";
import { proposeWithAgy } from "../../../../lib/agy";
import { handleCreateNurse, type CreateNurseFlowState } from "../../../../lib/create-nurse";

const conversations = new Map<string, string[]>();
const pendingCreates = new Map<string, CreateNurseFlowState>();

export async function POST(req: Request) {
  const session = await readSession((await cookies()).get("rxlist_session")?.value || "");
  if (!session?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const store = await getStore();
  const user = store.users.find(x => x.id === session.id);
  if (!user || user.role !== "doctor") return NextResponse.json({ error: "doctor_only" }, { status: 403 });
  const { message } = await req.json();
  const current = String(message || "").slice(0, 1000);
  const deterministic = handleCreateNurse(current, user, pendingCreates.get(user.id));
  if (deterministic) {
    if (deterministic.nextState) pendingCreates.set(user.id, deterministic.nextState);
    else pendingCreates.delete(user.id);
    return NextResponse.json({ proposal: deterministic.proposal, provider: "validated-intent", revision: store.revision });
  }
  const history = conversations.get(user.id) || [];
  const prompt = `<HISTORIAL>\n${history.join("\n")}\n</HISTORIAL>\n<ULTIMO_MENSAJE_DEL_DOCTOR>\n${current}\n</ULTIMO_MENSAJE_DEL_DOCTOR>`;
  const result = await proposeWithAgy(prompt, user);
  const next = [...history, `Doctor: ${current}`, `Asistente: ${result.proposal.message}`].slice(-8);
  conversations.set(user.id, next);
  return NextResponse.json({ proposal: result.proposal, provider: result.provider, revision: store.revision });
}
