import { NextResponse } from "next/server";
import {
  createFloorJob,
  executeFloorJob,
  getFloorJob,
  hasActiveFloorJob,
} from "@/lib/floor-agent";

export const runtime = "nodejs";

interface FloorJobRequest {
  action?: "interpret" | "confirm";
  transcript?: string;
  doctorId?: string;
  jobId?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as FloorJobRequest;

    if (body.action === "interpret") {
      if (hasActiveFloorJob()) {
        return NextResponse.json(
          { status: "error", output: "Ya hay otra asignación en ejecución." },
          { status: 409 },
        );
      }
      const job = await createFloorJob(body.transcript ?? "", body.doctorId ?? "");
      return NextResponse.json(job, { status: job.status === "error" ? 400 : 201 });
    }

    if (body.action === "confirm" && body.jobId) {
      const job = getFloorJob(body.jobId);
      if (!job) {
        return NextResponse.json({ status: "error", output: "Trabajo no encontrado." }, { status: 404 });
      }
      if (hasActiveFloorJob()) {
        return NextResponse.json(
          { status: "error", output: "Ya hay otra asignación en ejecución." },
          { status: 409 },
        );
      }
      void executeFloorJob(job.id);
      return NextResponse.json({ ...job, state: "running", output: "Autorización recibida. Aplicando el cambio razonado." });
    }

    return NextResponse.json({ status: "error", output: "Acción inválida." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { status: "error", output: error instanceof Error ? error.message : "Solicitud inválida." },
      { status: 500 },
    );
  }
}
