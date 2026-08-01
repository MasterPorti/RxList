import { randomUUID, scryptSync } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const now = new Date("2026-07-27T15:00:00.000Z");
const iso = (hours = 0) => new Date(now.getTime() + hours * 3600000).toISOString();
const hash = (password, salt) => `${salt}:${scryptSync(password, salt, 32).toString("hex")}`;
const id = () => randomUUID();

const floors = [
  { id: 1, name: "Medicina interna", description: "Atención general y recuperación", beds: 20 },
  { id: 2, name: "Pediatría", description: "Atención pediátrica", beds: 16 },
  { id: 3, name: "Cirugía", description: "Pre y postoperatorio", beds: 18 },
  { id: 4, name: "Urgencias", description: "Atención prioritaria", beds: 12 },
];

const doctorId = id();
const nurseRecords = [
  { name: "Sofía Rivero", email: "sofia.rivero@rxlist.com", floor: 1, birthDate: "1992-04-18" },
  { name: "Pablo Martínez", email: "pablo.martinez@rxlist.com", floor: 2, birthDate: "1988-09-03" },
  { name: "Mariana Torres", email: "mariana.torres@rxlist.com", floor: 3, birthDate: "1994-10-10" },
  { name: "Diego Hernández", email: "diego.hernandez@rxlist.com", floor: 4, birthDate: "1990-01-26" },
  { name: "Laura Gómez", email: "laura.gomez@rxlist.com", floor: 1, birthDate: "1993-03-12" },
  { name: "Andrés Silva", email: "andres.silva@rxlist.com", floor: 2, birthDate: "1989-07-24" },
  { name: "Carmen Ruiz", email: "carmen.ruiz@rxlist.com", floor: 3, birthDate: "1995-05-06" },
  { name: "Ricardo Flores", email: "ricardo.flores@rxlist.com", floor: 4, birthDate: "1987-11-19" },
];
const nurses = nurseRecords.map((n, index) => ({
  id: `demo-nurse-${index + 1}`,
  ...n,
  alias: n.name.split(" ")[0],
  status: "active",
  userId: `demo-nurse-user-${index + 1}`,
  shifts: [],
}));

const patients = [
  { id: "demo-patient-1", fullName: "Ana López García", birthDate: "1985-02-14", reason: "Neumonía adquirida en comunidad", allergies: "Penicilina", emergencyContact: "Luis García", emergencyPhone: "555-0101", floor: 1, bed: 7, admittedAt: iso(-30), status: "admitted", notes: "Monitoreo de saturación." },
  { id: "demo-patient-2", fullName: "Carlos Méndez Ruiz", birthDate: "1972-11-08", reason: "Control posterior a cirugía abdominal", allergies: "Ninguna conocida", emergencyContact: "Elena Ruiz", emergencyPhone: "555-0102", floor: 3, bed: 4, admittedAt: iso(-54), status: "admitted", notes: "Revisión de herida quirúrgica." },
  { id: "demo-patient-3", fullName: "Lucía Hernández Soto", birthDate: "2015-06-21", reason: "Deshidratación por gastroenteritis", allergies: "Ninguna conocida", emergencyContact: "Marta Soto", emergencyPhone: "555-0103", floor: 2, bed: 3, admittedAt: iso(-18), status: "admitted", notes: "Hidratación y vigilancia." },
  { id: "demo-patient-4", fullName: "Roberto Castillo Vega", birthDate: "1964-08-30", reason: "Dolor torácico en evaluación", allergies: "Sulfas", emergencyContact: "Patricia Vega", emergencyPhone: "555-0104", floor: 4, bed: 2, admittedAt: iso(-9), status: "admitted", notes: "Pendiente resultado de estudios." },
  { id: "demo-patient-5", fullName: "Elena Navarro Cruz", birthDate: "1991-12-05", reason: "Migraña con síntomas neurológicos", allergies: "Ninguna conocida", emergencyContact: "Raúl Cruz", emergencyPhone: "555-0105", floor: "unassigned", admittedAt: iso(-120), dischargedAt: iso(-72), dischargeReason: "Mejoría clínica y seguimiento ambulatorio", status: "discharged", notes: "Alta con indicaciones." },
];

const shifts = [
  [nurses[0], 1, "day"], [nurses[1], 2, "day"], [nurses[2], 3, "day"], [nurses[3], 4, "night"],
  [nurses[4], 1, "night"], [nurses[5], 2, "night"], [nurses[6], 3, "night"], [nurses[7], 4, "day"],
].map(([nurse, floor, kind]) => ({ id: id(), nurseId: nurse.id, floor, date: "fixed", kind, startsAt: kind === "day" ? "05:00" : "17:00", endsAt: kind === "day" ? "17:00" : "05:00", status: "scheduled" }));
shifts.forEach((shift) => nurses.find((n) => n.id === shift.nurseId).shifts.push(shift.id));

const medications = [
  { id: "demo-med-1", patientId: patients[0].id, name: "Ceftriaxona", dose: "1 g IV", times: ["08:00", "20:00"], startDate: "2026-07-26", floor: 1, nurseId: nurses[0].id, status: "active", notes: "Revisar alergias antes de administrar." },
  { id: "demo-med-2", patientId: patients[1].id, name: "Paracetamol", dose: "500 mg VO", times: ["08:00", "14:00", "20:00"], startDate: "2026-07-25", floor: 3, nurseId: nurses[2].id, status: "active" },
  { id: "demo-med-3", patientId: patients[2].id, name: "Solución Hartmann", dose: "500 ml IV", times: ["09:00", "17:00"], startDate: "2026-07-27", floor: 2, nurseId: nurses[1].id, status: "active" },
  { id: "demo-med-4", patientId: patients[4].id, name: "Ibuprofeno", dose: "400 mg VO", times: ["08:00", "20:00"], startDate: "2026-07-20", endDate: "2026-07-22", floor: 1, status: "cancelled", notes: "Tratamiento completado al alta." },
];

const tasks = medications.flatMap((medication) => medication.status === "active" ? medication.times.map((time, index) => ({ id: id(), patientId: medication.patientId, medicationId: medication.id, title: `Administrar ${medication.name} (${medication.dose})`, scheduledAt: `2026-07-27T${time}:00.000Z`, nurseId: medication.nurseId, floor: medication.floor, status: index === 0 && medication.id === "demo-med-1" ? "completed" : "pending", notes: "Confirmar paciente y dosis." })) : []);

const doctor = { id: doctorId, name: "Dra. Erika Ramírez", email: "erika@rxlist.com", passwordHash: hash("RXList-Doctor-2026!", "demo-doctor-salt"), role: "doctor", nurses };
const users = [
  { id: "admin", name: "Administración", email: "admin@rxlist.local", passwordHash: hash("RXList-Admin-2026!", "rxlist-admin-salt"), role: "admin" },
  doctor,
  ...nurses.map((nurse, index) => ({ id: nurse.userId, name: nurse.name, email: nurse.email, passwordHash: hash(`RXList-Nurse-${index + 1}-2026!`, `demo-nurse-salt-${index + 1}`), role: "nurse", nurseId: nurse.id, mustChangePassword: false })),
];

const audit = [
  { id: id(), actorId: doctorId, actorRole: "doctor", action: "seed", entity: "system", details: { message: "Datos demo iniciales" }, at: iso(-36) },
  ...patients.map((patient) => ({ id: id(), actorId: doctorId, actorRole: "doctor", action: "create", entity: "patient", entityId: patient.id, details: { reason: patient.reason, floor: patient.floor, bed: patient.bed }, at: patient.admittedAt })),
];

const store = { schemaVersion: 2, revision: 1, users, floors, patients, shifts, medications, tasks, vitals: [], audit, chatHistory: {} };
await mkdir(path.join(root, "data"), { recursive: true });
await writeFile(path.join(root, "data", "rxlist.json"), JSON.stringify(store, null, 2));
console.log(`Datos demo cargados: ${patients.length} pacientes, ${nurses.length} enfermeros, ${medications.length} tratamientos.`);
console.log("Doctor: erika@rxlist.com / RXList-Doctor-2026!");
console.log("Admin: admin@rxlist.local / RXList-Admin-2026!");
