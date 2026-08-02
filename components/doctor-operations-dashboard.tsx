"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

type DashboardData = { floors: any[]; patients: any[]; nurses: any[]; shifts: any[]; tasks: any[]; medications: any[]; vitals: any[] };

function dateValue(value: string) { return new Date(value).getTime(); }
function displayDate(value?: string) { return value ? new Date(value).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" }) : "Sin registro"; }
function patientName(data: DashboardData, patientId: string) { return data.patients.find(patient => patient.id === patientId)?.fullName || "Paciente"; }

export default function DoctorOperationsDashboard() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const locate = () => setTarget(document.querySelector<HTMLElement>(".ops-dashboard"));
    locate();
    const timer = window.setInterval(locate, 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!target) return;
    fetch("/api/doctor/summary").then(response => response.ok ? response.json() : null).then(value => value && setData(value)).catch(() => undefined);
  }, [target]);

  const patients = useMemo(() => {
    if (!data) return [];
    const normalized = query.toLocaleLowerCase().trim();
    return data.patients.filter(patient => patient.status !== "discharged" && (!normalized || patient.fullName.toLocaleLowerCase().includes(normalized))).sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [data, query]);

  const selected = data?.patients.find(patient => patient.id === selectedId) || null;
  if (!target || !data) return null;

  const now = Date.now();
  const pending = data.tasks.filter(task => task.status === "pending");
  const overdue = pending.filter(task => dateValue(task.scheduledAt) < now).sort((a, b) => dateValue(a.scheduledAt) - dateValue(b.scheduledAt));
  const upcoming = pending.filter(task => dateValue(task.scheduledAt) >= now).sort((a, b) => dateValue(a.scheduledAt) - dateValue(b.scheduledAt));
  const recent = data.tasks.filter(task => task.status === "completed").sort((a, b) => dateValue(b.scheduledAt) - dateValue(a.scheduledAt)).slice(0, 5);
  const vitals = selected ? data.vitals.filter(vital => vital.patientId === selected.id).sort((a, b) => dateValue(b.recordedAt) - dateValue(a.recordedAt)) : [];
  const temperatureValues = vitals.map(vital => Number.parseFloat(String(vital.temperature))).filter(Number.isFinite);
  const temperatureTrend = temperatureValues.length > 1 ? temperatureValues[0] > temperatureValues[1] ? "Subiendo" : temperatureValues[0] < temperatureValues[1] ? "Bajando" : "Estable" : "Sin comparación";
  const medications = selected ? data.medications.filter(medication => medication.patientId === selected.id && medication.status === "active") : [];
  const patientTasks = selected ? data.tasks.filter(task => task.patientId === selected.id).sort((a, b) => dateValue(b.scheduledAt) - dateValue(a.scheduledAt)).slice(0, 8) : [];

  return createPortal(<div className="operations-enhanced">
    <div className="enhanced-header"><div><span className="eyebrow">Panel clínico</span><h1>Seguimiento de pacientes</h1><p>Pisos, personal, tareas y evolución de signos vitales en una sola vista.</p></div><div className="enhanced-counter"><strong>{pending.length}</strong><span>tareas por realizar</span></div></div>

    <section className="enhanced-floors"><div className="enhanced-section-heading"><div><span className="eyebrow">Organización del hospital</span><h2>Pisos y personal asignado</h2></div><span className="enhanced-muted">Selecciona un piso para ver el detalle</span></div><div className="enhanced-floor-grid">{data.floors.map(floor => { const staff = data.nurses.filter(nurse => nurse.floor === floor.id && nurse.status !== "inactive"); const floorPatients = data.patients.filter(patient => patient.status !== "discharged" && patient.floor === floor.id); return <Link className="enhanced-floor" key={floor.id} href={`/doctor/piso-${floor.id}`}><div><span className="enhanced-floor-number">{floor.id}</span><strong>{floor.name}</strong><span className="enhanced-floor-arrow">↗</span></div><span className="enhanced-floor-count">{floorPatients.length} pacientes · {staff.length} enfermeras</span><div className="enhanced-staff">{staff.length ? staff.map(nurse => <span key={nurse.id} title={nurse.email}>{nurse.name}</span>) : <em>Sin personal asignado</em>}</div><span className="enhanced-floor-link">Ver información del piso</span></Link>; })}</div></section>

    <section className="enhanced-task-columns"><article className="enhanced-task-card"><div className="enhanced-section-heading"><div><span className="eyebrow">No realizadas</span><h2>Tareas pendientes</h2></div><b className="enhanced-number danger">{overdue.length}</b></div>{overdue.length ? overdue.slice(0, 6).map(task => <div className="enhanced-task-row" key={task.id}><span className="task-mark overdue">!</span><div><strong>{task.title}</strong><small>{patientName(data, task.patientId)} · programada {displayDate(task.scheduledAt)}</small></div></div>) : <p className="enhanced-empty">No hay tareas atrasadas.</p>}</article><article className="enhanced-task-card"><div className="enhanced-section-heading"><div><span className="eyebrow">Siguiente actividad</span><h2>Próximas tareas</h2></div><b className="enhanced-number">{upcoming.length}</b></div>{upcoming.length ? upcoming.slice(0, 6).map(task => <div className="enhanced-task-row" key={task.id}><span className="task-mark next">→</span><div><strong>{task.title}</strong><small>{patientName(data, task.patientId)} · {displayDate(task.scheduledAt)}</small></div></div>) : <p className="enhanced-empty">No hay tareas próximas programadas.</p>}</article><article className="enhanced-task-card"><div className="enhanced-section-heading"><div><span className="eyebrow">Registro reciente</span><h2>Últimas realizadas</h2></div></div>{recent.length ? recent.map(task => <div className="enhanced-task-row" key={task.id}><span className="task-mark done">✓</span><div><strong>{task.title}</strong><small>{patientName(data, task.patientId)} · realizada</small></div></div>) : <p className="enhanced-empty">Todavía no hay tareas realizadas.</p>}</article></section>

    <section className="enhanced-patients"><div className="enhanced-section-heading"><div><span className="eyebrow">Consulta rápida</span><h2>Buscar paciente</h2></div><span className="enhanced-muted">{patients.length} resultados</span></div><input className="field enhanced-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Escribe el nombre del paciente…" />{patients.length ? <div className="enhanced-patient-results">{patients.slice(0, 10).map(patient => <button className={selectedId === patient.id ? "enhanced-patient active" : "enhanced-patient"} key={patient.id} onClick={() => setSelectedId(patient.id)}><span className="enhanced-patient-avatar">{patient.fullName[0]}</span><span><strong>{patient.fullName}</strong><small>{patient.floor === "unassigned" ? "Sin cama" : `Piso ${patient.floor} · Cama ${patient.bed || "—"}`} · {patient.reason || "Sin motivo"}</small></span><b>›</b></button>)}</div> : <p className="enhanced-empty">No encontré pacientes con ese nombre.</p>}</section>

    {selected && <section className="enhanced-patient-detail"><div className="enhanced-detail-head"><div><span className="eyebrow">Ficha clínica</span><h2>{selected.fullName}</h2><p>{selected.floor === "unassigned" ? "Registrado sin cama" : `Piso ${selected.floor} · Cama ${selected.bed || "—"}`} · Ingreso {displayDate(selected.admittedAt)}</p></div><button className="btn" onClick={() => setSelectedId(null)}>Cerrar ficha</button></div><div className="enhanced-detail-grid"><div><h3>Datos de ingreso</h3><dl><dt>Fecha de nacimiento</dt><dd>{selected.birthDate}</dd><dt>Motivo</dt><dd>{selected.reason || "No registrado"}</dd><dt>Alergias</dt><dd>{selected.allergies || "No registradas"}</dd><dt>Contacto de emergencia</dt><dd>{selected.emergencyContact || "No registrado"} · {selected.emergencyPhone || "Sin teléfono"}</dd></dl></div><div><h3>Medicamentos activos</h3>{medications.length ? medications.map(medication => <div className="enhanced-line" key={medication.id}><strong>{medication.name}</strong><span>{medication.dose || "Dosis no indicada"} · {medication.frequency || medication.times?.join(", ") || "Horario no indicado"}</span></div>) : <p className="enhanced-empty">Sin medicamentos activos.</p>}<h3 className="detail-subheading">Actividad reciente</h3>{patientTasks.length ? patientTasks.slice(0, 4).map(task => <div className="enhanced-line" key={task.id}><strong>{task.title}</strong><span>{task.status === "completed" ? "Realizada" : task.status === "pending" ? "Pendiente" : task.status} · {displayDate(task.scheduledAt)}</span></div>) : <p className="enhanced-empty">Sin tareas registradas.</p>}</div></div><div className="enhanced-vitals"><div className="enhanced-section-heading"><div><span className="eyebrow">Signos vitales</span><h3>Temperatura y mediciones registradas</h3></div><strong>{vitals.length} mediciones · {temperatureTrend}</strong></div>{vitals.length ? <div className="vitals-table">{vitals.map(vital => <div className="vitals-row" key={vital.id}><span>{displayDate(vital.recordedAt)}</span><strong>{vital.temperature || "—"}{vital.temperature ? " °C" : ""}</strong><span>Presión {vital.bloodPressure || "—"}</span><span>FC {vital.heartRate || "—"}</span><span>FR {vital.respiratoryRate || "—"}/min</span><span>SpO₂ {vital.oxygenSaturation || "—"}</span></div>)}</div> : <p className="enhanced-empty">Aún no hay mediciones. Cuando enfermería registre temperatura, presión, respiraciones o saturación aparecerán aquí para comparar su evolución.</p>}</div></section>}
  </div>, target);
}
