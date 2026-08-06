"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Doctor, Plan } from "../../lib/types";
import ChatMarkdown from "../../components/chat-markdown";
import RxlistBot from "../../components/rxlist-bot";
import WhisperVoice from "../../components/whisper-voice";

type Summary = { floors: any[]; patients: any[]; nurses: any[]; shifts: any[]; tasks: any[]; medications: any[]; revision: number };
type PatientDraft = { fullName: string; birthDate: string; reason: string; allergies: string; emergencyContact: string; emergencyPhone: string; floor: string };
type ChatMessage = { who: "bot" | "user"; body: string; kind?: "success" };

const intentLabels: Record<string, string> = {
  update_floor: "Cambio de piso",
  update_user: "Actualización de usuario",
  create_nurse: "Alta de enfermera",
  create_patient: "Registro de paciente",
  assign_patient: "Asignación de paciente",
  move_patient: "Traslado de paciente",
  discharge_patient: "Alta médica",
  create_shift: "Asignación de turno",
  create_medication: "Nueva indicación",
  create_task: "Nueva tarea",
};

function humanAction(value?: string) {
  if (!value) return "Cambio operativo";
  return intentLabels[value] || value.replace(/_/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
}

const monthNumbers: Record<string, string> = { enero: "01", febrero: "02", marzo: "03", abril: "04", mayo: "05", junio: "06", julio: "07", agosto: "08", septiembre: "09", octubre: "10", noviembre: "11", diciembre: "12" };
const yearWords: Record<string, number> = { uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, dieciséis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20 };
function draftFromMessages(messages: { who: "bot" | "user"; body: string }[]): PatientDraft {
  const source = messages.filter(message => message.who === "user").map(message => message.body).join(" ");
  const nameMatch = source.match(/\b(?:paciente|agrega(?:r)? a|registra(?:r)? a)\s+(?:y\s+)?(.+?)(?=\s+(?:como|naci|fecha|con|tiene|le duele|ingreso|piso|principio|principios|motivo|\d{4}[-/]\d{1,2}[-/]\d{1,2}|el\s+\d{4})\b|$)/i);
  const dateMatch = source.match(/\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+del?\s+(?:dos\s*mil\s+)?([a-záéíóú]+|\d{4})/i);
  const reverseDateMatch = source.match(/\b(?:el\s+)?(\d{4})\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(\d{1,2})\b/i);
  let birthDate = "";
  if (dateMatch) {
    const year = /^\d{4}$/.test(dateMatch[3]) ? dateMatch[3] : `20${String(yearWords[dateMatch[3].toLowerCase()] ?? "").padStart(2, "0")}`;
    if (year.length === 4) birthDate = `${year}-${monthNumbers[dateMatch[2].toLowerCase()]}-${dateMatch[1].padStart(2, "0")}`;
  } else if (reverseDateMatch) {
    birthDate = `${reverseDateMatch[1]}-${monthNumbers[reverseDateMatch[2].toLowerCase()]}-${reverseDateMatch[3].padStart(2, "0")}`;
  }
  const cleanName = nameMatch?.[1]?.replace(/\s+/g, " ").trim() || "";
  const reasonFromLabel = source.match(/\b(?:motivo(?: de ingreso)?|por)\s+(.+?)(?=\s+(?:el\s+)?\d{4}|\s+\d{1,2}\s+de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b|$)/i)?.[1];
  const reasonFromName = cleanName && reverseDateMatch ? source.split(new RegExp(cleanName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"))[1]?.split(reverseDateMatch[0])[0] : "";
  const reason = (reasonFromLabel || reasonFromName || "").replace(/^\s*(?:y|con)\s+/i, "").replace(/\s+el\s*$/i, "").trim();
  return { fullName: cleanName, birthDate, reason, allergies: "", emergencyContact: "", emergencyPhone: "", floor: "" };
}

export default function DoctorPage() {
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [text, setText] = useState("");
  const [proposal, setProposal] = useState<Plan | null>(null);
  const [patientDraft, setPatientDraft] = useState<PatientDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<"agy" | "gemini">(process.env.NEXT_PUBLIC_DEFAULT_PROVIDER === "gemini" ? "gemini" : "agy");
  const [revision, setRevision] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedNurse, setSelectedNurse] = useState<any>(null);
  const [resetAccess, setResetAccess] = useState<any>(null);
  const [expandedFloors, setExpandedFloors] = useState<Record<number, boolean>>({});
  const [censusTab, setCensusTab] = useState<"patients" | "nurses">("patients");
  const [patientFilter, setPatientFilter] = useState<"all" | "admitted" | "unassigned" | "discharged">("admitted");
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [patientFloor, setPatientFloor] = useState("");
  const [patientBed, setPatientBed] = useState("");
  const [patientNotice, setPatientNotice] = useState("");
  const [shiftNotice, setShiftNotice] = useState("");
  const [activeView, setActiveView] = useState<"chat" | "dashboard">("dashboard");
  const [mobilePanel, setMobilePanel] = useState<"floors" | "patients" | "staff" | "tasks" | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const router = useRouter();

  async function load() {
    const r = await fetch("/api/doctor/summary");
    if (!r.ok) { router.push("/login"); return; }
    const x = await r.json(); const shifts = x.shifts || []; x.floors = x.floors.map((f:any) => { const staff = (x.doctor.nurses || []).filter((n:any) => n.floor === f.id && n.status !== "inactive"); const day = staff.some((n:any) => shifts.some((s:any) => s.nurseId === n.id && s.floor === f.id && s.kind === "day" && s.status === "scheduled")); const night = staff.some((n:any) => shifts.some((s:any) => s.nurseId === n.id && s.floor === f.id && s.kind === "night" && s.status === "scheduled")); const missing = staff.length < 2 ? `⚠️ Faltan ${2 - staff.length} enfermeras` : !day && !night ? "⚠️ Faltan turnos de día y noche" : !day ? "⚠️ Falta turno de día" : !night ? "⚠️ Falta turno de noche" : "✓ Cobertura completa"; return { ...f, description: `${f.description} · ${missing}`, coverageLabel: missing, coverageOk: staff.length >= 2 && day && night }; }); setDoctor(x.doctor); setSummary(x); setRevision(x.revision);
  }
  useEffect(() => { load(); const saved = window.localStorage.getItem("rxlist_provider"); if (saved === "gemini") setProvider("gemini"); const change = (event: Event) => setProvider((event as CustomEvent<"agy" | "gemini">).detail); window.addEventListener("rxlist:provider-changed", change); return () => window.removeEventListener("rxlist:provider-changed", change); }, []);
  useEffect(() => { const box = document.querySelector(".messages") as HTMLElement | null; if (box) box.scrollTo({ top: box.scrollHeight, behavior: "smooth" }); }, [messages, proposal, loading]);
  useEffect(() => { setResetAccess(null); setShiftNotice(""); }, [selectedNurse?.id]);
  useEffect(() => { const modal = document.querySelector(".nursemodal"); if (!modal || !selectedNurse || !summary) return; const assigned = summary.shifts.some(s => s.nurseId === selectedNurse.id && s.status === "scheduled"); const actions = modal.querySelectorAll(".proposalfoot .btn:not(.primary)"); actions.forEach(button => { (button as HTMLElement).style.display = assigned ? "none" : ""; }); const schedule = modal.querySelector(".shiftcards") as HTMLElement | null; if (schedule) schedule.style.display = assigned ? "none" : ""; }, [selectedNurse?.id, summary?.shifts]);
  useEffect(() => { const reset = () => { setMessages([]); setProposal(null); setPatientDraft(null); setText(""); }; window.addEventListener("rxlist:chat-closed", reset); return () => window.removeEventListener("rxlist:chat-closed", reset); }, []);

  function openAiPatientDraft(plan: any, fallback?: PatientDraft) {
    const operation = plan?.operations?.find((item: any) => item?.action === "create_patient");
    if (plan?.type !== "clarification" || !operation) return false;
    const draft = { fullName: operation.fullName || fallback?.fullName || "", birthDate: operation.birthDate || fallback?.birthDate || "", reason: operation.reason || fallback?.reason || "", allergies: operation.allergies || fallback?.allergies || "", emergencyContact: operation.emergencyContact || fallback?.emergencyContact || "", emergencyPhone: operation.emergencyPhone || fallback?.emergencyPhone || "", floor: operation.floor != null ? String(operation.floor) : fallback?.floor || "" };
    setPatientDraft(draft);
    window.dispatchEvent(new CustomEvent("rxlist:patient-draft", { detail: { ...draft, floors: summary?.floors || [] } }));
    return true;
  }

  async function ask(messageOverride?: string | React.SyntheticEvent) {
    const q = (typeof messageOverride === "string" ? messageOverride : text).trim();
    if (!q || loading) return;
    setText(""); setMessages(m => [...m, { who: "user", body: q }]); setLoading(true);
    const startedAt = performance.now();
    document.body.dataset.rxlistLastMessage = q;
    document.body.dataset.rxlistError = "";
    if (provider === "gemini") {
      const streamed = await fetch("/api/chat/propose", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: q, provider, stream: true }) });
      if (streamed.headers.get("content-type")?.includes("text/event-stream") && streamed.body) {
        setMessages(m => [...m, { who: "bot", body: "" }]);
        const reader = streamed.body.getReader(); const decoder = new TextDecoder(); let buffer = ""; let finalPayload: any = null;
        const handleEvent = (raw: string) => {
          const event = raw.match(/^event:\s*(.+)$/m)?.[1]?.trim(); const data = raw.match(/^data:\s*(.+)$/m)?.[1]?.trim(); if (!data) return;
          const payload = JSON.parse(data);
          if (event === "start") { document.body.dataset.rxlistProvider = payload.provider || "gemini"; document.body.dataset.rxlistRoute = "gemini-stream"; }
          if (event === "delta") setMessages(m => m.map((item, index) => index === m.length - 1 ? { ...item, body: item.body + String(payload.text || "") } : item));
          if (event === "done") finalPayload = payload;
          if (event === "error") finalPayload = { error: payload.message };
        };
        while (true) { const part = await reader.read(); if (part.done) break; buffer += decoder.decode(part.value, { stream: true }).replace(/\r\n/g, "\n"); const events = buffer.split("\n\n"); buffer = events.pop() || ""; events.filter(Boolean).forEach(handleEvent); }
        if (buffer.trim()) handleEvent(buffer);
        setLoading(false); document.body.dataset.rxlistHttpStatus = String(streamed.status); document.body.dataset.rxlistDurationMs = String(Math.round(performance.now() - startedAt)); document.body.dataset.rxlistProvider = "gemini";
        if (finalPayload?.proposal) { setMessages(m => m.map((item, index) => index === m.length - 1 ? { ...item, body: finalPayload.proposal.message } : item)); if (finalPayload.proposal.type === "proposal") setProposal(finalPayload.proposal); else openAiPatientDraft(finalPayload.proposal, draftFromMessages([...messages, { who: "user", body: q }])); }
        else setMessages(m => m.map((item, index) => index === m.length - 1 ? { ...item, body: finalPayload?.error ? `Gemini no pudo completar la respuesta: ${finalPayload.error}` : "No pude procesar la respuesta de Gemini." } : item));
        return;
      }
    }
    const r = await fetch("/api/chat/propose", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: q, provider }) });
    const x = await r.json(); setLoading(false);
    document.body.dataset.rxlistHttpStatus = String(r.status);
    document.body.dataset.rxlistDurationMs = String(x.debug?.durationMs ?? Math.round(performance.now() - startedAt));
    document.body.dataset.rxlistRoute = x.debug?.route || "(desconocida)";
    document.body.dataset.rxlistProvider = x.debug?.provider || x.provider || "(desconocido)";
    document.body.dataset.rxlistRevision = String(x.revision ?? "(desconocida)");
    document.body.dataset.rxlistContext = x.debug?.context ? JSON.stringify(x.debug.context) : "(sin datos)";
    document.body.dataset.rxlistHistoryLines = String(x.debug?.historyLines ?? "(sin datos)");
    document.body.dataset.rxlistMessageLength = String(x.debug?.messageLength ?? q.length);
    document.body.dataset.rxlistPromptLength = String(x.debug?.promptLength ?? "(sin datos)");
    document.body.dataset.rxlistAgyTimeoutMs = String(x.debug?.agyTimeoutMs ?? "(sin datos)");
    if (!r.ok) document.body.dataset.rxlistError = x.error || "request_failed";
    if (!r.ok) { setMessages(m => [...m, { who: "bot", body: "No pude procesar la solicitud." }]); return; }
    setMessages(m => [...m, { who: "bot", body: x.proposal.message }]);
    if (x.proposal.type === "proposal") setProposal(x.proposal);
    const clarificationMessage = String(x.proposal.message || "");
    const requestsPatientFields = /paciente/i.test(clarificationMessage) && /fecha|alergia|contacto|motivo|piso|cama|datos obligatorios/i.test(clarificationMessage) && !/enfermer/i.test(clarificationMessage);
    if (!openAiPatientDraft(x.proposal, draftFromMessages([...messages, { who: "user", body: q }])) && x.proposal.type === "clarification" && !/enfermer/i.test(clarificationMessage) && (x.proposal.intent === "create_patient" || requestsPatientFields)) { const draft = draftFromMessages([...messages, { who: "user", body: q }]); setPatientDraft(draft); window.dispatchEvent(new CustomEvent("rxlist:patient-draft", { detail: { ...draft, floors: summary?.floors || [] } })); }
  }

  async function savePatientDraft(d: PatientDraft) {
    setLoading(true);
    const proposal = { type: "proposal", intent: "create_patient", message: `Se propone registrar a ${d.fullName} en el piso ${d.floor}.`, operations: [{ action: "create_patient", fullName: d.fullName.trim(), birthDate: d.birthDate, reason: d.reason.trim(), allergies: d.allergies.trim(), emergencyContact: d.emergencyContact.trim(), emergencyPhone: d.emergencyPhone.trim(), floor: Number(d.floor) }] };
    const r = await fetch("/api/chat/confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ proposal, revision }) });
    const x = await r.json();
    setLoading(false);
    if (!r.ok) {
      setMessages(m => [...m, { who: "bot", body: x.error === "revision_conflict" ? "La información cambió mientras llenabas el formulario. Actualicé el panel; vuelve a intentarlo." : "No se pudo guardar el paciente: " + x.error }]);
      await load();
      return;
    }
    setMessages(m => [...m, { who: "bot", kind: "success", body: `Paciente ${d.fullName} guardado correctamente. La cama se asignó automáticamente.` }]);
    await load();
  }

  useEffect(() => { const submit = (event: Event) => { void savePatientDraft((event as CustomEvent<PatientDraft>).detail); }; window.addEventListener("rxlist:patient-draft-confirm", submit); return () => window.removeEventListener("rxlist:patient-draft-confirm", submit); }, [revision]);

  function submitPatientDraft(event: React.FormEvent) {
    event.preventDefault();
    if (!patientDraft) return;
    const d = patientDraft;
    const message = `Registra al paciente ${d.fullName}, fecha de nacimiento ${d.birthDate}, motivo de ingreso ${d.reason}, alergias ${d.allergies}, contacto de emergencia ${d.emergencyContact} teléfono ${d.emergencyPhone}, piso ${d.floor}. La cama debe asignarse automáticamente.`;
    setPatientDraft(null);
    ask(message);
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
  async function addShift(kind:"day"|"night") { if (!selectedNurse || selectedNurse.floor === "unassigned") return; const r = await fetch("/api/shifts", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({ nurseId:selectedNurse.id, floor:selectedNurse.floor, kind }) }); if (r.ok) await load(); else { const x = await r.json(); setShiftNotice(x.error === "nurse_one_shift_only" ? "Cada enfermero solo puede tener un turno." : x.error === "floor_shift_conflict" ? "Ese piso ya tiene cubierto ese turno." : "No se pudo asignar el turno."); } }
  async function resetNursePassword() { if (!selectedNurse) return; const r = await fetch(`/api/doctor/nurses/${selectedNurse.id}`, { method:"PATCH", headers:{"content-type":"application/json"}, body:JSON.stringify({ action:"reset_password" }) }); const x = await r.json(); if (r.ok) setResetAccess(x); }
  async function updatePatient(action: "assign" | "discharge") {
    if (!selectedPatient) return;
    const dischargeReason = action === "discharge" ? window.prompt("Indica la causa del alta médica")?.trim() : undefined;
    if (action === "discharge" && !dischargeReason) { setPatientNotice("El alta médica necesita una causa."); return; }
    const body = action === "discharge" ? { action, reason: dischargeReason } : { action: "assign", floor: Number(patientFloor), bed: Number(patientBed) };
    const r = await fetch(`/api/patients/${selectedPatient.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const x = await r.json();
    if (!r.ok) { setPatientNotice(x.error === "bed_unavailable" ? "Esa cama no está disponible." : "No se pudo actualizar al paciente."); return; }
    setSelectedPatient(null); setPatientFloor(""); setPatientBed(""); setPatientNotice(""); await load();
  }
  if (!doctor || !summary) return <div className="page">Cargando panel…</div>;
  const occupied = summary.patients.filter(p => p.status !== "discharged" && p.floor !== "unassigned").length;
  const total = summary.floors.reduce((n, f) => n + f.beds, 0);
  const pendingTasks = summary.tasks.filter(t => t.status === "pending");
  const admittedPatients = summary.patients.filter(p => p.status !== "discharged");
  const unassignedPatients = summary.patients.filter(p => p.status === "admitted" && p.floor === "unassigned");
  const uncoveredFloors = summary.floors.filter(f => !f.coverageOk);
  const activeNurses = doctor.nurses.filter(n => n.status !== "inactive");
  const nextTask = pendingTasks.slice().sort((a, b) => String(a.scheduledAt).localeCompare(String(b.scheduledAt)))[0];
  const alerts = [
    ...unassignedPatients.map(p => ({ tone: "warning", title: `${p.fullName} no tiene cama`, detail: "Paciente registrado sin ubicación asignada." })),
    ...uncoveredFloors.map(f => ({ tone: "danger", title: `Piso ${f.id} sin cobertura completa`, detail: f.coverageLabel })),
    ...pendingTasks.map(task => ({ tone: "info", title: task.title, detail: "Tarea pendiente" })),
  ];

  return <main className="shell">
    <header className="topbar"><div className="brand"><span className="mark">✚</span> RXList</div><div className="topright"><span>Dr. {doctor.name}</span><span className="avatar">{doctor.name[0]}</span><button className="doctor-chat-link" onClick={() => router.push("/chat")}>Ir al chat</button><button className="btn ghost" onClick={logout}>Cerrar sesión</button><button className="doctor-account-trigger" onClick={() => setAccountOpen(x => !x)} aria-label="Abrir cuenta"><span className="avatar">{doctor.name[0]}</span><span>Cuenta</span></button></div></header>
    <section className="page"><div className="view-switch" role="tablist" aria-label="Vista principal"><button className={activeView === "chat" ? "active" : ""} onClick={() => setActiveView("chat")} role="tab" aria-selected={activeView === "chat"}>Chat</button><button className={activeView === "dashboard" ? "active" : ""} onClick={() => setActiveView("dashboard")} role="tab" aria-selected={activeView === "dashboard"}>Dashboard</button></div>
      {activeView === "dashboard" && <section className="ops-dashboard">
        <div className="ops-heading"><div><span className="eyebrow">Guardia en curso</span><h1>Lo que requiere atención</h1><p>Pacientes, tareas y cobertura de enfermería de tu turno.</p></div><span className="ops-status"><i></i> Guardia activa</span></div>
        <div className="ops-overview"><div className="ops-alert-card"><div className="ops-card-label">Atención de la guardia <b>{alerts.length}</b></div>{alerts.length ? alerts.slice(0, 3).map((alert, i) => <div className="ops-alert-item" key={`${alert.title}-${i}`}><span className={`ops-alert-dot ${alert.tone}`}></span><span>{alert.title}</span></div>) : <p className="ops-clear">No hay incidencias pendientes.</p>}</div></div>
        <div className="ops-columns"><div className="ops-section"><div className="ops-section-head"><div><span className="eyebrow">Ubicación y cobertura</span><h2>Estado de los pisos</h2></div><span className="ops-muted">{summary.floors.length} pisos</span></div><div className="ops-floor-grid">{summary.floors.map(f => { const floorPatients = admittedPatients.filter(p => p.floor === f.id); const floorStaff = doctor.nurses.filter(n => n.floor === f.id && n.status !== "inactive"); const ratio = f.beds ? Math.min((floorPatients.length / f.beds) * 100, 100) : 0; return <div className="ops-floor-card" key={f.id}><div className="ops-floor-top"><span className="ops-floor-icon">{f.id}</span><div><strong>{f.name}</strong><small>Piso {f.id} · {floorStaff.length} enfermeras</small></div><b>{floorPatients.length}/{f.beds}</b></div><div className="ops-floor-bar"><i style={{width: `${ratio}%`}}></i></div><div className="ops-floor-bottom"><span>{floorPatients.length ? `${floorPatients.length} pacientes` : "Sin pacientes"}</span><span>{f.beds - floorPatients.length} camas libres</span></div></div>})}</div></div>
          <div className="ops-section ops-side-section"><div className="ops-section-head"><div><span className="eyebrow">Pacientes a tu cargo</span><h2>Ingresados ahora</h2></div><span className="ops-number">{admittedPatients.length}</span></div><div className="ops-patient-list">{admittedPatients.slice(0, 6).map(p => <button key={p.id} onClick={() => { setSelectedPatient(p); setPatientFloor(typeof p.floor === "number" ? String(p.floor) : ""); setPatientBed(p.bed ? String(p.bed) : ""); }}><span className="ops-patient-avatar">{p.fullName[0]}</span><span><strong>{p.fullName}</strong><small>{p.reason || "Motivo no registrado"} · {p.floor === "unassigned" ? "Sin cama" : `Piso ${p.floor} · Cama ${p.bed || "—"}`}</small></span><b>›</b></button>)}{!admittedPatients.length && <span className="empty">No hay pacientes ingresados.</span>}</div></div>
        </div>
        <div className="ops-bottom"><div><span className="eyebrow">Cobertura del turno</span><h2>Enfermería disponible</h2><div className="ops-staff-list">{doctor.nurses.slice(0, 6).map(n => <button key={n.id} onClick={() => setSelectedNurse(n)}><span className="ops-staff-avatar">{n.name[0]}</span><span><strong>{n.name}</strong><small>{n.floor === "unassigned" ? "Sin piso asignado" : `Piso ${n.floor}`}</small></span><i className={n.status === "inactive" ? "off" : ""}></i></button>)}</div></div><div><span className="eyebrow">Pendientes del turno</span><h2>Cuidados por realizar <em>{pendingTasks.length}</em></h2><div className="ops-task-list">{pendingTasks.slice(0, 4).map(t => <div key={t.id}><span className="ops-task-check"></span><span>{t.title}</span></div>)}{!pendingTasks.length && <span className="empty">No hay tareas pendientes.</span>}</div></div></div>
      </section>}
      {activeView === "chat" && <><div className="stats"><div className="stat"><strong>{summary.patients.length}</strong><span>Pacientes</span></div><div className="stat"><strong>{occupied}/{total}</strong><span>Camas ocupadas</span></div><div className="stat"><strong>{doctor.nurses.length}</strong><span>Enfermeras</span></div><div className="stat"><strong>{pendingTasks.length}</strong><span>Tareas pendientes</span></div></div><aside className="chat-sidebar"><div className="sidebar-clinical"><div className="sidebar-head"><span className="eyebrow">Estado de la guardia</span><span className="sidebar-live"><i></i> Activa</span></div><div className="sidebar-shift"><strong>{new Date().getHours() >= 5 && new Date().getHours() < 17 ? "Turno de día" : "Turno de noche"}</strong><span>{activeNurses.length} enfermeras activas · {alerts.length} alertas</span></div>{nextTask ? <div className="sidebar-next"><span>Próxima tarea</span><strong>{nextTask.title}</strong><small>{nextTask.scheduledAt ? new Date(nextTask.scheduledAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) : "Sin hora"}</small></div> : <div className="sidebar-next"><span>Próxima tarea</span><strong>No hay tareas pendientes</strong><small>La guardia está al día</small></div>}<div className="sidebar-beds"><span>Camas libres por piso</span>{summary.floors.map(f => <div key={f.id}><span>Piso {f.id}</span><b>{Math.max(f.beds - summary.patients.filter(p => p.status !== "discharged" && p.floor === f.id).length, 0)}</b></div>)}</div></div><div className="sidebar-actions"><span className="eyebrow">Acciones rápidas</span><button onClick={() => { setText("¿Qué pacientes tengo ahora mismo?"); document.querySelector<HTMLTextAreaElement>(".composer textarea")?.focus(); }}>Ver pacientes <b>→</b></button><button onClick={() => { setText("¿Qué tareas están pendientes?"); document.querySelector<HTMLTextAreaElement>(".composer textarea")?.focus(); }}>Revisar tareas <b>→</b></button><button onClick={() => { setText("¿Qué camas están disponibles?"); document.querySelector<HTMLTextAreaElement>(".composer textarea")?.focus(); }}>Asignar cama <b>→</b></button><button onClick={() => { setText("Registra un medicamento"); document.querySelector<HTMLTextAreaElement>(".composer textarea")?.focus(); }}>Registrar medicamento <b>→</b></button></div></aside></>}
      <div className={"dashboard " + (activeView === "chat" ? "view-chat" : "view-dashboard")}><section className="panel chat"><div className="panelhead"><div><span className="paneltitle">Asistente de guardia</span></div></div><div className="messages">{messages.map((m, i) => m.kind === "success" ? <div className="message assistant" key={i}><span className="botdot"><RxlistBot size={30} /></span><div className="success-card" role="status"><div className="success-icon" aria-hidden="true"><span>✓</span></div><div className="success-copy"><span className="success-kicker">Registro completado</span><strong>{m.body.split(". La cama")[0]}.</strong><span>La cama se asignó automáticamente.</span></div><span className="success-sparkle" aria-hidden="true">✦</span></div></div> : <div className={"message " + (m.who === "user" ? "user" : "assistant")} key={i}>{m.who === "bot" && <span className="botdot"><RxlistBot size={30} /></span>}{m.who === "bot" ? <ChatMarkdown text={m.body} /> : <span>{m.body}</span>}</div>)}{loading && <div className="message assistant"><span className="botdot"><RxlistBot emotion="thinking" size={30} /></span><span>Preparando tu propuesta…</span></div>}{proposal && <div className="proposal proposal-inline"><div className="proposalhead"><div><div className="eyebrow">Revisión antes de aplicar</div><strong style={{ fontFamily: "Manrope", fontSize: 18 }}>{humanAction(proposal.intent)}</strong></div><button className="iconbtn" onClick={() => setProposal(null)} aria-label="Cerrar propuesta">×</button></div><div className="proposalbody"><p className="proposalnote">{proposal.message}</p>{proposal.operations.map((op: any, i: number) => <div className="move" key={i}><strong>{op.action === "create_patient" ? op.fullName : op.action === "create_nurse" ? op.name : op.action === "create_medication" ? op.name : humanAction(op.action)}</strong><span>{op.floor ? "Piso " + op.floor : "Revisar datos"}</span><span>✓</span><span>{op.bed ? "Cama " + op.bed : "Pendiente"}</span></div>)}</div><div className="proposalfoot"><button className="btn" onClick={() => setProposal(null)}>Rechazar cambio</button><button className="btn primary" onClick={confirm}>Aceptar cambio</button></div></div>}</div><div className="composer"><div className="composerbox"><textarea value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }} placeholder="Ej. registra a Juanito Pérez y asígnalo al piso 1…"/><WhisperVoice /><button className="send" onClick={ask}>↑</button></div><small style={{ color: "var(--muted)", fontSize: 11 }}>La IA propone; el servidor valida; tú decides.</small></div></section>
        <section className="panel"><div className="panelhead"><span className="paneltitle">Estado por piso</span><span className="count"><a href="/demo">Ver dashboard completo</a></span></div><div className="floorlist">{summary.floors.map(f => { const staff = doctor.nurses.filter(n => n.floor === f.id); const expanded = !!expandedFloors[f.id]; return <div className="floor" key={f.id}><div className="floorrow"><span className="floortitle">Piso {f.id} · {f.name}</span><span className="floorhint">{summary.patients.filter(p => p.floor === f.id).length}/{f.beds} camas</span></div><div className="floorhint">{f.description}</div><button className="stafftoggle" onClick={() => setExpandedFloors(x => ({ ...x, [f.id]: !expanded }))}><span><strong>{staff.length}</strong> enfermera{staff.length === 1 ? "" : "s"}</span><span>{expanded ? "⌃" : "⌄"}</span></button>{expanded && <div className="floorstaff">{staff.length ? staff.map((n: any) => <button className="staffchip" key={n.id} onClick={() => setSelectedNurse(n)}><span className="staffavatar">{n.name[0]}</span><span><strong>{n.name}</strong><small>{n.email || "@rxlist.com"}</small></span><i className={n.status === "inactive" ? "staffstatus off" : "staffstatus"}></i></button>) : <span className="empty">Sin personal asignado</span>}</div>}</div>; })}</div></section>
      </div>
      <section className="panel census-panel"><div className="panelhead"><div><span className="paneltitle">Censo operativo</span><p className="census-subtitle">Consulta quién está registrado, asignado y dado de alta.</p></div><div className="census-tabs"><button className={censusTab === "patients" ? "active" : ""} onClick={() => setCensusTab("patients")}>Pacientes</button><button className={censusTab === "nurses" ? "active" : ""} onClick={() => setCensusTab("nurses")}>Enfermeras</button></div></div>{censusTab === "patients" ? <><div className="census-toolbar"><div className="census-filters">{(["admitted", "unassigned", "discharged", "all"] as const).map(filter => <button key={filter} className={patientFilter === filter ? "active" : ""} onClick={() => setPatientFilter(filter)}>{filter === "admitted" ? "Ingresados" : filter === "unassigned" ? "Sin cama" : filter === "discharged" ? "Dados de alta" : "Todos"}</button>)}</div><span className="count">{summary.patients.filter(p => patientFilter === "all" || patientFilter === "admitted" && p.status === "admitted" && p.floor !== "unassigned" || patientFilter === "unassigned" && p.status === "admitted" && p.floor === "unassigned" || patientFilter === "discharged" && p.status === "discharged").length} registros</span></div><div className="census-list">{summary.patients.filter(p => patientFilter === "all" || patientFilter === "admitted" && p.status === "admitted" && p.floor !== "unassigned" || patientFilter === "unassigned" && p.status === "admitted" && p.floor === "unassigned" || patientFilter === "discharged" && p.status === "discharged").map(p => <button className="census-row" key={p.id} onClick={() => { setSelectedPatient(p); setPatientFloor(typeof p.floor === "number" ? String(p.floor) : ""); setPatientBed(p.bed ? String(p.bed) : ""); }}><span className="census-avatar">{p.fullName[0]}</span><span className="census-main"><strong>{p.fullName}</strong><small>{p.birthDate}{p.reason ? ` · ${p.reason}` : ""}</small></span><span className={p.status === "discharged" ? "state-badge discharged" : p.floor === "unassigned" ? "state-badge unassigned" : "state-badge admitted"}>{p.status === "discharged" ? "Dado de alta" : p.floor === "unassigned" ? "Registrado · sin cama" : `Ingresado · Piso ${p.floor} · Cama ${p.bed || "—"}`}</span></button>)}{!summary.patients.some(p => patientFilter === "all" || patientFilter === "admitted" && p.status === "admitted" && p.floor !== "unassigned" || patientFilter === "unassigned" && p.status === "admitted" && p.floor === "unassigned" || patientFilter === "discharged" && p.status === "discharged") && <div className="empty census-empty">No hay registros en este estado.</div>}</div></> : <div className="census-list">{doctor.nurses.map((n: any) => <button className="census-row" key={n.id} onClick={() => setSelectedNurse(n)}><span className="census-avatar nurse-census-avatar">{n.name[0]}</span><span className="census-main"><strong>{n.name}</strong><small>{n.email || "Sin correo"} · {n.birthDate || "Fecha no registrada"}</small></span><span className={n.status === "inactive" ? "state-badge discharged" : n.floor === "unassigned" ? "state-badge unassigned" : "state-badge admitted"}>{n.status === "inactive" ? "Inactiva" : n.floor === "unassigned" ? "Registrada · sin piso" : `Activa · Piso ${n.floor}`}</span></button>)}{!doctor.nurses.length && <div className="empty census-empty">No hay enfermeras registradas.</div>}</div>}</section>
    </section>
    <nav className="doctor-mobile-nav" aria-label="Navegación del dashboard"><button className={!mobilePanel ? "active" : ""} onClick={() => setMobilePanel(null)}><span>⌂</span>Resumen</button><button className={mobilePanel === "floors" ? "active" : ""} onClick={() => setMobilePanel("floors")}><span>▦</span>Pisos</button><button onClick={() => router.push("/chat")}><span>✦</span>Chat</button><button className={mobilePanel === "patients" ? "active" : ""} onClick={() => setMobilePanel("patients")}><span>♙</span>Pacientes</button><button className={accountOpen ? "active" : ""} onClick={() => setAccountOpen(x => !x)}><span>•••</span>Más</button></nav>
    {accountOpen && <div className="doctor-account-popover"><div><span className="avatar">{doctor.name[0]}</span><div><strong>Dra. {doctor.name}</strong><small>Sesión activa</small></div></div><button className="btn ghost" onClick={() => { setMobilePanel("staff"); setAccountOpen(false); }}>Ver enfermería</button><button className="btn ghost" onClick={() => { setMobilePanel("tasks"); setAccountOpen(false); }}>Ver tareas</button><button className="btn ghost" onClick={logout}>Cerrar sesión</button></div>}
    {mobilePanel && <div className="doctor-mobile-sheetback" onClick={() => setMobilePanel(null)}><section className="doctor-mobile-sheet" onClick={e => e.stopPropagation()}><div className="doctor-sheet-head"><div><span className="eyebrow">Consulta rápida</span><h2>{mobilePanel === "floors" ? "Estado de los pisos" : mobilePanel === "patients" ? "Pacientes ingresados" : mobilePanel === "staff" ? "Enfermería" : "Tareas pendientes"}</h2></div><button className="iconbtn" onClick={() => setMobilePanel(null)}>×</button></div>{mobilePanel === "floors" && <div className="doctor-sheet-list">{summary.floors.map(f => { const count = admittedPatients.filter(p => p.floor === f.id).length; return <div className="doctor-sheet-row" key={f.id}><span className="ops-floor-icon">{f.id}</span><div><strong>{f.name}</strong><small>{count} pacientes · {summary.nurses.filter(n => n.floor === f.id && n.status !== "inactive").length} enfermeras</small></div><b>{Math.max(f.beds - count, 0)} libres</b></div>; })}</div>}{mobilePanel === "patients" && <div className="doctor-sheet-list">{admittedPatients.map(p => <button className="doctor-sheet-row" key={p.id} onClick={() => { setSelectedPatient(p); setPatientFloor(typeof p.floor === "number" ? String(p.floor) : ""); setPatientBed(p.bed ? String(p.bed) : ""); setMobilePanel(null); }}><span className="ops-patient-avatar">{p.fullName[0]}</span><div><strong>{p.fullName}</strong><small>{p.floor === "unassigned" ? "Sin ubicación" : `Piso ${p.floor} · Cama ${p.bed || "—"}`}</small></div><b>›</b></button>)}</div>}{mobilePanel === "staff" && <div className="doctor-sheet-list">{activeNurses.map(n => <button className="doctor-sheet-row" key={n.id} onClick={() => { setSelectedNurse(n); setMobilePanel(null); }}><span className="ops-staff-avatar">{n.name[0]}</span><div><strong>{n.name}</strong><small>{n.floor === "unassigned" ? "Sin piso" : `Piso ${n.floor}`}</small></div><b>›</b></button>)}</div>}{mobilePanel === "tasks" && <div className="doctor-sheet-list">{pendingTasks.map(t => <div className="doctor-sheet-row" key={t.id}><span className="ops-task-check"></span><div><strong>{t.title}</strong><small>{t.scheduledAt ? new Date(t.scheduledAt).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" }) : "Sin horario"}</small></div></div>)}</div>}</section></div>}
  {selectedPatient && <div className="modalback"><section className="proposal patientmodal"><div className="proposalhead"><div><div className="eyebrow">Ficha del paciente</div><strong style={{fontFamily:"Manrope",fontSize:18}}>{selectedPatient.fullName}</strong></div><button className="iconbtn" onClick={() => setSelectedPatient(null)}>×</button></div><div className="proposalbody"><div className="patient-details"><div><span>Estado</span><strong>{selectedPatient.status === "discharged" ? "Dado de alta" : selectedPatient.floor === "unassigned" ? "Registrado, sin cama" : `Ingresado en piso ${selectedPatient.floor}, cama ${selectedPatient.bed || "—"}`}</strong></div><div><span>Fecha de nacimiento</span><strong>{selectedPatient.birthDate}</strong></div><div><span>Motivo</span><strong>{selectedPatient.reason || "No especificado"}</strong></div><div><span>Ingreso</span><strong>{selectedPatient.admittedAt ? new Date(selectedPatient.admittedAt).toLocaleDateString("es-MX") : "—"}</strong></div></div>{selectedPatient.status !== "discharged" && <><h3 className="modalsectiontitle">Asignar cama</h3><div className="assign-grid"><select className="field" value={patientFloor} onChange={e => setPatientFloor(e.target.value)}><option value="">Selecciona piso</option>{summary.floors.map(f => <option key={f.id} value={f.id}>Piso {f.id} · {f.name}</option>)}</select><input className="field" type="number" min="1" placeholder="Número de cama" value={patientBed} onChange={e => setPatientBed(e.target.value)} /></div>{patientNotice && <p className="error">{patientNotice}</p>}</>}</div><div className="proposalfoot">{selectedPatient.status !== "discharged" && <><button className="btn primary" disabled={!patientFloor || !patientBed} onClick={() => updatePatient("assign")}>{selectedPatient.floor === "unassigned" ? "Dar ingreso y asignar cama" : "Cambiar cama"}</button><button className="btn" onClick={() => updatePatient("discharge")}>Dar de alta</button></>}<button className="btn" onClick={() => setSelectedPatient(null)}>Cerrar</button></div></section></div>}
    {selectedNurse && <div className="modalback"><section className="proposal nursemodal"><div className="proposalhead"><div><div className="eyebrow">Perfil de enfermería</div><strong style={{fontFamily:"Manrope",fontSize:18}}>{selectedNurse.name}</strong></div><button className="iconbtn" onClick={() => setSelectedNurse(null)}>×</button></div><div className="proposalbody"><div className="credential"><span>Correo</span><strong>{selectedNurse.email || "Pendiente"}</strong></div><div className="credential"><span>Estado</span><strong>{selectedNurse.status === "inactive" ? "Inactiva" : selectedNurse.floor === "unassigned" ? "Registrada · sin piso" : `Activa · Piso ${selectedNurse.floor}`}</strong></div><div className="credential"><span>Contraseña</span><button className="btn" onClick={resetNursePassword}>Restablecer contraseña</button></div>{resetAccess&&<div className="resetbox"><strong>Nueva contraseña temporal: {resetAccess.password}</strong><textarea className="field" readOnly value={resetAccess.message}/><button className="btn" onClick={() => navigator.clipboard.writeText(resetAccess.message)}>Copiar mensaje</button></div>}<h3 className="modalsectiontitle">Horario fijo</h3><div className="shiftcards"><div><strong>Día</strong><span>05:00 – 17:00</span></div><div><strong>Noche</strong><span>17:00 – 05:00</span></div></div><div className="assignedshifts">{(summary.shifts||[]).filter(s=>s.nurseId===selectedNurse.id).map(s=><span key={s.id} className="shiftpill">Trabaja de {s.kind === "day" ? "día" : "noche"}</span>)}{!(summary.shifts||[]).some(s=>s.nurseId===selectedNurse.id)&&<span className="empty">Sin turno fijo asignado</span>}</div></div><div className="proposalfoot"><button className="btn" onClick={() => addShift("day")}>Trabaja de día</button><button className="btn" onClick={() => addShift("night")}>Trabaja de noche</button><button className="btn primary" onClick={() => setSelectedNurse(null)}>Cerrar</button></div></section></div>}
  </main>;
}
