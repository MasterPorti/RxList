import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getStore } from "./store";

const run = promisify(execFile);
export const agyEnabled = async () => (await getStore()).settings?.agyEnabled ?? true;

export async function checkAgy() {
  const enabled = await agyEnabled();
  const model = process.env.AGY_MODEL || "Gemini 3.5 Flash (Low)";
  const bin = process.env.AGY_BIN || "/home/porti/.local/bin/agy";
  if (!enabled) return { status: "disabled" as const, enabled, model, binary: bin };
  const started = Date.now();
  try {
    const result = await run(bin, ["--model", model, "--print", "Responde únicamente AGY_HEALTH_OK"], { cwd: "/tmp", timeout: 15_000, maxBuffer: 16 * 1024 });
    const output = result.stdout.trim();
    return { status: output ? "operational" as const : "unavailable" as const, enabled, model, binary: bin, latencyMs: Date.now() - started, output: output.slice(0, 80) };
  } catch (error) {
    return { status: "unavailable" as const, enabled, model, binary: bin, latencyMs: Date.now() - started, error: error instanceof Error ? error.message : "agy_unavailable" };
  }
}
