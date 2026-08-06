import { NextResponse } from "next/server";
import { currentContext } from "../../../lib/api";
import { saveStore } from "../../../lib/store";
import type { Doctor, NurseUser } from "../../../lib/types";

function visibleMessageIds(user: Doctor | NurseUser) {
  if (user.role === "nurse") return new Set([user.id]);
  return new Set([user.id, ...user.nurses.map(nurse => nurse.userId).filter(Boolean) as string[]]);
}

export async function GET() {
  const context = await currentContext();
  if (!context) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (context.user.role !== "doctor" && context.user.role !== "nurse") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const ids = visibleMessageIds(context.user);
  const messages = context.store.messages.filter(message => (ids.has(message.senderId) || message.recipientIds.some(id => ids.has(id))) && !(message.archivedBy || []).includes(context.user.id)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const unread = messages.filter(message => !message.readBy.includes(context.user.id) && message.senderId !== context.user.id).length;
  return NextResponse.json({ messages, unread });
}

export async function POST(req: Request) {
  const context = await currentContext();
  if (!context) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (context.user.role !== "doctor" && context.user.role !== "nurse") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const actor = context.user;
  const body = await req.json() as { body?: string; recipientIds?: string[]; threadId?: string };
  const messageBody = String(body.body || "").trim().slice(0, 4000);
  if (!messageBody) return NextResponse.json({ error: "message_required" }, { status: 400 });
  let recipientIds = Array.isArray(body.recipientIds) ? body.recipientIds.map(String) : [];
  if (actor.role === "nurse") {
    const owner = context.store.users.find(user => user.role === "doctor" && user.nurses.some(nurse => nurse.id === actor.nurseId));
    if (!owner) return NextResponse.json({ error: "doctor_not_found" }, { status: 404 });
    recipientIds = [owner.id];
  } else {
    const allowed = new Set(actor.nurses.map(nurse => nurse.userId).filter(Boolean));
    recipientIds = recipientIds.filter(id => allowed.has(id));
  }
  if (!recipientIds.length) return NextResponse.json({ error: "recipients_required" }, { status: 400 });
  const threadId = String(body.threadId || [actor.id, ...recipientIds].sort().join(":"));
  const message = { id: crypto.randomUUID(), threadId, senderId: actor.id, senderName: actor.name, senderRole: actor.role, recipientIds, body: messageBody, createdAt: new Date().toISOString(), readBy: [actor.id] };
  context.store.messages.push(message);
  context.store.revision += 1;
  await saveStore(context.store);
  return NextResponse.json({ message, revision: context.store.revision });
}

export async function PATCH(req: Request) {
  const context = await currentContext();
  if (!context) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (context.user.role !== "doctor" && context.user.role !== "nurse") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json() as { ids?: string[]; threadId?: string; action?: "read" | "archive" };
  if (body.action === "archive" && body.threadId) {
    const visible = context.store.messages.filter(message => message.threadId === body.threadId && (message.senderId === context.user.id || message.recipientIds.includes(context.user.id)));
    if (!visible.length) return NextResponse.json({ error: "thread_not_found" }, { status: 404 });
    for (const message of visible) message.archivedBy = [...new Set([...(message.archivedBy || []), context.user.id])];
    context.store.revision += 1;
    await saveStore(context.store);
    return NextResponse.json({ ok: true, action: "archive", threadId: body.threadId, revision: context.store.revision });
  }
  const ids = new Set((body.ids || []).map(String));
  for (const message of context.store.messages) if (ids.has(message.id) && (message.recipientIds.includes(context.user.id) || message.senderId === context.user.id) && !message.readBy.includes(context.user.id)) message.readBy.push(context.user.id);
  await saveStore(context.store);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const context = await currentContext();
  if (!context) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (context.user.role !== "doctor" && context.user.role !== "nurse") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json() as { threadId?: string };
  const threadId = String(body.threadId || "");
  const visible = context.store.messages.filter(message => message.threadId === threadId && (message.senderId === context.user.id || message.recipientIds.includes(context.user.id)));
  if (!visible.length) return NextResponse.json({ error: "thread_not_found" }, { status: 404 });
  context.store.messages = context.store.messages.filter(message => !visible.includes(message));
  context.store.revision += 1;
  await saveStore(context.store);
  return NextResponse.json({ ok: true, action: "delete", threadId, revision: context.store.revision });
}
