import { hashPassword } from "./auth";
import type { Store } from "./types";

function baseDemoStore(): Store {
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
  return { schemaVersion: 3, revision: 1, users: [{ id: "admin", name: "Administración", email: "admin@rxlist.local", passwordHash: hashPassword("RXList-Admin-2026!", "rxlist-admin-salt"), role: "admin" as const }, doctor, ...nurses.map((nurse, index) => ({ id: nurse.userId, name: nurse.name, email: nurse.email, passwordHash: hashPassword(`RXList-Nurse-${index + 1}-2026!`, `demo-nurse-salt-${index + 1}`), role: "nurse" as const, nurseId: nurse.id, mustChangePassword: false }))], floors, patients, shifts: nurses.map((nurse, index) => ({ id: `demo-shift-${index + 1}`, nurseId: nurse.id, floor: nurse.floor, date: "fixed", kind: index % 2 ? "night" as const : "day" as const, startsAt: index % 2 ? "17:00" : "05:00", endsAt: index % 2 ? "05:00" : "17:00", status: "scheduled" as const })), medications, tasks, vitals: [{ id: "demo-vital-1", taskId: tasks[0].id, patientId: patients[0].id, temperature: "37.4", bloodPressure: "122/78", heartRate: "82", respiratoryRate: "16", oxygenSaturation: "97", notes: "Paciente estable.", recordedBy: nurses[0].userId, recordedAt: "2026-07-29T14:05:00.000Z" }, { id: "demo-vital-2", taskId: tasks[2].id, patientId: patients[1].id, temperature: "36.9", bloodPressure: "118/76", heartRate: "78", respiratoryRate: "15", oxygenSaturation: "98", notes: "Evolución favorable.", recordedBy: nurses[2].userId, recordedAt: "2026-07-30T14:05:00.000Z" }], messages: [], audit: [], chatHistory: {}, settings: { agyEnabled: true } };
}

const expandedNames = [
  "María Fernanda Salgado", "Jorge Alberto Pineda", "Patricia Gómez Ríos", "Héctor Iván Morales", "Teresa del Carmen Ruiz", "Óscar Ramírez Luna", "Gabriela Torres León", "Samuel Navarro Cárdenas", "Lorena Beatriz Campos", "Arturo Sebastián Cruz", "Beatriz Elena Moreno", "Mónica Alejandra Fuentes", "Rafael Tomás Ibarra",
  "Marta Sofía Castillo", "Diego Emiliano Vargas", "Valentina Ortega Cruz", "Mateo Alejandro Flores", "Regina Méndez Soto", "Sofía Guadalupe Reyes", "Emiliano Torres Silva", "Camila Andrea Núñez", "Daniela Marín López", "Tomás Alejandro Ríos", "Julia Fernanda Molina", "Nicolás Eduardo Lara",
  "Fernando Quiroz Beltrán", "Nadia Isabel Campos", "Miguel Ángel Rosales", "Carolina Jiménez Pardo", "Raúl Esteban Valdés", "Silvia Navarro Peña", "Eduardo Castañeda", "Marisol Vega Santillán", "Adriana Patricia León", "Óscar Javier Molina", "Claudia Beatriz Serrano", "Felipe Andrés Duarte", "Irene Valeria Campos",
  "Ismael Mendoza Ortiz", "Verónica Salas Núñez", "Alberto Villanueva", "Rocío Belén Acosta", "Esteban Mauricio Ríos", "Laura Isabel Cárdenas", "Hugo Daniel Pacheco", "Natalia Fernanda Soto", "Mauricio Ángel Reyes", "Cecilia Torres Vázquez"
];
const expandedReasons = [
  "Neumonía adquirida en comunidad", "Insuficiencia cardiaca descompensada", "Diabetes mellitus tipo 2 descontrolada", "Pielonefritis complicada", "Anemia sintomática en estudio", "Crisis hipertensiva controlada", "Bronquiolitis viral", "Apendicitis en observación", "Fiebre sin foco", "Asma con sibilancias", "Postoperatorio de colecistectomía", "Fractura de tibia postoperatorio", "Dolor abdominal agudo", "Reacción alérgica en observación", "Arritmia sintomática"
];

export function expandDemoStore(store: Store): Store {
  if (!store.patients.length) return expandDemoStore(baseDemoStore());
  const demoPatients = store.patients.every(patient => String(patient.id).startsWith("demo-") || String(patient.id).startsWith("bulk-"));
  if (!demoPatients || store.patients.filter(patient => patient.status !== "discharged").length >= 50) return store;
  const targets = new Map([[1, 14], [2, 13], [3, 13], [4, 10]]);
  const nurses = (store.users.find(user => user.role === "doctor") as any)?.nurses || [];
  const usedBeds = new Map<number, Set<number>>([1, 2, 3, 4].map(floor => [floor, new Set(store.patients.filter(patient => patient.floor === floor && patient.status !== "discharged" && patient.bed).map(patient => Number(patient.bed)))]));
  const floorCounts = (floor: number) => store.patients.filter(patient => patient.status !== "discharged" && patient.floor === floor).length;
  const floors = [1, 2, 3, 4];
  expandedNames.forEach((fullName, index) => {
    const floor = floors.find(candidate => floorCounts(candidate) < (targets.get(candidate) || 0));
    if (!floor) return;
    const floorRecord = store.floors.find(item => item.id === floor);
    const bed = Array.from({ length: floorRecord?.beds || 20 }, (_, position) => position + 1).find(candidate => !usedBeds.get(floor)?.has(candidate));
    if (!bed) return;
    usedBeds.get(floor)?.add(bed);
    const nurse = nurses.find((item: any) => item.floor === floor && item.status !== "inactive") || nurses[0];
    const patientId = `bulk-demo-patient-${index + 1}`;
    const reason = expandedReasons[index % expandedReasons.length];
    const pediatric = floor === 2;
    const birthYear = pediatric ? 2010 + (index % 11) : 1945 + (index % 48);
    store.patients.push({ id: patientId, fullName, birthDate: `${birthYear}-${String((index % 12) + 1).padStart(2, "0")}-${String((index % 27) + 1).padStart(2, "0")}`, reason, allergies: index % 7 === 0 ? "Penicilina" : "Ninguna conocida", emergencyContact: `Contacto de ${fullName.split(" ").at(-1)}`, emergencyPhone: `555-${String(3000 + index).slice(-4)}`, floor: floor as 1 | 2 | 3 | 4, bed, admittedAt: `2026-08-${String((index % 5) + 1).padStart(2, "0")}T${String((index % 10) + 8).padStart(2, "0")}:00:00.000Z`, status: "admitted", notes: "Registro demo ampliado para presentación clínica." } as any);
    const medicationId = `bulk-demo-med-${index + 1}`;
    const taskId = `bulk-demo-task-${index + 1}`;
    store.medications.push({ id: medicationId, patientId, name: reason.includes("Diabetes") ? "Metformina" : reason.includes("respiratoria") || reason.includes("Asma") ? "Salbutamol" : reason.includes("Dolor") ? "Paracetamol" : "Omeprazol", dose: pediatric ? "10 mg VO" : "20 mg VO", times: ["08:00", "20:00"], startDate: "2026-08-01", floor: floor as 1 | 2 | 3 | 4, nurseId: nurse?.id, status: "active", notes: "Dato sintético de demostración." } as any);
    store.tasks.push({ id: taskId, patientId, medicationId, title: "Revisar signos vitales", scheduledAt: `2026-08-${String((index % 5) + 6).padStart(2, "0")}T${String((index % 10) + 8).padStart(2, "0")}:00:00.000Z`, nurseId: nurse?.id, floor: floor as 1 | 2 | 3 | 4, status: index % 9 === 0 ? "completed" : "pending", notes: "Tarea demo para registrar evolución." } as any);
    for (let reading = 0; reading < 3; reading += 1) store.vitals.push({ id: `bulk-demo-vital-${index + 1}-${reading + 1}`, taskId, patientId, temperature: (pediatric ? 36.8 : 36.9 + (index % 3) * 0.1).toFixed(1), bloodPressure: index % 6 === 0 ? "138/86" : "120/76", heartRate: String(76 + (index % 22)), respiratoryRate: String(pediatric ? 18 + (index % 5) : 16 + (index % 4)), oxygenSaturation: String(pediatric ? 97 + (reading % 2) : 98), notes: "Lectura histórica sintética para demo.", recordedBy: nurse?.userId || "demo-nurse-user-1", recordedAt: `2026-08-${String(reading + 1).padStart(2, "0")}T${String(8 + reading).padStart(2, "0")}:30:00.000Z` } as any);
  });
  store.revision = Math.max(store.revision, 1);
  return store;
}

export function demoStore(): Store { return expandDemoStore(baseDemoStore()); }
