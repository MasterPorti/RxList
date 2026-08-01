import { randomUUID, scryptSync } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const file = "data/rxlist.json";
const store = JSON.parse(await readFile(file, "utf8"));
const doctor = store.users.find(user => user.role === "doctor");
if (!doctor) throw new Error("No se encontró el doctor demo.");

const hash = (password, salt) => `${salt}:${scryptSync(password, salt, 32).toString("hex")}`;
const staffing = [
  { id: "demo-nurse-5", userId: "demo-nurse-user-5", name: "Laura Gómez", email: "laura.gomez@rxlist.com", birthDate: "1993-03-12", floor: 1, kind: "night" },
  { id: "demo-nurse-6", userId: "demo-nurse-user-6", name: "Andrés Silva", email: "andres.silva@rxlist.com", birthDate: "1989-07-24", floor: 2, kind: "night" },
  { id: "demo-nurse-7", userId: "demo-nurse-user-7", name: "Carmen Ruiz", email: "carmen.ruiz@rxlist.com", birthDate: "1995-05-06", floor: 3, kind: "night" },
  { id: "demo-nurse-8", userId: "demo-nurse-user-8", name: "Ricardo Flores", email: "ricardo.flores@rxlist.com", birthDate: "1987-11-19", floor: 4, kind: "day" },
];

// Limpia turnos duplicados o incompatibles de la demo: una persona y un piso
// solo pueden conservar un turno válido.
const usedNurses = new Set();
const usedSlots = new Set();
store.shifts = store.shifts.filter(shift => {
  if (shift.status !== "scheduled") return true;
  const slot = `${shift.floor}-${shift.kind}`;
  if (usedNurses.has(shift.nurseId) || usedSlots.has(slot)) return false;
  usedNurses.add(shift.nurseId);
  usedSlots.add(slot);
  return true;
});
for (const nurse of doctor.nurses) nurse.shifts = [];
for (const shift of store.shifts) doctor.nurses.find(nurse => nurse.id === shift.nurseId)?.shifts.push(shift.id);

for (const item of staffing) {
  let nurse = doctor.nurses.find(candidate => candidate.id === item.id);
  if (!nurse) {
    nurse = { id: item.id, userId: item.userId, name: item.name, email: item.email, birthDate: item.birthDate, floor: item.floor, status: "active", shifts: [] };
    doctor.nurses.push(nurse);
  }
  if (!store.users.some(user => user.id === item.userId)) store.users.push({ id: item.userId, name: item.name, email: item.email, passwordHash: hash(`RXList-Nurse-${item.id.slice(-1)}-2026!`, `demo-nurse-salt-${item.id.slice(-1)}`), role: "nurse", nurseId: item.id, mustChangePassword: false });
  const slot = `${item.floor}-${item.kind}`;
  if (!store.shifts.some(shift => shift.status === "scheduled" && shift.floor === item.floor && shift.kind === item.kind)) {
    const shift = { id: randomUUID(), nurseId: item.id, floor: item.floor, date: "fixed", kind: item.kind, startsAt: item.kind === "day" ? "05:00" : "17:00", endsAt: item.kind === "day" ? "17:00" : "05:00", status: "scheduled" };
    store.shifts.push(shift);
    nurse.shifts.push(shift.id);
    usedNurses.add(item.id);
    usedSlots.add(slot);
  }
}

store.revision++;
await writeFile(file, JSON.stringify(store, null, 2));
console.log(`Plantilla lista: ${doctor.nurses.length} enfermeros y ${store.shifts.filter(shift => shift.status === "scheduled").length} turnos.`);
