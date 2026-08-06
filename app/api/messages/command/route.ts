import { NextResponse } from "next/server";
import { currentContext } from "../../../../lib/api";
import { saveStore } from "../../../../lib/store";
import { proposeWithGemini } from "../../../../lib/gemini";
import { audit } from "../../../../lib/domain";

export async function POST(req: Request) {
  const context = await currentContext();
  if (!context || context.user.role !== "doctor") return NextResponse.json({ error: "doctor_only" }, { status: 403 });
  const body = await req.json() as { command?: string; recipientIds?: string[]; threadId?: string };
  const command = String(body.command || "").trim().slice(0, 2000);
  const recipientIds = Array.isArray(body.recipientIds) ? [...new Set(body.recipientIds.map(String))] : [];
  const allowed = new Set(context.user.nurses.map(nurse => nurse.userId).filter(Boolean));
  if (!command) return NextResponse.json({ error: "command_required" }, { status: 400 });
  if (!recipientIds.length || recipientIds.some(id => !allowed.has(id))) return NextResponse.json({ error: "recipients_required" }, { status: 400 });
  const patientContext = context.store.patients.filter(patient => patient.status !== "discharged");
  const result = await proposeWithGemini(
    `MODO CHAT INTERNO. El doctor está escribiendo una instrucción para una enfermera. Redacta el contenido final del mensaje que se enviará al hilo. Usa los datos clínicos y operativos del contexto, busca al paciente por nombre aunque tenga errores ortográficos y, si pide información completa, incluye ubicación, motivo de ingreso, alergias, contacto de emergencia, signos vitales históricos, medicamentos activos y tareas pendientes. No devuelvas una propuesta, no pidas confirmación, no describas la operación y no digas que vas a enviar el mensaje: devuelve en message únicamente el texto listo para enviar. Si faltan datos, dilo claramente.\n\nINSTRUCCIÓN DEL DOCTOR:\n${command}`,
    context.user,
    { floors: context.store.floors, patients: patientContext, shifts: context.store.shifts, medications: context.store.medications, tasks: context.store.tasks, vitals: context.store.vitals },
  );
  if (result.provider !== "gemini") return NextResponse.json({ error: "gemini_unavailable" }, { status: 502 });
  const messageBody = result.proposal.message.trim();
  if (!messageBody) return NextResponse.json({ error: "empty_ai_message" }, { status: 502 });
  const threadId = String(body.threadId || [context.user.id, ...recipientIds].sort().join(":"));
  const message = { id: crypto.randomUUID(), threadId, senderId: context.user.id, senderName: context.user.name, senderRole: "doctor" as const, recipientIds, body: messageBody, createdAt: new Date().toISOString(), readBy: [context.user.id] };
  context.store.messages.push(message);
  context.store.revision += 1;
  audit(context.store, context.user, "send", "message", message.id, { recipientIds, generatedBy: "gemini", command });
  await saveStore(context.store);
  return NextResponse.json({ ok: true, message, revision: context.store.revision, provider: result.provider });
}
