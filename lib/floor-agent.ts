import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { agyEnabled } from "./agy-status";

export const ALLOWED_FLOORS = [
  "Sin asignar",
  "Piso 1 - Cardiología",
  "Piso 2 - Pediatría",
  "Piso 3 - Urgencias",
  "Piso 4 - Terapia Intensiva",
] as const;

export type Floor = (typeof ALLOWED_FLOORS)[number];
export type FloorJobState =
  | "interpreting"
  | "awaiting_confirmation"
  | "running"
  | "completed"
  | "failed";

interface DbUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: "admin" | "doctor" | "nurse";
  registeredBy?: string;
  assignedFloor?: string;
  [key: string]: unknown;
}

interface Database {
  users: DbUser[];
  groups: unknown[];
  prescriptions: unknown[];
  [key: string]: unknown;
}

export interface FloorJob {
  id: string;
  state: FloorJobState;
  status: "success" | "error";
  output: string;
  transcript: string;
  doctorId: string;
  nurseId?: string;
  nurseName?: string;
  fromFloor?: string;
  toFloor?: Floor;
  createdAt: string;
  finishedAt?: string;
}

interface JobStore {
  jobs: Map<string, FloorJob>;
  activeJobId: string | null;
}

const globalJobs = globalThis as typeof globalThis & { __rxFloorJobs?: JobStore };
const store = globalJobs.__rxFloorJobs ?? { jobs: new Map(), activeJobId: null };
globalJobs.__rxFloorJobs = store;

const root = process.cwd();
const dataPath = path.join(root, "lib", "data.js");
const promptPath = path.join(root, "agent", "prompts", "floor-assignment.md");
const responsesPath = path.join(root, "agent", "responses");
const runtimePath = path.join(root, "agent", "runtime");

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function readDatabase(filePath = dataPath): Promise<Database> {
  const content = await fs.readFile(filePath, "utf8");
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Formato de base de datos inválido.");
  return JSON.parse(content.slice(start, end + 1)) as Database;
}

async function writeDatabase(db: Database, filePath = dataPath) {
  await fs.writeFile(filePath, `export const db = ${JSON.stringify(db, null, 2)};\n`, "utf8");
}

function detectFloor(transcript: string): Floor | null {
  const text = normalize(transcript);
  const matches = ALLOWED_FLOORS.filter((floor) => {
    const normalizedFloor = normalize(floor);
    if (text.includes(normalizedFloor)) return true;
    if (floor === "Sin asignar") return /\bsin asignar\b/.test(text);
    const floorNumber = floor.match(/Piso (\d)/)?.[1];
    const specialty = normalize(floor.split(" - ")[1] ?? "");
    return Boolean(
      (floorNumber && new RegExp(`\\bpiso\\s*(?:numero\\s*)?${floorNumber}\\b`).test(text)) ||
      (specialty && text.includes(specialty)),
    );
  });
  return matches.length === 1 ? matches[0] : null;
}

function detectNurse(transcript: string, nurses: DbUser[]): DbUser[] {
  const text = normalize(transcript);
  const transcriptWords = new Set(text.split(" ").filter(Boolean));
  return nurses.filter((nurse) => {
    const fullName = normalize(nurse.name).replace(/\b(enf|enfermera)\b/g, "").trim();
    if (fullName && text.includes(fullName)) return true;
    const meaningfulParts = fullName.split(" ").filter((part) => part.length >= 3);
    if (meaningfulParts.some((part) => transcriptWords.has(part))) return true;

    // También acepta nombres cortos usados normalmente en voz o chat,
    // por ejemplo “Sofi” para “Sofía Montes”, sin perder la validación
    // posterior que bloquea coincidencias ambiguas.
    const firstName = meaningfulParts[0] ?? "";
    return Array.from(transcriptWords).some(
      (word) => word.length >= 3 && firstName.length >= 4 && firstName.startsWith(word),
    );
  });
}

function hasForbiddenIntent(transcript: string) {
  const text = normalize(transcript);
  return /\b(borra|borrar|elimina|eliminar|password|contrasena|correo|email|rol|receta|usuario|crea|crear)\b/.test(text);
}

export async function createFloorJob(transcript: string, doctorId: string): Promise<FloorJob> {
  const job: FloorJob = {
    id: randomUUID(),
    state: "interpreting",
    status: "success",
    output: "Esperando razonamiento de agy.",
    transcript: transcript.trim(),
    doctorId,
    createdAt: new Date().toISOString(),
  };
  store.jobs.set(job.id, job);

  if (!(await agyEnabled())) return failJob(job, "AGY está apagado por administración. Enciéndelo desde el panel admin.");

  if (!job.transcript || !doctorId) return failJob(job, "Faltan la transcripción o el médico.");
  if (hasForbiddenIntent(job.transcript)) return failJob(job, "La orden contiene una acción no permitida.");

  const db = await readDatabase();
  const nurses = db.users.filter(
    (user) => user.role === "nurse" && user.registeredBy === doctorId,
  );
  const matches = detectNurse(job.transcript, nurses);
  if (matches.length === 0) return failJob(job, "No se encontró una enfermera inequívoca en la orden.");
  if (matches.length > 1) {
    return failJob(job, `El nombre es ambiguo: ${matches.map((nurse) => nurse.name).join(", ")}.`);
  }

  const floor = detectFloor(job.transcript);
  if (!floor) return failJob(job, "No se encontró un único piso válido en la orden.");

  const nurse = matches[0];
  job.nurseId = nurse.id;
  job.nurseName = nurse.name;
  job.fromFloor = nurse.assignedFloor ?? "Sin asignar";
  job.toFloor = floor;
  job.state = "running";
  job.output = "Esperando razonamiento de agy para validar el cambio.";
  void prepareFloorJob(job.id);
  return job;
}

function failJob(job: FloorJob, output: string) {
  job.state = "failed" as const;
  job.status = "error" as const;
  job.output = output;
  job.finishedAt = new Date().toISOString();
  void persistResult(job);
  return job;
}

async function persistResult(job: FloorJob) {
  await fs.mkdir(responsesPath, { recursive: true });
  await fs.writeFile(
    path.join(responsesPath, `${job.id}.json`),
    `${JSON.stringify(job, null, 2)}\n`,
    "utf8",
  );
}

function runAgy(cwd: string, prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const agyPath = process.env.LOCALAPPDATA
      ? `${process.env.LOCALAPPDATA}\\agy\\bin\\agy.exe`
      : "agy";
    const powerShellScript = [
      "$prompt = [Console]::In.ReadToEnd()",
      `$agyPath = '${agyPath.replace(/'/g, "''")}'`,
      `$workspace = '${cwd.replace(/'/g, "''")}'`,
      "$agyArgs = @('--sandbox', '--add-dir', $workspace, '--model', 'Gemini 3.5 Flash (Low)', '--print-timeout', '5m', '-p', $prompt)",
      "& $agyPath $agyArgs",
    ].join("\n");
    const encodedCommand = Buffer.from(powerShellScript, "utf16le").toString("base64");
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-EncodedCommand", encodedCommand],
      { cwd, windowsHide: true, shell: false },
    );
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("agy excedió el límite de 5 minutos."));
    }, 310_000);
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    child.stdin.end(prompt);
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr.trim() || `agy terminó con código ${code}.`));
    });
  });
}

function validateStagedChange(before: Database, after: Database, job: FloorJob) {
  if (!job.nurseId || !job.toFloor) throw new Error("El trabajo no tiene un cambio autorizado.");
  const expected = structuredClone(before);
  const nurse = expected.users.find(
    (user) => user.id === job.nurseId && user.role === "nurse" && user.registeredBy === job.doctorId,
  );
  if (!nurse) throw new Error("La enfermera autorizada ya no existe.");
  nurse.assignedFloor = job.toFloor;
  if (JSON.stringify(expected) !== JSON.stringify(after)) {
    throw new Error("agy intentó realizar cambios fuera de la asignación autorizada.");
  }
}

function getJobRuntimePath(jobId: string) {
  return {
    jobRuntimePath: path.join(runtimePath, jobId),
    stagedDataPath: path.join(runtimePath, jobId, "data.js"),
  };
}

async function prepareFloorJob(jobId: string) {
  const job = store.jobs.get(jobId);
  if (!job || job.state !== "running") return;
  if (store.activeJobId) {
    failJob(job, "Hay otra orden siendo razonada. Intenta de nuevo en unos segundos.");
    return;
  }

  store.activeJobId = job.id;
  const { jobRuntimePath, stagedDataPath } = getJobRuntimePath(job.id);

  try {
    const before = await readDatabase();
    await fs.mkdir(jobRuntimePath, { recursive: true });
    await writeDatabase(before, stagedDataPath);
    const systemPrompt = await fs.readFile(promptPath, "utf8");
    const prompt = `${systemPrompt}\n\n<authorized_change>\nNurse ID: ${job.nurseId}\nTarget floor: ${job.toFloor}\n</authorized_change>\n\n<voice_request>\n${job.transcript}\n</voice_request>`;
    const agentOutput = await runAgy(jobRuntimePath, prompt);
    const parsed = JSON.parse(agentOutput) as { status?: string; output?: string };
    if (parsed.status !== "success") throw new Error(parsed.output || "agy bloqueó la solicitud.");

    const staged = await readDatabase(stagedDataPath);
    validateStagedChange(before, staged, job);

    job.state = "awaiting_confirmation";
    job.status = "success";
    job.output = `Cambio razonado y listo. Autoriza mover a ${job.nurseName} hacia ${job.toFloor}.`;
    await persistResult(job);
  } catch (error) {
    failJob(job, error instanceof Error ? error.message : "agy no pudo razonar la asignación.");
    await fs.rm(jobRuntimePath, { recursive: true, force: true }).catch(() => undefined);
  } finally {
    store.activeJobId = null;
  }
}

export async function executeFloorJob(jobId: string) {
  const job = store.jobs.get(jobId);
  if (!job || job.state !== "awaiting_confirmation") throw new Error("Trabajo no confirmable.");
  if (store.activeJobId) throw new Error("Ya hay otra asignación en ejecución.");

  store.activeJobId = job.id;
  job.state = "running";
  job.output = "Autorización recibida. Aplicando el cambio razonado.";
  const { jobRuntimePath, stagedDataPath } = getJobRuntimePath(job.id);

  try {
    const before = await readDatabase();
    const staged = await readDatabase(stagedDataPath);
    validateStagedChange(before, staged, job);

    const current = await readDatabase();
    if (JSON.stringify(current) !== JSON.stringify(before)) {
      throw new Error("Los datos cambiaron mientras esperabas; no se aplicó la asignación.");
    }
    await writeDatabase(staged);

    job.state = "completed";
    job.status = "success";
    job.output = `Se movió a ${job.nurseName} hacia ${job.toFloor}.`;
    job.finishedAt = new Date().toISOString();
    await persistResult(job);
  } catch (error) {
    failJob(job, error instanceof Error ? error.message : "No se pudo ejecutar la asignación.");
  } finally {
    store.activeJobId = null;
    await fs.rm(jobRuntimePath, { recursive: true, force: true }).catch(() => undefined);
  }
}

export function getFloorJob(jobId: string) {
  return store.jobs.get(jobId) ?? null;
}

export function hasActiveFloorJob() {
  return store.activeJobId !== null;
}
