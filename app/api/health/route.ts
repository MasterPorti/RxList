import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "rxlist",
    demo: process.env.DEMO_MODE === "true",
    database: process.env.REDIS_URL ? "redis" : "local-file",
    geminiConfigured: Boolean(process.env.API_GEMINI || process.env.GEMINI_API_KEY),
  });
}
