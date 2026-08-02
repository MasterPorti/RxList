"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

function displayDate(value?: string) { return value ? new Date(value).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" }) : "Sin registro"; }

export default function PatientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/doctor/summary").then(async response => {
      if (response.status === 401) { router.push("/login"); return; }
      if (response.ok) setData(await response.json());
    }).catch(() => undefined);
  }, [router]);

  const patient = data?.patients.find((item: any) => item.id === id);
  const medications = useMemo(() => data?.medications.filter((item: any) => item.patientId === id) || [], [data, id]);
  const tasks = useMemo(() => data?.tasks.filter((item: any) => item.patientId === id).sort((a: any, b: any) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()) || [], [data, id]);
  const vitals = useMemo(() => data?.vitals.filter((item: any) => item.patientId === id).sort((a: any, b: any) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()) || [], [data, id]);
  const nurseName = (nurseId?: string) => data?.nurses.find((nurse: any) => nurse.id === nurseId)?.name || "Sin enfermero registrado";

  if (!data) return <main className="floor-page"><div className="floor-loading">Cargando expediente del paciente…</div></main>;
  if (!patient) return <main className="floor-page"><div className="floor-not-found"><h1>Paciente no encontrado</h1><Link href="/doctor">Volver al dashboard</Link></div></main>;

  return <main className="floor-page patient-profile-page">
    <header className="floor-detail-header"><div><Link className="back-link" href={typeof patient.floor === "number" ? `/doctor/piso-${patient.floor}` : "/doctor"}>← Volver al piso</Link><span className="eyebrow">Expediente clínico</span><h1>{patient.fullName}</h1><p>{patient.floor === "unassigned" ? "Paciente registrado sin cama" : `Piso ${patient.floor} · ${patient.bed ? `Cama ${patient.bed}` : "Sin cama"}`}</p></div><div className="floor-header-badge"><strong>{tasks.filter((task: any) => task.status === "completed").length}/{tasks.length}</strong><span>tareas realizadas</span></div></header>
    <section className="patient-profile-grid">
      <section className="floor-detail-card"><div className="floor-card-heading"><div><span className="eyebrow">Información del paciente</span><h2>Datos generales</h2></div></div><dl className="patient-profile-data"><dt>Fecha de nacimiento</dt><dd>{patient.birthDate}</dd><dt>Fecha de ingreso</dt><dd>{displayDate(patient.admittedAt)}</dd><dt>Motivo de ingreso</dt><dd>{patient.reason || "No registrado"}</dd><dt>Alergias</dt><dd>{patient.allergies || "No registradas"}</dd><dt>Contacto de emergencia</dt><dd>{patient.emergencyContact || "No registrado"} · {patient.emergencyPhone || "Sin teléfono"}</dd><dt>Notas</dt><dd>{patient.notes || "Sin notas"}</dd></dl></section>
      <section className="floor-detail-card"><div className="floor-card-heading"><div><span className="eyebrow">Tratamiento</span><h2>Medicamentos</h2></div><span className="floor-card-count">{medications.length}</span></div>{medications.length ? <div className="floor-list">{medications.map((medication: any) => <div className="floor-list-row" key={medication.id}><span className="floor-avatar">Rx</span><div><strong>{medication.name}</strong><small>{medication.dose || "Dosis no indicada"} · {medication.frequency || medication.times?.join(", ") || "Horario no indicado"}</small></div><span className="floor-row-status">{medication.status === "active" ? "Activo" : "Cancelado"}</span></div>)}</div> : <p className="floor-empty">No hay medicamentos registrados.</p>}</section>
    </section>
    <section className="floor-detail-card"><div className="floor-card-heading"><div><span className="eyebrow">Administración y seguimiento</span><h2>Medicamentos y tareas</h2></div><span className="floor-card-count">{tasks.length} registros</span></div>{tasks.length ? <div className="patient-task-table"><div className="floor-table-head"><span>Tarea</span><span>Programada</span><span>Estado</span><span>Responsable</span></div>{tasks.map((task: any) => <div className="floor-table-row" key={task.id}><strong>{task.title}</strong><span>{displayDate(task.scheduledAt)}</span><span className={`patient-task-status ${task.status}`}>{task.status === "completed" ? "✓ Realizada" : task.status === "pending" ? "Pendiente" : task.status}</span><span>{nurseName(task.nurseId)}</span></div>)}</div> : <p className="floor-empty">No hay tareas registradas.</p>}</section>
    <section className="floor-detail-card"><div className="floor-card-heading"><div><span className="eyebrow">Evolución</span><h2>Signos vitales</h2></div><span className="floor-card-count">{vitals.length} mediciones</span></div>{vitals.length ? <div className="patient-vitals-table"><div className="floor-table-head"><span>Fecha</span><span>Temperatura</span><span>Presión</span><span>FC / FR</span><span>SpO₂</span></div>{vitals.map((vital: any) => <div className="floor-table-row" key={vital.id}><span>{displayDate(vital.recordedAt)}</span><strong>{vital.temperature || "—"}{vital.temperature ? " °C" : ""}</strong><span>{vital.bloodPressure || "—"}</span><span>{vital.heartRate || "—"} / {vital.respiratoryRate || "—"}</span><span>{vital.oxygenSaturation || "—"}</span></div>)}</div> : <p className="floor-empty">Aún no hay mediciones de signos vitales.</p>}</section>
  </main>;
}
