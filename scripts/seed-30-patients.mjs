import { promises as fs } from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "data", "rxlist.json");
const store = JSON.parse(await fs.readFile(file, "utf8"));
const now = Date.parse("2026-08-04T12:00:00.000Z");
const iso = hours => new Date(now - hours * 3600000).toISOString();
const id = prefix => `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
const nursesByFloor = new Map((store.users.find(user => user.role === "doctor")?.nurses || []).map(nurse => [nurse.floor, nurse]));

store.patients = store.patients.filter(patient => !patient.id.startsWith("bulk-patient-"));
store.medications = store.medications.filter(medication => !medication.id.startsWith("bulk-med-"));
store.tasks = store.tasks.filter(task => !task.id.startsWith("bulk-task-"));
store.vitals = store.vitals.filter(vital => !vital.id.startsWith("bulk-vital-"));

const additional = [
  [1, "María Fernanda Salgado", "1978-03-12", "Insuficiencia cardiaca descompensada", "AINEs", "Jorge Salgado", "555-0201"],
  [1, "Jorge Alberto Pineda", "1959-11-02", "EPOC con exacerbación respiratoria", "Ninguna conocida", "Rosa Pineda", "555-0202"],
  [1, "Patricia Gómez Ríos", "1968-07-23", "Diabetes mellitus tipo 2 descontrolada", "Metamizol", "Daniel Ríos", "555-0203"],
  [1, "Héctor Iván Morales", "1982-10-19", "Pielonefritis complicada", "Ninguna conocida", "Claudia Morales", "555-0204"],
  [1, "Teresa del Carmen Ruiz", "1947-01-08", "Neumonía bilateral", "Penicilina", "Mónica Ruiz", "555-0205"],
  [1, "Óscar Ramírez Luna", "1990-05-30", "Crisis hipertensiva controlada", "Ninguna conocida", "Eva Luna", "555-0206"],
  [1, "Gabriela Torres León", "1971-09-14", "Anemia sintomática en estudio", "Sulfamidas", "Luis León", "555-0207"],
  [1, "Samuel Navarro Cárdenas", "1942-02-26", "Insuficiencia renal aguda sobre enfermedad crónica", "Contraste yodado", "Elena Cárdenas", "555-0208"],
  [1, "Lorena Beatriz Campos", "1976-12-01", "Celulitis extensa de miembro inferior", "Ninguna conocida", "Raúl Campos", "555-0209"],
  [2, "Marta Sofía Castillo", "2018-02-17", "Bronquiolitis viral", "Ninguna conocida", "Ana Castillo", "555-0211"],
  [2, "Diego Emiliano Vargas", "2012-08-09", "Apendicitis en observación", "Ninguna conocida", "Luis Vargas", "555-0212"],
  [2, "Valentina Ortega Cruz", "2020-12-04", "Fiebre sin foco", "Ibuprofeno", "Sofía Cruz", "555-0213"],
  [2, "Mateo Alejandro Flores", "2016-04-25", "Asma con sibilancias", "Ninguna conocida", "Andrea Flores", "555-0214"],
  [2, "Regina Méndez Soto", "2014-06-18", "Gastroenteritis con deshidratación", "Ninguna conocida", "Carlos Soto", "555-0215"],
  [3, "Fernando Quiroz Beltrán", "1981-02-11", "Postoperatorio de colecistectomía", "Ninguna conocida", "Adriana Beltrán", "555-0221"],
  [3, "Nadia Isabel Campos", "1993-06-27", "Fractura de tibia, postoperatorio", "Látex", "Iván Campos", "555-0222"],
  [3, "Miguel Ángel Rosales", "1966-12-15", "Obstrucción intestinal resuelta", "Ninguna conocida", "Elisa Rosales", "555-0223"],
  [3, "Carolina Jiménez Pardo", "1988-04-06", "Hernia discal, control postquirúrgico", "Ninguna conocida", "Marco Pardo", "555-0224"],
  [3, "Raúl Esteban Valdés", "1975-10-31", "Reemplazo total de rodilla", "Cefalosporinas", "Teresa Valdés", "555-0225"],
  [3, "Silvia Navarro Peña", "2001-09-22", "Laparoscopia diagnóstica", "Ninguna conocida", "Julia Peña", "555-0226"],
  [3, "Eduardo Castañeda", "1954-05-13", "Revisión de prótesis de cadera", "Ninguna conocida", "Miriam Castañeda", "555-0227"],
  [3, "Marisol Vega Santillán", "1963-08-16", "Postoperatorio de resección intestinal", "Penicilina", "Andrés Santillán", "555-0228"],
  [4, "Ismael Mendoza Ortiz", "1970-07-07", "Dolor abdominal agudo", "Ninguna conocida", "Laura Ortiz", "555-0231"],
  [4, "Verónica Salas Núñez", "1986-03-29", "Reacción alérgica en observación", "Mariscos", "Hugo Núñez", "555-0232"],
  [4, "Alberto Villanueva", "1998-11-20", "Traumatismo craneal leve", "Ninguna conocida", "Mónica Villanueva", "555-0233"],
  [4, "Rocío Belén Acosta", "1961-01-26", "Arritmia sintomática", "Ninguna conocida", "Pablo Acosta", "555-0234"],
  [1, "Beatriz Elena Moreno", "1962-04-19", "Insuficiencia venosa con edema bilateral", "Ninguna conocida", "Arturo Moreno", "555-0241"],
  [1, "Arturo Sebastián Cruz", "1973-08-11", "Pancreatitis aguda en vigilancia", "Mariscos", "Clara Cruz", "555-0242"],
  [1, "Mónica Alejandra Fuentes", "1989-01-27", "Crisis asmática moderada", "Naproxeno", "Julián Fuentes", "555-0243"],
  [1, "Rafael Tomás Ibarra", "1951-06-05", "Descompensación de enfermedad renal crónica", "Ninguna conocida", "Marta Ibarra", "555-0244"],
  [2, "Sofía Guadalupe Reyes", "2011-03-14", "Neumonía adquirida en comunidad", "Amoxicilina", "Luz Reyes", "555-0251"],
  [2, "Emiliano Torres Silva", "2019-09-22", "Convulsión febril en observación", "Ninguna conocida", "Paola Silva", "555-0252"],
  [2, "Camila Andrea Núñez", "2017-01-30", "Infección urinaria febril", "Ninguna conocida", "Diego Núñez", "555-0253"],
  [2, "Daniela Marín López", "2013-11-08", "Contusión abdominal por accidente", "Látex", "Sergio Marín", "555-0254"],
  [3, "Adriana Patricia León", "1979-05-16", "Postoperatorio de histerectomía", "Ninguna conocida", "Mario León", "555-0261"],
  [3, "Óscar Javier Molina", "1960-10-24", "Oclusión intestinal en resolución", "Yodo", "Gabriela Molina", "555-0262"],
  [3, "Claudia Beatriz Serrano", "1991-07-03", "Reconstrucción de ligamento de rodilla", "Ninguna conocida", "Héctor Serrano", "555-0263"],
  [3, "Felipe Andrés Duarte", "1984-02-28", "Apendicectomía laparoscópica", "Ninguna conocida", "Verónica Duarte", "555-0264"],
  [4, "Esteban Mauricio Ríos", "1977-12-09", "Sepsis de origen urinario en estabilización", "Penicilina", "Natalia Ríos", "555-0271"],
  [4, "Laura Isabel Cárdenas", "1995-04-21", "Crisis hipertensiva en observación", "Ninguna conocida", "Jorge Cárdenas", "555-0272"],
  [4, "Hugo Daniel Pacheco", "1958-09-13", "Insuficiencia respiratoria aguda", "Ninguna conocida", "Teresa Pacheco", "555-0273"],
];

const targetByFloor = new Map([[1, 14], [2, 12], [3, 13], [4, 9]]);
const occupiedByFloor = new Map([1, 2, 3, 4].map(floor => [floor, new Set(store.patients.filter(p => p.status !== "discharged" && p.floor === floor).map(p => p.bed).filter(Boolean))]));
const countByFloor = floor => store.patients.filter(p => p.status !== "discharged" && p.floor === floor).length;

for (const [index, [floor, fullName, birthDate, reason, allergies, emergencyContact, emergencyPhone]] of additional.entries()) {
  const beds = store.floors.find(item => item.id === floor)?.beds || 20;
  const occupied = occupiedByFloor.get(floor);
  const bed = Array.from({ length: beds }, (_, position) => position + 1).find(candidate => !occupied.has(candidate));
  if (!bed || countByFloor(floor) >= targetByFloor.get(floor)) continue;
  occupied.add(bed);
  store.patients.push({ id: `bulk-patient-${index + 1}`, fullName, birthDate, reason, allergies, emergencyContact, emergencyPhone, floor, bed, admittedAt: iso(18 + index * 7), status: "admitted", notes: `Registro demo para pruebas clínicas. Vigilar evolución de ${reason.toLocaleLowerCase()}.` });
}

for (const patient of store.patients.filter(item => item.status !== "discharged" && item.floor !== "unassigned")) {
  const nurse = nursesByFloor.get(patient.floor);
  const taskId = `bulk-task-${patient.id}`;
  const medicationId = `bulk-med-${patient.id}`;
  const hasMedication = !/observación|control post|revisión|traumatismo/i.test(patient.reason);
  if (hasMedication) {
    const medication = /diabetes/i.test(patient.reason) ? ["Metformina", "500 mg VO"] : /hipertens/i.test(patient.reason) ? ["Losartán", "50 mg VO"] : /epoc|asma|bronquiolitis/i.test(patient.reason) ? ["Salbutamol", "2.5 mg nebulizado"] : /pielonefritis|celulitis/i.test(patient.reason) ? ["Ceftriaxona", "1 g IV"] : /neumonía/i.test(patient.reason) ? ["Ampicilina/sulbactam", "3 g IV"] : /dolor|fractura|rodilla|cadera/i.test(patient.reason) ? ["Paracetamol", "1 g VO"] : ["Omeprazol", "20 mg VO"];
    store.medications.push({ id: medicationId, patientId: patient.id, name: medication[0], dose: medication[1], times: ["08:00", "20:00"], startDate: "2026-08-01", floor: patient.floor, nurseId: nurse?.id, status: "active", notes: "Dato sintético de demostración; validar indicación clínica." });
  }
  store.tasks.push({ id: taskId, patientId: patient.id, medicationId: hasMedication ? medicationId : undefined, title: "Revisar signos vitales", scheduledAt: "2026-08-04T14:00:00.000Z", nurseId: nurse?.id, floor: patient.floor, status: "pending", notes: "Tarea demo para registrar evolución." });
  const baseline = /fiebre|bronquiolitis|neumonía|infección/i.test(patient.reason) ? 38.1 : /hipertens|cardiaca|arritmia/i.test(patient.reason) ? 37.1 : 36.8;
  const pulse = /arritmia|cardiaca/i.test(patient.reason) ? 104 : /fiebre|dolor|urgente/i.test(patient.reason) ? 96 : 78;
  const pressure = /hipertens|cardiaca/i.test(patient.reason) ? ["158/94", "146/88", "134/82"] : /anemia/i.test(patient.reason) ? ["108/68", "112/70", "116/72"] : ["122/78", "120/76", "118/74"];
  for (let reading = 0; reading < 3; reading++) {
    store.vitals.push({ id: `bulk-vital-${patient.id}-${reading + 1}`, taskId, patientId: patient.id, temperature: (baseline + (reading === 1 ? 0.4 : reading === 2 ? 0.1 : 0)).toFixed(1), bloodPressure: pressure[reading], heartRate: String(pulse + (reading === 1 ? 5 : reading === 2 ? -3 : 0)), respiratoryRate: String(/bronquiolitis|asma|neumonía|respiratoria/i.test(patient.reason) ? 22 + reading : 16 + (reading % 2)), oxygenSaturation: String(/respiratoria|bronquiolitis|asma|neumonía/i.test(patient.reason) ? 92 + reading : 97 + (reading === 2 ? 1 : 0)), notes: "Lectura histórica sintética para demo; requiere valoración clínica.", recordedBy: nurse?.userId || "demo-nurse-user-1", recordedAt: `2026-08-0${1 + reading}T${String(8 + reading).padStart(2, "0")}:30:00.000Z` });
  }
}

// Conserva la distribución demo original: Enrique pertenece a Pediatría.
// Una operación de prueba anterior lo había dejado en Urgencias sin cama.
const enrique = store.patients.find(patient => patient.fullName === "Enrique Manuel");
if (enrique && enrique.status !== "discharged") {
  enrique.floor = 2;
  enrique.bed = 2;
  for (const item of store.medications.filter(medication => medication.patientId === enrique.id)) item.floor = 2;
  for (const item of store.tasks.filter(task => task.patientId === enrique.id)) item.floor = 2;
}

store.revision = Number(store.revision || 0) + 1;
await fs.writeFile(file, JSON.stringify(store, null, 2));
console.log(`Demo cargado: ${store.patients.filter(p => p.status !== "discharged").length} pacientes ingresados, ${store.vitals.length} signos vitales, ${store.medications.length} medicamentos y ${store.tasks.length} tareas.`);
