"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";

function displayDate(value?: string) { return value ? new Date(value).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" }) : "Sin registro"; }
function dateValue(value?: string) { return value ? new Date(value).getTime() : 0; }

export default function FloorDetailPage() {
  const params = useParams<{ floor: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const floorId = Number(String(params.floor || pathname.match(/piso-(\d+)/)?.[1] || "").replace("piso-", ""));

  useEffect(() => {
    fetch("/api/doctor/summary").then(response => {
      if (response.status === 401) { router.push("/login"); return null; }
      return response.ok ? response.json() : null;
    }).then(value => value && setData(value)).catch(() => undefined);
  }, [router]);

  const floor = data?.floors.find((item: any) => item.id === floorId);
  const patients = useMemo(() => data?.patients.filter((patient: any) => patient.floor === floorId && patient.status !== "discharged") || [], [data, floorId]);
  const nurses = useMemo(() => data?.nurses.filter((nurse: any) => nurse.floor === floorId && nurse.status !== "inactive") || [], [data, floorId]);
  const shifts = useMemo(() => data?.shifts.filter((shift: any) => shift.floor === floorId && shift.status === "scheduled") || [], [data, floorId]);
  const tasks = useMemo(() => (data?.tasks.filter((task: any) => task.floor === floorId).sort((a: any, b: any) => dateValue(a.scheduledAt) - dateValue(b.scheduledAt)) || []).slice(0, 12), [data, floorId]);
  if (!data) return <main className="floor-page"><div className="floor-loading">Cargando información del piso…</div></main>;
  if (!floor) return <main className="floor-page"><div className="floor-not-found"><h1>Piso no encontrado</h1><Link href="/doctor">Volver al dashboard</Link></div></main>;

  const occupiedBeds = patients.filter((patient: any) => patient.bed).map((patient: any) => patient.bed);
  const freeBeds = Math.max(0, floor.beds - occupiedBeds.length);
  const nurseName = (id: string) => nurses.find((nurse: any) => nurse.id === id)?.name || "Sin asignar";

  return <main className="floor-page">
    <header className="floor-detail-header"><div><Link className="back-link" href="/doctor">← Volver al dashboard</Link><span className="eyebrow">Información general del piso</span><h1>Piso {floor.id} · {floor.name}</h1><p>{floor.description}</p></div><div className="floor-header-badge"><strong>{patients.length}</strong><span>pacientes ingresados</span></div></header>
    <section className="floor-stat-grid"><div><strong>{occupiedBeds.length}/{floor.beds}</strong><span>Camas ocupadas</span></div><div><strong>{freeBeds}</strong><span>Camas disponibles</span></div><div><strong>{nurses.length}</strong><span>Enfermeras activas</span></div><div><strong>{tasks.filter((task: any) => task.status === "pending").length}</strong><span>Tareas pendientes</span></div></section>
    <div className="floor-detail-grid">
      <section className="floor-detail-card"><div className="floor-card-heading"><div><span className="eyebrow">Pacientes ingresados</span><h2>Lista de pacientes</h2></div><span className="floor-card-count">{freeBeds} libres</span></div>{patients.length ? <div className="floor-patient-list">{patients.map((patient: any) => <Link className="floor-patient-list-row" href={`/doctor/paciente/${patient.id}`} key={patient.id}><span className="floor-avatar">{patient.fullName[0]}</span><span><strong>{patient.fullName}</strong><small>{patient.bed ? `Cama ${patient.bed}` : "Sin cama"} · {patient.reason || "Sin motivo registrado"}</small></span><b>›</b></Link>)}</div> : <p className="floor-empty">No hay pacientes ingresados en este piso.</p>}</section>
      <section className="floor-detail-card"><div className="floor-card-heading"><div><span className="eyebrow">Personal asignado</span><h2>Enfermería</h2></div><span className="floor-card-count">{shifts.length} turnos</span></div>{nurses.length ? <div className="floor-list">{nurses.map((nurse: any) => { const nurseShifts = shifts.filter((shift: any) => shift.nurseId === nurse.id); return <div className="floor-list-row" key={nurse.id}><span className="floor-avatar">{nurse.name[0]}</span><div><strong>{nurse.name}</strong><small>{nurse.email || "Sin correo registrado"}</small></div><span className="floor-row-status">{nurseShifts.length ? nurseShifts.map((shift: any) => shift.kind === "day" ? "Día" : "Noche").join(" · ") : "Sin turno"}</span></div>; })}</div> : <p className="floor-empty">No hay enfermeras activas asignadas a este piso.</p>}</section>
    </div>
    <section className="floor-detail-card floor-patients"><div className="floor-card-heading"><div><span className="eyebrow">Seguimiento clínico</span><h2>Pacientes del piso</h2></div></div>{patients.length ? <div className="floor-patient-table"><div className="floor-table-head"><span>Paciente</span><span>Cama</span><span>Ingreso</span><span>Motivo</span></div>{patients.map((patient: any) => <div className="floor-table-row" key={patient.id}><Link className="floor-patient-link" href={`/doctor/paciente/${patient.id}`}>{patient.fullName}</Link><span>{patient.bed ? `Cama ${patient.bed}` : "Sin cama"}</span><span>{displayDate(patient.admittedAt)}</span><span>{patient.reason || "Sin motivo registrado"}</span></div>)}</div> : <p className="floor-empty">No hay pacientes ingresados en este piso.</p>}</section>
    <section className="floor-detail-card"><div className="floor-card-heading"><div><span className="eyebrow">Agenda operativa</span><h2>Tareas del piso</h2></div></div>{tasks.length ? <div className="floor-task-list">{tasks.map((task: any) => <div className="floor-task-row" key={task.id}><span className={`task-mark ${task.status === "completed" ? "done" : task.status === "pending" && dateValue(task.scheduledAt) < Date.now() ? "overdue" : "next"}`}>{task.status === "completed" ? "✓" : task.status === "pending" ? "→" : "•"}</span><div><strong>{task.title}</strong><small>{data.patients.find((patient: any) => patient.id === task.patientId)?.fullName || "Paciente"} · {displayDate(task.scheduledAt)} · {task.status === "completed" ? "Realizada por " + nurseName(task.nurseId) : task.status === "pending" ? "Pendiente" : task.status}</small></div></div>)}</div> : <p className="floor-empty">No hay tareas registradas para este piso.</p>}</section>
  </main>;
}
