import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readSession } from "../../../../lib/auth";
import { getStore, saveStore } from "../../../../lib/store";
import { Plan } from "../../../../lib/types";
export async function POST(req: Request) {
  const s = await readSession((await cookies()).get("rxlist_session")?.value || "");
  if (!s?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json(); const parsed = Plan.safeParse(body.proposal);
  if (!parsed.success || parsed.data.type !== "proposal") return NextResponse.json({ error: "invalid_proposal" }, { status: 400 });
  const st = await getStore(); if (st.revision !== body.revision) return NextResponse.json({ error: "revision_conflict" }, { status: 409 });
  const u = st.users.find(x => x.id === s.id); if (!u || u.role !== "doctor") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  for (const op of parsed.data.operations) {
    if (op.action === "create_nurse") { const name = op.name; if (!name || name.trim().split(/\s+/).length < 2 || /como|nueva?\s+enfermer|nuevo\s+enfermer|agregar|registrar/i.test(name) || !op.floor) return NextResponse.json({ error: "full_name_required" }, { status: 400 }); const duplicate = u.nurses.some(n => n.name.toLowerCase() === name.toLowerCase()); if (duplicate) return NextResponse.json({ error: "nurse_exists" }, { status: 409 }); continue; }
    const n = u.nurses.find(n => n.id === op.nurseId); if (!n || n.floor !== op.from || n.floor === op.to) return NextResponse.json({ error: "stale_or_invalid_operation" }, { status: 409 });
  }
  for (const op of parsed.data.operations) {
    if (op.action === "create_nurse") { const n = { id: crypto.randomUUID(), name: op.name!, alias: op.alias, floor: op.floor! }; u.nurses.push(n); continue; }
    const n = u.nurses.find(n => n.id === op.nurseId)!; n.floor = op.to; st.audit.push({ id: crypto.randomUUID(), doctorId: u.id, nurseId: n.id, from: op.from, to: op.to, at: new Date().toISOString() });
  }
  st.revision++; await saveStore(st); return NextResponse.json({ ok: true, doctor: u, revision: st.revision });
}
