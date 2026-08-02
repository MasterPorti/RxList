import { Plan, type Doctor, type Store } from "./types";
import { buildAgyPrompt } from "./agy";

const encoder = new TextEncoder();
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function parseJson(value: string) {
  const raw = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try { return JSON.parse(raw); } catch {
    const start = raw.indexOf("{"); const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
    throw new Error("gemini_invalid_json");
  }
}

function parseGeminiPlan(value: string) {
  const data = parseJson(value) as any;
  if (!data || typeof data !== "object") throw new Error("gemini_invalid_plan");
  const incomingIntent = String(data.intent || "");
  if (incomingIntent === "create_entity" || incomingIntent === "add_entity") {
    const candidate = data.patient || data.entity || data.data || {};
    const extracted = { fullName: candidate.fullName || candidate.name || data.fullName || data.name, birthDate: candidate.birthDate || data.birthDate, reason: candidate.reason || data.reason, allergies: candidate.allergies || data.allergies, emergencyContact: candidate.emergencyContact || data.emergencyContact, emergencyPhone: candidate.emergencyPhone || data.emergencyPhone, floor: candidate.floor || data.floor };
    if (Object.values(extracted).some(value => value !== undefined && value !== "")) {
      data.intent = "create_patient";
      data.type = "clarification";
      data.message = data.message || "Tengo algunos datos del paciente. Completa los campos faltantes.";
      data.operations = [{ action: "create_patient", ...extracted }];
    } else {
      data.type = "clarification";
      data.intent = undefined;
      data.message = "¿Quieres agregarlo como paciente o como enfermero?";
      data.missing = ["entityType"];
      data.operations = [];
    }
  }
  const validIntents = new Set(["create_nurse", "move_nurse", "update_floor", "create_patient", "assign_patient", "move_patient", "discharge_patient", "create_shift", "check_availability", "create_medication", "create_task", "complete_task", "query_floor", "query_patient"]);
  if (data.intent !== undefined && !validIntents.has(String(data.intent))) data.intent = undefined;
  if (!["proposal", "clarification", "rejected", "no_change"].includes(data.type)) data.type = Array.isArray(data.operations) && data.operations.length ? "proposal" : "clarification";
  if (typeof data.message !== "string") data.message = "Gemini devolvió una respuesta sin mensaje.";
  if (data.missing != null && !Array.isArray(data.missing)) data.missing = [String(data.missing)];
  if (!Array.isArray(data.operations)) data.operations = [];
  if (data.operations.some((operation: any) => operation?.action === "create_entity" || operation?.action === "add_entity")) {
    const source = data.operations.find((operation: any) => operation?.action === "create_entity" || operation?.action === "add_entity") || {};
    if (source.fullName || source.name || source.birthDate || source.reason || source.allergies) {
      data.type = "clarification";
      data.intent = "create_patient";
      data.operations = data.operations.map((operation: any) => operation.action === "create_entity" || operation.action === "add_entity" ? { ...operation, action: "create_patient", fullName: operation.fullName || operation.name } : operation);
    } else {
      data.type = "clarification";
      data.message = "¿Quieres agregarlo como paciente o como enfermero?";
      data.missing = ["entityType"];
      data.operations = [];
    }
  }
  data.operations = data.operations.map((operation: any) => ({ ...operation, action: operation.action || data.intent }));
  return Plan.parse(data);
}

async function callGemini(key: string, method: "generateContent" | "streamGenerateContent", prompt: string, signal: AbortSignal) {
  let lastResponse: Response | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || "gemini-3.1-flash-lite"}:${method}?alt=${method === "streamGenerateContent" ? "sse" : "json"}&key=${encodeURIComponent(key)}`, {
      method: "POST", signal, headers: { "content-type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, responseMimeType: "application/json" } }),
    });
    if (response.status !== 429 || attempt === 2) return response;
    lastResponse = response;
    await sleep(1000 * 2 ** attempt);
  }
  return lastResponse!;
}

export async function proposeWithGemini(message: string, doctor: Doctor, context?: Pick<Store, "floors" | "patients" | "shifts" | "medications" | "tasks">) {
  const key = process.env.API_GEMINI || process.env.GEMINI_API_KEY;
  if (!key) throw new Error("API_GEMINI no está configurada");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.GEMINI_TIMEOUT_MS || 30_000));
  try {
    const response = await callGemini(key, "generateContent", buildAgyPrompt(message, doctor, context), controller.signal);
    if (!response.ok) throw new Error(`Gemini API ${response.status}`);
    const body = await response.json() as any;
    const text = body.candidates?.[0]?.content?.parts?.map((part: any) => part.text || "").join("") || "";
    return { proposal: parseGeminiPlan(text), provider: "gemini" as const };
  } catch (error) {
    console.error("[RXList] Gemini API request failed", error);
    return { proposal: Plan.parse({ type: "clarification", message: "No pude conectar con Gemini API. No se realizó ningún cambio. Verifica tu API key y vuelve a intentarlo.", operations: [] }), provider: "gemini-unavailable" as const };
  } finally { clearTimeout(timeout); }
}

export function streamGeminiProposal(message: string, doctor: Doctor, context: Pick<Store, "floors" | "patients" | "shifts" | "medications" | "tasks">, onComplete: (proposal: ReturnType<typeof Plan.parse>) => Promise<unknown>) {
  const key = process.env.API_GEMINI || process.env.GEMINI_API_KEY;
  if (!key) throw new Error("API_GEMINI no está configurada");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.GEMINI_TIMEOUT_MS || 30_000));
  const stream = new ReadableStream<Uint8Array>({
    async start(readable) {
      const send = (event: string, payload: unknown) => readable.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
      try {
        send("start", { provider: "gemini", model: process.env.GEMINI_MODEL || "gemini-3.1-flash-lite" });
        const response = await callGemini(key, "streamGenerateContent", buildAgyPrompt(message, doctor, context), controller.signal);
        if (!response.ok || !response.body) throw new Error(`Gemini API ${response.status}`);
        const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ""; let fullText = "";
        while (true) {
          const part = await reader.read(); if (part.done) break;
          buffer += decoder.decode(part.value, { stream: true }).replace(/\r\n/g, "\n");
          const lines = buffer.split("\n"); buffer = lines.pop() || "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim(); if (!data || data === "[DONE]") continue;
            const chunk = JSON.parse(data); const text = chunk.candidates?.[0]?.content?.parts?.map((item: any) => item.text || "").join("") || "";
            if (text) { fullText += text; send("delta", { text }); }
          }
        }
        const proposal = parseGeminiPlan(fullText);
        const completed = await onComplete(proposal);
        send("done", { proposal: completed || proposal, provider: "gemini" }); readable.close();
      } catch (error) { console.error("[RXList] Gemini streaming failed", error); send("error", { message: error instanceof Error ? error.message : "Gemini API no disponible" }); readable.close(); }
      finally { clearTimeout(timeout); }
    },
  });
  return stream;
}
