import { promises as fs } from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "data", "rxlist.json");
const store = JSON.parse(await fs.readFile(file, "utf8"));
const now = new Date();
const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
const datePart = name => parts.find(part => part.type === name)?.value;
const cdmxDate = `${datePart("year")}-${datePart("month")}-${datePart("day")}`;
const cdmx = (hour, minute = 0) => new Date(`${cdmxDate}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-06:00`).toISOString();
const firstPending = new Date(`${cdmxDate}T18:00:00-06:00`);
const cdmxAfterFirst = minutes => new Date(firstPending.getTime() + minutes * 60000).toISOString();
const tasks = [...store.tasks].sort((a, b) => String(a.scheduledAt).localeCompare(String(b.scheduledAt)));
const completed = tasks.filter(task => task.status === "completed" || task.status === "skipped");
const pending = tasks.filter(task => task.status !== "completed" && task.status !== "skipped");

completed.forEach((task, index) => {
  const minutes = 10 * 60 + index * 25;
  task.scheduledAt = cdmx(Math.floor(minutes / 60), minutes % 60);
  task.status = "completed";
  task.completedAt = cdmx(Math.floor(minutes / 60), Math.min((minutes % 60) + 10, 59));
  delete task.startedAt;
});
pending.forEach((task, index) => {
  const minutes = 18 * 60 + index * 30;
  task.scheduledAt = cdmxAfterFirst(index * 30);
  task.status = "pending";
  delete task.startedAt;
  delete task.completedAt;
  delete task.vitalId;
});
store.revision = Number(store.revision || 0) + 1;
await fs.writeFile(file, JSON.stringify(store, null, 2));
console.log(`Demo de enfermería reprogramada en CDMX (${cdmxDate}). Primera tarea pendiente: ${cdmx(18)}. Pendientes: ${pending.length}; realizadas: ${completed.length}.`);
