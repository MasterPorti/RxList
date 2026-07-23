import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readSession } from "../../../../../lib/auth";
import { getStore, saveStore } from "../../../../../lib/store";
import { Floor } from "../../../../../lib/types";
import { hashPassword } from "../../../../../lib/auth";
import { audit, nurseMessage, temporaryPassword } from "../../../../../lib/domain";
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await readSession((await cookies()).get("rxlist_session")?.value || "");
  if (!s?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const st = await getStore(), u = st.users.find(x => x.id === s.id);
  if (!u || u.role !== "doctor") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params; const n = u.nurses.find(n => n.id === id); if (!n) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body = await req.json();
  if (body.action === "reset_password") {
    const account = st.users.find(x => x.role === "nurse" && x.nurseId === n.id);
    if (!account || account.role !== "nurse") return NextResponse.json({ error: "nurse_account_not_found" }, { status: 404 });
    const password = temporaryPassword(); account.passwordHash = hashPassword(password); account.mustChangePassword = true; audit(st, u, "reset_password", "nurse", n.id); st.revision++; await saveStore(st);
    return NextResponse.json({ ok: true, email: account.email, password, message: nurseMessage(n, password), revision: st.revision });
  }
  const floor = Floor.safeParse(body.floor);
  if (!body.name || String(body.name).trim().split(/\s+/).length < 2 || !floor.success) return NextResponse.json({ error: "full_name_required" }, { status: 400 });
  if (u.nurses.some(x => x.id !== n.id && x.name.toLowerCase() === String(body.name).toLowerCase())) return NextResponse.json({ error: "nurse_exists" }, { status: 409 });
  n.name = String(body.name).trim(); n.alias = body.alias ? String(body.alias).trim() : undefined; n.floor = floor.data; st.revision++; await saveStore(st); return NextResponse.json({ ok: true, doctor: u, revision: st.revision });
}
