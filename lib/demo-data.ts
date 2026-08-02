import { hashPassword } from "./auth";
import type { Store } from "./types";

export function demoStore(): Store {
  const nurses = [
    { id: "demo-nurse-1", name: "Sofía Rivero", email: "sofia.rivero@rxlist.com", floor: 1 as const, birthDate: "1992-04-18", status: "active" as const, userId: "demo-nurse-user-1", shifts: ["demo-shift-1"] },
    { id: "demo-nurse-2", name: "Pablo Martínez", email: "pablo.martinez@rxlist.com", floor: 2 as const, birthDate: "1988-09-03", status: "active" as const, userId: "demo-nurse-user-2", shifts: ["demo-shift-2"] },
    { id: "demo-nurse-3", name: "Mariana Torres", email: "mariana.torres@rxlist.com", floor: 3 as const, birthDate: "1994-10-10", status: "active" as const, userId: "demo-nurse-user-3", shifts: ["demo-shift-3"] },
    { id: "demo-nurse-4", name: "Diego Hernández", email: "diego.hernandez@rxlist.com", floor: 4 as const, birthDate: "1990-01-26", status: "active" as const, userId: "demo-nurse-user-4", shifts: ["demo-shift-4"] },
  ];
  const patients = [
    { id: "demo-patient-1", fullName: "Ana López García", birthDate: "1985-02-14", reason: "Neumonía adquirida en comunidad", allergies: "Penicilina", emergencyContact: "Luis García", emergencyPhone: "555-0101", floor: 1 as const, bed: 7, admittedAt: "2026-07-26T03:00:00.000Z", status: "admitted" as const, notes: "Monitoreo de saturación." },
    { id: "demo-patient-2", fullName: "Carlos Méndez Ruiz", birthDate: "1972-11-08", reason: "Control posterior a cirugía abdominal", allergies: "Ninguna conocida", emergencyContact: "Elena Ruiz", emergencyPhone: "555-0102", floor: 3 as const, bed: 4, admittedAt: "2026-07-25T03:00:00.000Z", status: "admitted" as const, notes: "Revisión de herida quirúrgica." },
    { id: "demo-patient-3", fullName: "Lucía Hernández Soto", birthDate: "2015-06-21", reason: "Deshidratación por gastroenteritis", allergies: "Ninguna conocida", emergencyContact: "Marta Soto", emergencyPhone: "555-0103", floor: 2 as const, bed: 3, admittedAt: "2026-07-27T03:00:00.000Z", status: "admitted" as const, notes: "Hidratación y vigilancia." },
    { id: "demo-patient-4", fullName: "Roberto Castillo Vega", birthDate: "1964-08-30", reason: "Dolor torácico en evaluación", allergies: "Sulfas", emergencyContact: "Patricia Vega", emergencyPhone: "555-0104", floor: 4 as const, bed: 2, admittedAt: "2026-07-27T12:00:00.000Z", status: "admitted" as const, notes: "Pendiente resultado de estudios." },
  ];
  const floors = [
    { id: 1 as const, name: "Medicina interna", description: "Atención general y recuperación", beds: 20 },
    { id: 2 as const, name: "Pediatría", description: "Atención pediátrica", beds: 16 },
    { id: 3 as const, name: "Cirugía", description: "Pre y postoperatorio", beds: 18 },
    { id: 4 as const, name: "Urgencias", description: "Atención prioritaria", beds: 12 },
  ];
  const doctorId = "demo-doctor";
  const doctor = { id: doctorId, name: "Dra. Erika Ramírez", email: "erika@rxlist.com", passwordHash: hashPassword("RXList-Doctor-2026!", "demo-doctor-salt"), role: "doctor" as const, nurses };
  const medications = [
    { id: "demo-med-1", patientId: patients[0].id, name: "Ceftriaxona", dose: "1 g IV", times: ["08:00", "20:00"], startDate: "2026-07-26", floor: 1 as const, nurseId: nurses[0].id, status: "active" as const, notes: "Revisar alergias antes de administrar." },
    { id: "demo-med-2", patientId: patients[1].id, name: "Paracetamol", dose: "500 mg VO", times: ["08:00", "14:00", "20:00"], startDate: "2026-07-25", floor: 3 as const, nurseId: nurses[2].id, status: "active" as const },
    { id: "demo-med-3", patientId: patients[2].id, name: "Solución Hartmann", dose: "500 ml IV", times: ["09:00", "17:00"], startDate: "2026-07-27", floor: 2 as const, nurseId: nurses[1].id, status: "active" as const },
  ];
  const tasks = [
    { id: "demo-task-1", patientId: patients[0].id, medicationId: medications[0].id, title: "Administrar Ceftriaxona (1 g IV)", scheduledAt: "2026-07-29T14:00:00.000Z", nurseId: nurses[0].id, floor: 1 as const, status: "completed" as const, notes: "Confirmar paciente y dosis." },
    { id: "demo-task-2", patientId: patients[0].id, medicationId: medications[0].id, title: "Administrar Ceftriaxona (1 g IV)", scheduledAt: "2026-07-29T20:00:00.000Z", nurseId: nurses[0].id, floor: 1 as const, status: "pending" as const, notes: "Confirmar paciente y dosis." },
    { id: "demo-task-3", patientId: patients[1].id, medicationId: medications[1].id, title: "Administrar Paracetamol (500 mg VO)", scheduledAt: "2026-07-30T14:00:00.000Z", nurseId: nurses[2].id, floor: 3 as const, status: "completed" as const },
    { id: "demo-task-4", patientId: patients[1].id, medicationId: medications[1].id, title: "Administrar Paracetamol (500 mg VO)", scheduledAt: "2026-07-30T20:00:00.000Z", nurseId: nurses[2].id, floor: 3 as const, status: "pending" as const },
    { id: "demo-task-5", patientId: patients[2].id, medicationId: medications[2].id, title: "Administrar Solución Hartmann (500 ml IV)", scheduledAt: "2026-07-31T17:00:00.000Z", nurseId: nurses[1].id, floor: 2 as const, status: "completed" as const },
    { id: "demo-task-6", patientId: patients[3].id, title: "Revisar signos vitales", scheduledAt: "2026-08-02T16:00:00.000Z", nurseId: nurses[3].id, floor: 4 as const, status: "pending" as const, notes: "Tarea de demostración." },
  ];
  return { schemaVersion: 3, revision: 1, users: [{ id: "admin", name: "Administración", email: "admin@rxlist.local", passwordHash: hashPassword("RXList-Admin-2026!", "rxlist-admin-salt"), role: "admin" as const }, doctor, ...nurses.map((nurse, index) => ({ id: nurse.userId, name: nurse.name, email: nurse.email, passwordHash: hashPassword(`RXList-Nurse-${index + 1}-2026!`, `demo-nurse-salt-${index + 1}`), role: "nurse" as const, nurseId: nurse.id, mustChangePassword: false }))], floors, patients, shifts: nurses.map((nurse, index) => ({ id: `demo-shift-${index + 1}`, nurseId: nurse.id, floor: nurse.floor, date: "fixed", kind: index % 2 ? "night" as const : "day" as const, startsAt: index % 2 ? "17:00" : "05:00", endsAt: index % 2 ? "05:00" : "17:00", status: "scheduled" as const })), medications, tasks, vitals: [{ id: "demo-vital-1", taskId: tasks[0].id, patientId: patients[0].id, temperature: "37.4", bloodPressure: "122/78", heartRate: "82", respiratoryRate: "16", oxygenSaturation: "97", notes: "Paciente estable.", recordedBy: nurses[0].userId, recordedAt: "2026-07-29T14:05:00.000Z" }, { id: "demo-vital-2", taskId: tasks[2].id, patientId: patients[1].id, temperature: "36.9", bloodPressure: "118/76", heartRate: "78", respiratoryRate: "15", oxygenSaturation: "98", notes: "Evolución favorable.", recordedBy: nurses[2].userId, recordedAt: "2026-07-30T14:05:00.000Z" }], audit: [], chatHistory: {}, settings: { agyEnabled: true } };
}
