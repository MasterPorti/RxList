import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { agyEnabled } from "../../../lib/agy-status";

export const runtime = "nodejs";

const RXBOT_MODEL = "Gemini 3.5 Flash (Low)";
const AGY_TIMEOUT_MS = 120_000;
const ALLOWED_FLOORS = [
  "Sin asignar",
  "Piso 1 - Cardiología",
  "Piso 2 - Pediatría",
  "Piso 3 - Urgencias",
  "Piso 4 - Terapia Intensiva",
] as const;

interface DbUser {
  id: string;
  name: string;
  role: "admin" | "doctor" | "nurse";
  registeredBy?: string;
  assignedFloor?: string;
}

interface Database {
  users: DbUser[];
}

function extractTextFromMessage(message: unknown): string {
  if (!message || typeof message !== "object") return "";
  const maybeMessage = message as { content?: unknown; parts?: unknown };

  if (typeof maybeMessage.content === "string") {
    return maybeMessage.content;
  }

  if (!Array.isArray(maybeMessage.parts)) {
    return "";
  }

  return maybeMessage.parts
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      const maybePart = part as { type?: unknown; text?: unknown };
      return maybePart.type === "text" && typeof maybePart.text === "string" ? maybePart.text : "";
    })
    .join("\n")
    .trim();
}

function getLatestUserText(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const maybeBody = body as { messages?: unknown };
  if (!Array.isArray(maybeBody.messages)) return "";

  const latestUserMessage = [...maybeBody.messages]
    .reverse()
    .find((message) => {
      if (!message || typeof message !== "object") return false;
      return (message as { role?: unknown }).role === "user";
    });

  return extractTextFromMessage(latestUserMessage);
}

function getConversationText(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const maybeBody = body as { messages?: unknown };
  if (!Array.isArray(maybeBody.messages)) return "";

  return maybeBody.messages
    .slice(-8)
    .map((message) => {
      if (!message || typeof message !== "object") return "";
      const role = (message as { role?: unknown }).role === "user" ? "Usuario" : "RxBot";
      const text = extractTextFromMessage(message);
      return text ? `${role}: ${text}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

async function readDatabase(): Promise<Database> {
  const dataPath = path.join(process.cwd(), "lib", "data.js");
  const content = await fs.readFile(dataPath, "utf8");
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Formato de base de datos inválido.");
  return JSON.parse(content.slice(start, end + 1)) as Database;
}

async function getDoctorContext(doctorId: unknown) {
  const db = await readDatabase();
  const doctorIdText = typeof doctorId === "string" ? doctorId : "";
  const nurses = db.users
    .filter((user) => user.role === "nurse" && (!doctorIdText || user.registeredBy === doctorIdText))
    .map((nurse) => ({
      id: nurse.id,
      name: nurse.name,
      assignedFloor: nurse.assignedFloor ?? "Sin asignar",
    }));

  return { floors: ALLOWED_FLOORS, nurses };
}

function runAgyWithGemini(userMessage: string, conversationText: string, context: Awaited<ReturnType<typeof getDoctorContext>>): Promise<string> {
  return new Promise((resolve, reject) => {
    const agyPath = process.env.LOCALAPPDATA
      ? `${process.env.LOCALAPPDATA}\\agy\\bin\\agy.exe`
      : "agy";
    const prompt = [
      "Eres RxBot, un asistente breve y útil dentro de una app médica de desarrollo.",
      "Responde en español claro, con tono profesional y amable.",
      "No modifiques archivos ni ejecutes acciones; solo responde el mensaje del usuario.",
      "Sí puedes explicar qué enfermeras existen, en qué piso están y qué pisos son válidos usando el contexto.",
      "Si el usuario pide cambiar una enfermera de piso, responde que prepararás el cambio y que debe confirmarlo en la tarjeta de confirmación de la app. No digas que ya lo cambiaste.",
      "Si el nombre de enfermera o el piso no aparece claro, pide una aclaración breve.",
      "",
      "Pisos válidos:",
      context.floors.map((floor) => `- ${floor}`).join("\n"),
      "",
      "Enfermeras disponibles del doctor actual:",
      context.nurses.length
        ? context.nurses.map((nurse) => `- ${nurse.name}: ${nurse.assignedFloor}`).join("\n")
        : "- No hay enfermeras registradas para este doctor.",
      "",
      "Conversación reciente:",
      conversationText || "Sin conversación previa.",
      "",
      `Mensaje del usuario: ${userMessage}`,
    ].join("\n");
    const powerShellScript = [
      "$prompt = [Console]::In.ReadToEnd()",
      `$agyPath = '${agyPath.replace(/'/g, "''")}'`,
      `$agyArgs = @('--sandbox', '--model', '${RXBOT_MODEL}', '--print-timeout', '2m', '-p', $prompt)`,
      "& $agyPath $agyArgs",
    ].join("\n");
    const encodedCommand = Buffer.from(powerShellScript, "utf16le").toString("base64");

    const child = spawn("powershell.exe", [
      "-NoProfile",
      "-EncodedCommand",
      encodedCommand,
    ], {
      cwd: process.cwd(),
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error("RxBot tardó demasiado en responder."));
    }, AGY_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.stdin.end(prompt);

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (code !== 0) {
        reject(new Error(stderr || `agy terminó con código ${code}.`));
        return;
      }

      resolve(stdout.trim() || "Listo.");
    });
  });
}

export async function POST(request: Request) {
  try {
    if (!(await agyEnabled())) return new Response("AGY está apagado por administración.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    const body = await request.json();
    const userMessage = getLatestUserText(body);
    const conversationText = getConversationText(body);
    const doctorContext = await getDoctorContext((body as { doctorId?: unknown }).doctorId);

    if (!userMessage) {
      return new Response("No recibí un mensaje para RxBot.", {
        status: 400,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const answer = await runAgyWithGemini(userMessage, conversationText, doctorContext);

    return new Response(answer, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "RxBot no pudo responder.";
    return new Response(message, {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
