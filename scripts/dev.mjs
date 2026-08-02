import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
let child;

function start() {
  child = spawn(process.execPath, [nextBin, "dev"], {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
  });

  child.on("error", (error) => { console.error(`Next.js no se pudo iniciar: ${error.message}`); shutdown(1); });
  child.on("exit", (code) => { if (!stopping && code !== 0) shutdown(code ?? 1); });
}

let stopping = false;
function shutdown(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  if (child && !child.killed) child.kill();
  setTimeout(() => process.exit(exitCode), 250);
}

process.on("SIGINT", () => shutdown());
process.on("SIGTERM", () => shutdown());

console.log("Iniciando RxList con Next.js...");
start();
