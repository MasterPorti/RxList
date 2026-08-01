import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readSession } from "../../../../lib/auth";
import { getStore, saveStore } from "../../../../lib/store";
import { proposeWithAgy } from "../../../../lib/agy";
import { routePrompt } from "../../../../lib/prompt-gateway";

export async function POST(req: Request) {
  const session = await readSession((await cookies()).get("rxlist_session")?.value || "");
  if (!session?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const store = await getStore();
  const user = store.users.find(x => x.id === session.id);
  if (!user || user.role !== "doctor") return NextResponse.json({ error: "doctor_only" }, { status: 403 });
  const { message } = await req.json();
  const current = String(message || "").slice(0, 1000);
  const history = (store.chatHistory[user.id] || []).filter(line => !line.includes("No pude conectar con AGY") && !line.includes("No se realizó ningún cambio")).slice(-6);
  const prompt = `<HISTORIAL>\n${history.join("\n")}\n</HISTORIAL>\n<ULTIMO_MENSAJE_DEL_DOCTOR>\n${current}\n</ULTIMO_MENSAJE_DEL_DOCTOR>`;
  const gateway = routePrompt(current, store, user);
  const result = gateway.provider === "local" ? gateway : await proposeWithAgy(prompt, user, gateway.context);
  const next = [...history, `Doctor: ${current}`, `Asistente: ${result.proposal.message}`].slice(-8);
  store.chatHistory[user.id] = next;
  await saveStore(store);
  return NextResponse.json({ proposal: result.proposal, provider: result.provider, revision: store.revision });
}
