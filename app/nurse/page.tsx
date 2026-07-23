"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Vitals = { temperature: string; bloodPressure: string; heartRate: string; oxygenSaturation: string; notes: string };

const emptyVitals: Vitals = { temperature: "", bloodPressure: "", heartRate: "", oxygenSaturation: "", notes: "" };

export default function NursePage() {
  const [data, setData] = useState<any>(null);
  const [selected, setSelected] = useState<any>(null);
  const [vitals, setVitals] = useState<Vitals>(emptyVitals);
  const router = useRouter();

  async function load() {
    const r = await fetch("/api/nurse/me");
    if (!r.ok) { router.push("/login"); return; }
    setData(await r.json());
  }

  useEffect(() => { load(); }, []);

  async function complete(status: "completed" | "skipped") {
    if (!selected) return;
    await fetch("/api/tasks/" + selected.id, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status, vitals })
    });
    setSelected(null);
    setVitals(emptyVitals);
    load();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const groups = useMemo(() => {
    if (!data) return [];
    const grouped = new Map<string, any[]>();
    for (const task of data.tasks) {
      const key = task.medicationId || task.title;
      grouped.set(key, [...(grouped.get(key) || []), task]);
    }
    return [...grouped.values()].map(tasks => ({
      title: tasks[0].title.replace(/^Administrar\s+/, ""),
      patient: data.patients.find((p: any) => p.id === tasks[0].patientId)?.fullName || "Paciente",
      tasks: tasks.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
    }));
  }, [data]);

  if (!data) return <div className="page">Cargando turno…</div>;
  const floor = data.nurse?.floor === "unassigned" ? "Sin asignar" : "Piso " + data.nurse?.floor;
  const pending = data.tasks.filter((t: any) => t.status === "pending").length;
  const completedCount = data.tasks.filter((t: any) => t.status === "completed").length;

  return <main className="shell">
    <header className="topbar"><div className="brand"><span className="mark">✚</span> RXList</div><div className="topright"><span>{data.user.name}</span><span className="avatar">{data.user.name[0]}</span><button className="btn ghost" onClick={logout}>Cerrar sesión</button></div></header>
    <section className="page">
      <div className="eyebrow">Panel de enfermería</div>
      <h1 className="headline">Tu turno, en orden.</h1>
      <p className="sub">{floor} · {data.user.email}</p>
      <div className="stats"><div className="stat"><strong>{pending}</strong><span>Pendientes</span></div><div className="stat"><strong>{completedCount}</strong><span>Realizadas</span></div><div className="stat"><strong>{data.patients.length}</strong><span>Pacientes</span></div></div>
      <section className="panel nurse-tasks-panel">
        <div className="panelhead"><span className="paneltitle">Mis tareas</span><span className="count">{floor}</span></div>
        <div className="task-help"><strong>Agenda de medicamentos</strong><span>Cada horario representa una dosis distinta; no son duplicados.</span></div>
        <div className="medication-groups">
          {groups.map(group => <article className="medication-card" key={group.tasks[0].medicationId || group.title}>
            <div className="medication-card-head"><div><strong>Administrar {group.title}</strong><span>{group.patient}</span></div><span className="dose-count">{group.tasks.length} {group.tasks.length === 1 ? "dosis" : "dosis programadas"}</span></div>
            <div className="dose-list">{group.tasks.map((task: any) => <div className="dose-row" key={task.id}>
              <div className="dose-time"><strong>{new Date(task.scheduledAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</strong><span>{new Date(task.scheduledAt).toLocaleDateString("es-MX")}</span></div>
              <span className={"dose-status " + task.status}>{task.status === "pending" ? "Pendiente" : task.status === "completed" ? "Realizada" : task.status}</span>
              {task.status === "pending" ? <button className="btn primary" onClick={() => setSelected(task)}>Abrir tarea</button> : <span className="status">{task.status}</span>}
            </div>)}</div>
          </article>)}
          {!groups.length && <div className="empty">No tienes tareas asignadas.</div>}
        </div>
      </section>
    </section>
    {selected && <div className="modalback"><section className="proposal"><div className="proposalhead"><strong style={{ fontFamily: "Manrope" }}>{selected.title}</strong><button className="iconbtn" onClick={() => setSelected(null)}>×</button></div><div className="proposalbody"><p className="proposalnote">Confirma al paciente, registra los signos disponibles y añade cualquier observación.</p>{(["temperature", "bloodPressure", "heartRate", "oxygenSaturation", "notes"] as const).map(k => <label className="formlabel" key={k}>{k === "temperature" ? "Temperatura" : k === "bloodPressure" ? "Presión arterial" : k === "heartRate" ? "Frecuencia cardíaca" : k === "oxygenSaturation" ? "Saturación de oxígeno" : "Observaciones"}<input className="field" value={vitals[k]} onChange={e => setVitals({ ...vitals, [k]: e.target.value })} /></label>)}</div><div className="proposalfoot"><button className="btn" onClick={() => complete("skipped")}>Omitir</button><button className="btn primary" onClick={() => complete("completed")}>Confirmar realizada</button></div></section></div>}
  </main>;
}
