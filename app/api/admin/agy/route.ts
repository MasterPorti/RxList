import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readSession } from "../../../../lib/auth";
import { checkAgy } from "../../../../lib/agy-status";
import { getStore, saveStore } from "../../../../lib/store";

async function admin() { return readSession((await cookies()).get("rxlist_session")?.value || ""); }

export async function GET() {
  const session = await admin();
  if (session?.role !== "admin") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await checkAgy(), { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const session = await admin();
  if (session?.role !== "admin") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json();
  if (typeof body.enabled !== "boolean") return NextResponse.json({ error: "enabled_boolean_required" }, { status: 400 });
  const store = await getStore();
  store.settings = { ...(store.settings || { agyEnabled: true }), agyEnabled: body.enabled };
  store.revision += 1;
  store.audit.push({ id: crypto.randomUUID(), actorId: session.id, actorRole: "admin", action: body.enabled ? "enable" : "disable", entity: "agy", details: { enabled: body.enabled }, at: new Date().toISOString() });
  await saveStore(store);
  return NextResponse.json(await checkAgy(), { headers: { "Cache-Control": "no-store" } });
}
