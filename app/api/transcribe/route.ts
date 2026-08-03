import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readSession } from "../../../lib/auth";

export const runtime = "nodejs";
export async function POST(req: Request) {
  const session = await readSession((await cookies()).get("rxlist_session")?.value || "");
  if (!session?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const form = await req.formData();
  const audio = form.get("audio");
  if (!(audio instanceof File)) return NextResponse.json({ error: "audio_required" }, { status: 400 });
  if (audio.size > 20 * 1024 * 1024) return NextResponse.json({ error: "audio_too_large" }, { status: 413 });
  const upstream = process.env.WHISPER_URL || "http://localhost:8000";
  const body = new FormData();
  body.append("audio", audio, audio.name || "recording.webm");
  try {
    const headers: HeadersInit = {};
    if (process.env.WHISPER_API_KEY) headers["X-Whisper-Api-Key"] = process.env.WHISPER_API_KEY;
    const response = await fetch(`${upstream}/transcribe`, { method: "POST", headers, body, signal: AbortSignal.timeout(70_000) });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch { return NextResponse.json({ error: "transcription_unavailable" }, { status: 503 }); }
}
