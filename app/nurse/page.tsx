"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Vitals = { temperature: string; bloodPressure: string; heartRate: string; respiratoryRate: string; oxygenSaturation: string; notes: string };
type InternalMessage = { id: string; threadId: string; senderName: string; senderRole: "doctor" | "nurse"; recipientIds: string[]; body: string; createdAt: string; readBy: string[] };

const emptyVitals: Vitals = { temperature: "", bloodPressure: "", heartRate: "", respiratoryRate: "", oxygenSaturation: "", notes: "" };

const cdmxTime = (value: string | number) => new Intl.DateTimeFormat("es-MX", { timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
const cdmxDate = (value: string | number) => new Intl.DateTimeFormat("es-MX", { timeZone: "America/Mexico_City", day: "2-digit", month: "short" }).format(new Date(value));
function countdown(milliseconds: number) { const total = Math.max(0, Math.floor(milliseconds / 1000)); return `${String(Math.floor(total / 3600)).padStart(2, "0")}:${String(Math.floor((total % 3600) / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`; }

function TaskTimer({ task, onAction }: { task: any; onAction: (id: string, action: "start" | "pause") => void }) {
  const [, refresh] = useState(0);
  useEffect(() => { if (task.status !== "in_progress" && task.status !== "pending") return; const timer = window.setInterval(() => refresh(value => value + 1), 1000); return () => window.clearInterval(timer); }, [task.status]);
  const elapsed = task.startedAt ? Math.max(0, Date.now() - new Date(task.startedAt).getTime()) : 0;
  const total = Number(task.durationMinutes || 240) * 60 * 1000;
  const remaining = Math.max(0, total - elapsed);
  const untilStart = new Date(task.scheduledAt).getTime() - Date.now();
  const label = task.status === "in_progress" ? countdown(remaining) : untilStart > 0 ? countdown(untilStart) : "Disponible ahora";
  return <div className={`task-timer ${task.status}`}><strong>{task.status === "in_progress" ? label : untilStart > 0 ? `En ${label}` : label}</strong>{task.status === "in_progress" ? <button onClick={() => onAction(task.id, "pause")}>Pausar</button> : <button onClick={() => onAction(task.id, "start")}>Iniciar</button>}</div>;
}

export default function NursePage() {
  const [data, setData] = useState<any>(null);
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [reply, setReply] = useState("");
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [quickQuestion, setQuickQuestion] = useState("");
  const [quickAnswer, setQuickAnswer] = useState("");
  const [quickLoading, setQuickLoading] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [vitals, setVitals] = useState<Vitals>(emptyVitals);
  const router = useRouter();

  async function load() {
    const [r, inbox] = await Promise.all([fetch("/api/nurse/me"), fetch("/api/messages")]);
    if (!r.ok) { router.push("/login"); return; }
    setData(await r.json());
    if (inbox.ok) { const result = await inbox.json(); setMessages(result.messages || []); }
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { void load(); }, 5000);
    return () => window.clearInterval(timer);
  }, []);

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

  async function taskAction(id: string, action: "start" | "pause") {
    await fetch(`/api/tasks/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
    load();
  }

  async function sendReply(message: InternalMessage) {
    const body = reply.trim(); if (!body) return;
    await fetch("/api/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body, threadId: message.threadId }) });
    setReply(""); load();
  }

  async function askQuickQuestion(value = quickQuestion) {
    const message = value.trim(); if (!message || quickLoading) return;
    setQuickLoading(true); setQuickAnswer("");
    try {
      const response = await fetch("/api/nurse/query", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message }) });
      const result = await response.json().catch(() => null);
      setQuickAnswer(response.ok ? result.answer : "No pude consultar la información del piso. Inténtalo de nuevo.");
    } catch { setQuickAnswer("No pude conectar con el asistente."); }
    setQuickQuestion(""); setQuickLoading(false);
  }

  const incomingMessages = messages.filter(message => message.senderRole === "doctor");
  const threads = useMemo(() => {
    const latest = new Map<string, InternalMessage>();
    for (const message of incomingMessages) latest.set(message.threadId, message);
    return [...latest.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [messages]);
  const activeMessages = activeThread ? messages.filter(message => message.threadId === activeThread).sort((a, b) => a.createdAt.localeCompare(b.createdAt)) : [];

  function openPendingChats() {
    setMessagesOpen(true);
    setActiveThread(current => current || threads[0]?.threadId || null);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const groups = useMemo(() => {
    if (!data) return [];
    const grouped = new Map<string, any[]>();
    for (const task of data.tasks.filter((item: any) => item.status === "pending" || item.status === "in_progress")) {
      const key = task.medicationId || task.title;
      grouped.set(key, [...(grouped.get(key) || []), task]);
    }
    return [...grouped.values()].map(tasks => ({
      title: tasks[0].title.replace(/^Administrar\s+/, ""),
      patient: data.patients.find((p: any) => p.id === tasks[0].patientId)?.fullName || "Paciente",
      tasks: tasks.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
    })).sort((a, b) => new Date(a.tasks[0].scheduledAt).getTime() - new Date(b.tasks[0].scheduledAt).getTime());
  }, [data]);

  if (!data) return <div className="page">Cargando turno…</div>;
  const floor = data.nurse?.floor === "unassigned" ? "Sin asignar" : "Piso " + data.nurse?.floor;
  const pendingTasks = data.tasks.filter((task: any) => task.status === "pending" || task.status === "in_progress").sort((a: any, b: any) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  const completedTasks = data.tasks.filter((task: any) => task.status === "completed" || task.status === "skipped").sort((a: any, b: any) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
  const totalBeds = data.floors.reduce((total: number, item: any) => total + Number(item.beds || 0), 0);
  const occupiedBeds = data.patients.filter((patient: any) => patient.status !== "discharged" && typeof patient.bed === "number").length;
  const nextTask = pendingTasks[0];

  return <main className="shell">
    <header className="topbar"><div className="brand"><span className="mark">✚</span> RXList</div><div className="topright"><span>{data.user.name}</span><span className="avatar">{data.user.name[0]}</span><button className="btn ghost" onClick={logout}>Cerrar sesión</button></div></header>
    <section className="page">
      <div className="eyebrow">Panel de enfermería</div>
      <h1 className="headline">Tu turno, en orden.</h1>
      <p className="sub">{floor} · {data.user.email}</p>
      <div className="stats"><div className="stat"><strong>{data.patients.length}</strong><span>Pacientes</span></div><div className="stat"><strong>{totalBeds}</strong><span>Camas totales</span></div><div className="stat"><strong>{Math.max(totalBeds - occupiedBeds, 0)}</strong><span>Camas libres</span></div><button className="nurse-pending-chat-button" onClick={openPendingChats}><span className="nurse-chat-icon">✦</span><span><strong>{incomingMessages.length}</strong><small>Chats</small></span><b>↗</b></button></div>
      <section className="panel nurse-tasks-panel">
        <div className="panelhead"><span className="paneltitle">Mis tareas</span><span className="count">{floor}</span></div>
        <div className="task-help"><strong>Agenda de medicamentos</strong><span>{nextTask ? `Siguiente: ${cdmxTime(nextTask.scheduledAt)} · ${cdmxDate(nextTask.scheduledAt)} CDMX` : "No hay tareas pendientes."}</span></div>
        <div className="medication-groups">
          {groups.map(group => <article className="medication-card" key={group.tasks[0].medicationId || group.title}>
            <div className="medication-card-head"><div><strong>Administrar {group.title}</strong><span>{group.patient}</span></div><span className="dose-count">{group.tasks.length} {group.tasks.length === 1 ? "dosis" : "dosis programadas"}</span></div>
            <div className="dose-list">{group.tasks.map((task: any) => <div className="dose-row" key={task.id}>
              <div className="dose-time"><strong>{new Date(task.scheduledAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</strong><span>{new Date(task.scheduledAt).toLocaleDateString("es-MX")}</span></div>
              <span className={"dose-status " + task.status}>{task.status === "pending" ? "Pendiente" : task.status === "completed" ? "Realizada" : task.status}</span>
              {task.status === "pending" ? <a className="btn primary nurse-task-link" href={`/nurse/task/${task.id}`}>Abrir tarea</a> : <span className="status">{task.status}</span>}
              {(task.status === "pending" || task.status === "in_progress") && <TaskTimer task={task} onAction={taskAction} />}
            </div>)}</div>
          </article>)}
          {!groups.length && <div className="empty">No tienes tareas asignadas.</div>}
        </div>
        <div className="completed-tasks-section"><button className="completed-toggle" onClick={() => setShowCompleted(value => !value)}><span>Historial de realizadas</span><b>{completedTasks.length}</b><i>{showCompleted ? "⌃" : "⌄"}</i></button>{showCompleted && <div className="completed-task-list">{completedTasks.map((task: any) => <div className="completed-task-row" key={task.id}><span>✓</span><div><strong>{task.title}</strong><small>{data.patients.find((patient: any) => patient.id === task.patientId)?.fullName || "Paciente"} · {cdmxDate(task.scheduledAt)} {cdmxTime(task.scheduledAt)} CDMX</small></div></div>)}</div>}</div>
      </section>
      <section className="panel nurse-floor-assistant"><div className="panelhead"><div><span className="paneltitle">Consultas rápidas</span><small className="count">Información de pacientes de {floor}</small></div><span className="nurse-online-dot" /></div><div className="nurse-floor-assistant-body"><p>Pregunta por pacientes, contactos de emergencia, signos vitales o tareas de tu piso.</p><div className="nurse-quick-actions"><button onClick={() => void askQuickQuestion("Dame información de los pacientes de mi piso.")}>Pacientes de mi piso</button><button onClick={() => void askQuickQuestion("Dame los contactos de emergencia de los pacientes de mi piso.")}>Contactos de emergencia</button><button onClick={() => void askQuickQuestion("¿Qué tareas pendientes tienen los pacientes de mi piso?")}>Tareas pendientes</button></div><div className="nurse-quick-compose"><input value={quickQuestion} onChange={event => setQuickQuestion(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void askQuickQuestion(); } }} placeholder="Pregunta algo sobre tu piso…" /><button onClick={() => void askQuickQuestion()} disabled={quickLoading || !quickQuestion.trim()}>{quickLoading ? "Consultando…" : "Preguntar ↗"}</button></div>{quickAnswer && <div className="nurse-quick-answer"><span>Respuesta del asistente</span><p>{quickAnswer}</p></div>}</div></section>
      <section className="panel nurse-messages-panel">
        <div className="panelhead"><span className="paneltitle">Chats</span><span className="count">{incomingMessages.length} notificaciones</span></div>
        <div className="nurse-message-list">{incomingMessages.length ? incomingMessages.slice(-12).reverse().map(message => <article className="nurse-message-card" key={message.id}><div><strong>{message.senderName}</strong><small>{new Date(message.createdAt).toLocaleString("es-MX")}</small></div><p>{message.body}</p><div className="nurse-message-reply"><input value={reply} onChange={event => setReply(event.target.value)} placeholder="Responder al doctor…" /><button className="btn primary" onClick={() => sendReply(message)}>Responder</button></div></article>) : <div className="empty">No tienes mensajes pendientes.</div>}</div>
      </section>
    </section>
    {messagesOpen && <div className="nurse-chat-backdrop" role="dialog" aria-modal="true" aria-label="Chats pendientes"><section className="nurse-chat-window"><header className="nurse-chat-header"><div><span className="eyebrow">RXList · comunicación de guardia</span><h2>Chats pendientes</h2><p>Mensajería interna con el equipo médico.</p></div><button className="nurse-chat-close" onClick={() => setMessagesOpen(false)} aria-label="Cerrar chats">×</button></header><div className="nurse-chat-layout"><aside className="nurse-chat-list">{threads.length ? threads.map(thread => <button className={`nurse-chat-thread${activeThread === thread.threadId ? " active" : ""}`} key={thread.threadId} onClick={() => setActiveThread(thread.threadId)}><span className="nurse-thread-avatar">{thread.senderName[0]}</span><span><strong>{thread.senderName}</strong><small>{thread.body}</small><time>{new Date(thread.createdAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</time></span></button>) : <div className="nurse-chat-empty"><span>✦</span><strong>Todo al día</strong><small>No tienes mensajes pendientes.</small></div>}</aside><section className="nurse-chat-conversation">{activeThread && activeMessages.length ? <><div className="nurse-chat-conversation-head"><div><span className="nurse-online-dot" /> Conversación activa</div><small>{activeMessages.length} mensajes</small></div><div className="nurse-chat-bubbles">{activeMessages.map(message => <article className={`nurse-chat-bubble ${message.senderRole}`} key={message.id}><strong>{message.senderName}</strong><p>{message.body}</p><small>{new Date(message.createdAt).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}</small></article>)}</div><div className="nurse-chat-compose"><input value={reply} onChange={event => setReply(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); const source = activeMessages.find(message => message.senderRole === "doctor"); if (source) void sendReply(source); } }} placeholder="Escribe una respuesta al doctor…" /><button onClick={() => { const source = activeMessages.find(message => message.senderRole === "doctor"); if (source) void sendReply(source); }} disabled={!reply.trim()}>Enviar <span>↗</span></button></div></> : <div className="nurse-chat-empty nurse-chat-empty-main"><span>☵</span><strong>Selecciona una conversación</strong><small>Los mensajes del doctor aparecerán aquí.</small></div>}</section></div></section></div>}
    {selected && <div className="modalback"><section className="proposal"><div className="proposalhead"><div><span className="eyebrow">Registro de visita</span><strong style={{ fontFamily: "Manrope", display: "block", marginTop: 4 }}>{selected.title}</strong></div><button className="iconbtn" onClick={() => setSelected(null)}>×</button></div><div className="proposalbody"><p className="proposalnote">Al confirmar se guarda automáticamente la hora, la enfermera, la administración y los signos vitales capturados.</p>{(["temperature", "bloodPressure", "heartRate", "respiratoryRate", "oxygenSaturation", "notes"] as const).map(k => <label className="formlabel" key={k}>{k === "temperature" ? "Temperatura (°C)" : k === "bloodPressure" ? "Presión arterial" : k === "heartRate" ? "Frecuencia cardíaca (lpm)" : k === "respiratoryRate" ? "Respiraciones por minuto" : k === "oxygenSaturation" ? "Saturación de oxígeno (%)" : "Observaciones"}<input className="field" value={vitals[k]} onChange={e => setVitals({ ...vitals, [k]: e.target.value })} /></label>)}</div><div className="proposalfoot"><button className="btn" onClick={() => complete("skipped")}>Omitir</button><button className="btn primary" onClick={() => complete("completed")}>Confirmar visita y medicamento</button></div></section></div>}
  </main>;
}
