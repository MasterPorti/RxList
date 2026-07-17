import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const children = [];

function start(label, command, args) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
  });

  children.push(child);
  child.on("error", (error) => {
    console.error(`[${label}] No se pudo iniciar: ${error.message}`);
    shutdown(1);
  });
  child.on("exit", (code, signal) => {
    if (!stopping && code !== 0) {
      console.error(`[${label}] terminó inesperadamente (${signal ?? code}).`);
      shutdown(code ?? 1);
    }
  });
}

let stopping = false;
function shutdown(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  setTimeout(() => process.exit(exitCode), 250);
}

process.on("SIGINT", () => shutdown());
process.on("SIGTERM", () => shutdown());

console.log("Iniciando RxList y el servicio local de Whisper...");
start("Whisper", "python", ["whisper_server.py"]);
start("Next.js", process.execPath, [nextBin, "dev"]);
