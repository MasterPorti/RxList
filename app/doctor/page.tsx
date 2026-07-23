"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Doctor, Plan } from "../../lib/types";
import ChatMarkdown from "../../components/chat-markdown";
import RxlistBot from "../../components/rxlist-bot";

type Summary = { floors: any[]; patients: any[]; nurses: any[]; shifts: any[]; tasks: any[]; medications: any[]; revision: number };

export default function DoctorPage() {
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [text, setText] = useState("");
  const [proposal, setProposal] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const [messages, setMessages] = useState([{ who: "bot", body: "Hola. Entiendo instrucciones naturales sobre enfermeras, pisos, pacientes, turnos y tareas. Siempre te mostraré una propuesta antes de aplicar cambios." }]);
  const [selectedNurse, setSelectedNurse] = useState<any>(null);
  const [resetAccess, setResetAccess] = useState<any>(null);
  const [expandedFloors, setExpandedFloors] = useState<Record<number, boolean>>({});
  const router = useRouter();

  async function load() {
    const r = await fetch("/api/doctor/summary");
    if (!r.ok) { router.push("/login"); return; }
    const x = await r.json(); setDoctor(x.doctor); setSummary(x); setRevision(x.revision);
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { const box = document.querySelector(".messages") as HTMLElement | null; if (box) box.scrollTo({ top: box.scrollHeight, behavior: "smooth" }); }, [messages, proposal, loading]);
  useEffect(() => { setResetAccess(null); }, [selectedNurse?.id]);
  useEffect(() => { const reset = () => { setMessages([{ who: "bot", body: "Hola. Entiendo instrucciones naturales sobre enfermeras, pisos, pacientes, turnos y tareas. Siempre te mostraré una propuesta antes de aplicar cambios." }]); setProposal(null); setText(""); }; window.addEventListener("rxlist:chat-closed", reset); return () => window.removeEventListener("rxlist:chat-closed", reset); }, []);

  async function ask() {
    if (!text.trim() || loading) return;
    const q = text.trim(); setText(""); setMessages(m => [...m, { who: "user", body: q }]); setLoading(true);
    const r = await fetch("/api/chat/propose", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: q }) });
    const x = await r.json(); setLoading(false);
    if (!r.ok) { setMessages(m => [...m, { who: "bot", body: "No pude procesar la solicitud." }]); return; }
    setMessages(m => [...m, { who: "bot", body: x.proposal.message }]); if (x.proposal.type === "proposal") setProposal(x.proposal);
  }

  async function confirm() {
    if (!proposal) return;
    const r = await fetch("/api/chat/confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ proposal, revision }) });
    const x = await r.json();
    if (!r.ok) { setMessages(m => [...m, { who: "bot", body: x.error === "revision_conflict" ? "La información cambió mientras revisabas. Actualicé el panel; vuelve a proponer el cambio." : "No se pudo aplicar la propuesta: " + x.error }]); setProposal(null); await load(); return; }
    setProposal(null);
    if (x.nurseAccess?.length) window.dispatchEvent(new CustomEvent("rxlist:nurse-access", { detail: x.nurseAccess }));
    const access = (x.nurseAccess || []).map((n: any) => `\n\nAcceso de ${n.name}:\nCorreo: ${n.email}\nContraseña temporal: ${n.password}\nMensaje para compartir:\n${n.message}`).join("");
    setMessages(m => [...m, { who: "bot", body: "Listo. El cambio fue aplicado y quedó auditado." + access }]); await load();
  }

  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); router.push("/login"); }
  async function addShift(kind:"day"|"night") { if (!selectedNurse || selectedNurse.floor === "unassigned") return; const r = await fetch("/api/shifts", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({ nurseId:selectedNurse.id, floor:selectedNurse.floor, kind }) }); if (r.ok) await load(); }
  async function resetNursePassword() { if (!selectedNurse) return; const r = await fetch(`/api/doctor/nurses/${selectedNurse.id}`, { method:"PATCH", headers:{"content-type":"application/json"}, body:JSON.stringify({ action:"reset_password" }) }); const x = await r.json(); if (r.ok) setResetAccess(x); }
  if (!doctor || !summary) return <div className="page">Cargando panel…</div>;
  const occupied = summary.patients.filter(p => p.status !== "discharged" && p.floor !== "unassigned").length;
  const total = summary.floors.reduce((n, f) => n + f.beds, 0);

  return <main className="shell">
    <header className="topbar"><div className="brand"><span className="mark">✚</span> RXList</div><div className="topright"><span>Dr. {doctor.name}</span><span className="avatar">{doctor.name[0]}</span><button className="btn ghost" onClick={logout}>Cerrar sesión</button></div></header>
    <section className="page"><div className="eyebrow">Panel médico</div><h1 className="headline">Tu guardia, en orden.</h1><p className="sub">Lenguaje natural, propuestas revisables y control por turnos.</p>
      <div className="stats"><div className="stat"><strong>{summary.patients.length}</strong><span>Pacientes</span></div><div className="stat"><strong>{occupied}/{total}</strong><span>Camas ocupadas</span></div><div className="stat"><strong>{doctor.nurses.length}</strong><span>Enfermeras</span></div><div className="stat"><strong>{summary.tasks.filter(t => t.status === "pending").length}</strong><span>Tareas pendientes</span></div></div>
      <div className="dashboard"><section className="panel chat"><div className="panelhead"><span className="paneltitle">Asistente de guardia</span><span className="count">● AGY + validación RXList</span></div><div className="messages">{messages.map((m, i) => <div className={"message " + (m.who === "user" ? "user" : "assistant")} key={i}>{m.who === "bot" && <span className="botdot"><RxlistBot size={30} /></span>}{m.who === "bot" ? <ChatMarkdown text={m.body} /> : <span>{m.body}</span>}</div>)}{loading && <div className="message assistant"><span className="botdot"><RxlistBot emotion="thinking" size={30} /></span><span>Analizando contexto…</span></div>}{proposal && <div className="proposal proposal-inline"><div className="proposalhead"><div><div className="eyebrow">Propuesta para confirmar</div><strong style={{ fontFamily: "Manrope", fontSize: 18 }}>{proposal.intent || "Cambio operativo"}</strong></div><button className="iconbtn" onClick={() => setProposal(null)}>×</button></div><div className="proposalbody"><p className="proposalnote">{proposal.message}</p>{proposal.operations.map((op: any, i: number) => <div className="move" key={i}><strong>{op.action === "create_patient" ? op.fullName : op.action === "create_nurse" ? op.name : op.action === "create_medication" ? op.name : op.action || "Operación"}</strong><span>{op.floor ? "Piso " + op.floor : "Revisar datos"}</span><span>✓</span><span>{op.bed ? "Cama " + op.bed : "Pendiente"}</span></div>)}</div><div className="proposalfoot"><button className="btn" onClick={() => setProposal(null)}>Cancelar</button><button className="btn primary" onClick={confirm}>Aceptar y aplicar</button></div></div>}</div><div className="composer"><div className="composerbox"><textarea value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }} placeholder="Ej. registra a Juanito Pérez y asígnalo al piso 1…"/><button className="send" onClick={ask}>↑</button></div><small style={{ color: "var(--muted)", fontSize: 11 }}>La IA propone; el servidor valida; tú decides.</small></div></section>
        <section className="panel"><div className="panelhead"><span className="paneltitle">Estado por piso</span><span className="count"><a href="/demo">Ver dashboard completo</a></span></div><div className="floorlist">{summary.floors.map(f => { const staff = doctor.nurses.filter(n => n.floor === f.id); const expanded = !!expandedFloors[f.id]; return <div className="floor" key={f.id}><div className="floorrow"><span className="floortitle">Piso {f.id} · {f.name}</span><span className="floorhint">{summary.patients.filter(p => p.floor === f.id).length}/{f.beds} camas</span></div><div className="floorhint">{f.description}</div><button className="stafftoggle" onClick={() => setExpandedFloors(x => ({ ...x, [f.id]: !expanded }))}><span><strong>{staff.length}</strong> enfermera{staff.length === 1 ? "" : "s"}</span><span>{expanded ? "⌃" : "⌄"}</span></button>{expanded && <div className="floorstaff">{staff.length ? staff.map((n: any) => <button className="staffchip" key={n.id} onClick={() => setSelectedNurse(n)}><span className="staffavatar">{n.name[0]}</span><span><strong>{n.name}</strong><small>{n.email || "@rxlist.com"}</small></span><i className={n.status === "inactive" ? "staffstatus off" : "staffstatus"}></i></button>) : <span className="empty">Sin personal asignado</span>}</div>}</div>; })}</div></section>
      </div>
    </section>
    {selectedNurse && <div className="modalback"><section className="proposal nursemodal"><div className="proposalhead"><div><div className="eyebrow">Perfil de enfermería</div><strong style={{fontFamily:"Manrope",fontSize:18}}>{selectedNurse.name}</strong></div><button className="iconbtn" onClick={() => setSelectedNurse(null)}>×</button></div><div className="proposalbody"><div className="credential"><span>Correo</span><strong>{selectedNurse.email || "Pendiente"}</strong></div><div className="credential"><span>Contraseña</span><button className="btn" onClick={resetNursePassword}>Restablecer contraseña</button></div>{resetAccess&&<div className="resetbox"><strong>Nueva contraseña temporal: {resetAccess.password}</strong><textarea className="field" readOnly value={resetAccess.message}/><button className="btn" onClick={() => navigator.clipboard.writeText(resetAccess.message)}>Copiar mensaje</button></div>}<h3 className="modalsectiontitle">Horario fijo</h3><div className="shiftcards"><div><strong>Día</strong><span>05:00 – 17:00</span></div><div><strong>Noche</strong><span>17:00 – 05:00</span></div></div><div className="assignedshifts">{(summary.shifts||[]).filter(s=>s.nurseId===selectedNurse.id).map(s=><span key={s.id} className="shiftpill">Trabaja de {s.kind === "day" ? "día" : "noche"}</span>)}{!(summary.shifts||[]).some(s=>s.nurseId===selectedNurse.id)&&<span className="empty">Sin turno fijo asignado</span>}</div></div><div className="proposalfoot"><button className="btn" onClick={() => addShift("day")}>Trabaja de día</button><button className="btn" onClick={() => addShift("night")}>Trabaja de noche</button><button className="btn primary" onClick={() => setSelectedNurse(null)}>Cerrar</button></div></section></div>}
  </main>;
}
