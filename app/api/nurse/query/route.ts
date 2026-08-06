import { NextResponse } from "next/server";
import { currentContext } from "../../../../lib/api";
import { proposeWithGemini } from "../../../../lib/gemini";

export async function POST(req: Request) {
  const context = await currentContext();
  if (!context || context.user.role !== "nurse") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const nurseUser = context.user;
  const ownerUser = context.store.users.find(user => user.role === "doctor" && user.nurses.some(nurse => nurse.id === nurseUser.nurseId));
  if (!ownerUser || ownerUser.role !== "doctor") return NextResponse.json({ error: "doctor_not_found" }, { status: 404 });
  const owner = ownerUser;
  const nurse = owner.nurses.find(item => item.id === nurseUser.nurseId);
  if (!nurse || typeof nurse.floor !== "number") return NextResponse.json({ error: "nurse_floor_missing" }, { status: 400 });
  const body = await req.json().catch(() => ({})) as { message?: string };
  const message = String(body.message || "").trim().slice(0, 800);
  if (!message) return NextResponse.json({ error: "message_required" }, { status: 400 });
  const patients = context.store.patients.filter(patient => patient.status !== "discharged" && patient.floor === nurse.floor);
  const patientIds = new Set(patients.map(patient => patient.id));
  const result = await proposeWithGemini(
    `Consulta de enfermería. Responde únicamente con información del piso ${nurse.floor} (${context.store.floors.find(floor => floor.id === nurse.floor)?.name || "servicio"}). No muestres camas ni capacidad. La pregunta es: ${message}`,
    owner,
    {
      floors: context.store.floors.filter(floor => floor.id === nurse.floor),
      patients,
      shifts: context.store.shifts.filter(shift => shift.floor === nurse.floor),
      medications: context.store.medications.filter(medication => patientIds.has(medication.patientId)),
      tasks: context.store.tasks.filter(task => patientIds.has(task.patientId)),
      vitals: context.store.vitals.filter(vital => patientIds.has(vital.patientId)),
    },
  );
  if (result.provider !== "gemini") return NextResponse.json({ error: "gemini_unavailable" }, { status: 503 });
  return NextResponse.json({ answer: result.proposal.message, provider: result.provider });
}
