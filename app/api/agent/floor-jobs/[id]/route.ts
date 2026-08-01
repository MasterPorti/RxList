import { NextResponse } from "next/server";
import { getFloorJob } from "@/lib/floor-agent";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const job = getFloorJob(id);
  if (!job) {
    return NextResponse.json({ status: "error", output: "Trabajo no encontrado." }, { status: 404 });
  }
  return NextResponse.json(job);
}

