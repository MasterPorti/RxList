"use client";

import { FormEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Plan } from "../../lib/types";
import ChatMarkdown from "../../components/chat-markdown";
import RxlistBot from "../../components/rxlist-bot";
import WhisperVoice from "../../components/whisper-voice";

type Message = { role: "user" | "assistant"; content: string; fromVoice?: boolean; report?: boolean };
type Summary = { doctor: { name: string; email: string }; patients: any[]; nurses: any[]; floors: any[]; revision: number };

const starters = [
  "¿Qué pacientes necesitan atención ahora?",
  "¿Qué camas están disponibles?",
  "Muéstrame las tareas pendientes de mi guardia",
];

function escapeReportHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character] || character));
}

function reportInline(value: string) {
  return escapeReportHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function reportHtml(markdown: string) {
  const lines = markdown.split(/\r?\n/), output: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;
    if (/^#{2,6}\s+/.test(line)) { output.push(`<h2>${reportInline(line.replace(/^#{2,6}\s+/, ""))}</h2>`); continue; }
    if (line.startsWith("|") && lines[index + 1]?.trim().match(/^\|?\s*:?-{3,}/)) {
      const cells = (value: string) => value.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(cell => escapeReportHtml(cell.trim()));
      const head = cells(line); const rows: string[][] = []; index += 2;
      while (index < lines.length && lines[index].trim().startsWith("|")) { rows.push(cells(lines[index])); index += 1; }
      index -= 1;
      output.push(`<table><thead><tr>${head.map(cell => `<th>${cell}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${head.map((_, cellIndex) => `<td>${row[cellIndex] || "-"}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
      continue;
    }
    if (line.includes("\t") && lines[index + 1]?.includes("\t")) {
      const cells = (value: string) => value.split("\t").map(cell => reportInline(cell.trim()));
      const head = cells(line); const rows: string[][] = []; index += 1;
      while (index < lines.length && lines[index].trim().includes("\t")) { rows.push(cells(lines[index].trim())); index += 1; }
      index -= 1;
      output.push(`<table><thead><tr>${head.map(cell => `<th>${cell}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${head.map((_, cellIndex) => `<td>${row[cellIndex] || "-"}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
      continue;
    }
    if (/^[-*]\s+/.test(line)) { output.push(`<li>${escapeReportHtml(line.replace(/^[-*]\s+/, ""))}</li>`); continue; }
    output.push(`<p>${reportInline(line)}</p>`);
  }
  return output.join("");
}

export default function ChatPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [proposal, setProposal] = useState<Plan | null>(null);
  const [notice, setNotice] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [internalMessages, setInternalMessages] = useState<any[]>([]);
  const [selectedInternalThread, setSelectedInternalThread] = useState<string | null>(null);
  const [threadMenu, setThreadMenu] = useState<string | null>(null);
  const [newRecipientIds, setNewRecipientIds] = useState<string[]>([]);
  const [internalDraft, setInternalDraft] = useState("");
  const [sendingInternal, setSendingInternal] = useState(false);
  const [proposalStyle, setProposalStyle] = useState("clinical");
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);
  const lastQuestionRef = useRef("");
  const retryingProposalRef = useRef(false);
  const retryUsedRef = useRef(false);

  useEffect(() => {
    fetch("/api/doctor/summary").then(async response => {
      if (!response.ok) { router.replace("/login"); return; }
      setSummary(await response.json());
    }).catch(() => router.replace("/login"));
  }, [router]);

  useEffect(() => {
    fetch("/api/messages").then(response => response.ok ? response.json() : null).then(result => { if (result) setInternalMessages(result.messages || []); }).catch(() => undefined);
  }, []);

  useEffect(() => {
    const loadStyle = () => { const style = window.localStorage.getItem("rxlist-proposal-style") || "handoff"; setProposalStyle(style); document.body.dataset.rxlistProposalStyle = style; };
    loadStyle();
    window.addEventListener("rxlist:proposal-style-changed", loadStyle);
    return () => window.removeEventListener("rxlist:proposal-style-changed", loadStyle);
  }, []);

  useEffect(() => {
    const handlePatientSaved = () => {
      fetch("/api/doctor/summary").then(response => response.ok ? response.json() : null).then(result => { if (result) setSummary(result); }).catch(() => undefined);
      setMessages(current => [...current, { role: "assistant", content: "Paciente ingresado correctamente. La cama se asignó automáticamente." }]);
    };
    window.addEventListener("rxlist:patient-saved", handlePatientSaved);
    return () => window.removeEventListener("rxlist:patient-saved", handlePatientSaved);
  }, []);

  useLayoutEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const box = messagesRef.current;
      if (box) box.scrollTop = box.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, loading, proposal]);

  function handleMessageScroll() {
    const box = messagesRef.current;
    if (!box) return;
    setShowScrollToBottom(box.scrollHeight - box.scrollTop - box.clientHeight > 180);
  }

  function scrollToBottom() {
    const box = messagesRef.current;
    if (!box) return;
    box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
    setShowScrollToBottom(false);
  }

  useEffect(() => {
    const handleVoiceState = (event: Event) => setVoiceBusy(Boolean((event as CustomEvent<{ busy: boolean }>).detail?.busy));
    window.addEventListener("rxlist:voice-state", handleVoiceState);
    return () => window.removeEventListener("rxlist:voice-state", handleVoiceState);
  }, []);

  useEffect(() => {
    const openReport = (event: Event) => {
      const content = (event as CustomEvent<{ content?: string }>).detail?.content;
      if (content) createPatientPdf(content);
    };
    window.addEventListener("rxlist:open-report", openReport);
    return () => window.removeEventListener("rxlist:open-report", openReport);
  }, []);

  async function ask(value = text, fromVoice = false) {
    const question = value.trim();
    if (!question || loading) return;
    lastQuestionRef.current = question;
    retryUsedRef.current = false;
    const startedAt = performance.now();
    document.body.dataset.rxlistLastMessage = question;
    document.body.dataset.rxlistError = "";
    setText(""); setNotice(""); setMessages(current => [...current, { role: "user", content: question }]); setLoading(true);
    let response: Response;
    try { response = await fetch("/api/chat/propose", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: question, provider: "gemini", stream: false }) }); }
    catch { document.body.dataset.rxlistError = "request_failed"; setMessages(current => [...current, { role: "assistant", content: "No pude conectar con el asistente. Revisa que RXList siga levantado y vuelve a intentarlo." }]); setLoading(false); return; }
    document.body.dataset.rxlistHttpStatus = String(response.status);
    document.body.dataset.rxlistDurationMs = String(Math.round(performance.now() - startedAt));
    document.body.dataset.rxlistProvider = "gemini";
    document.body.dataset.rxlistRoute = "chat-propose";
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      document.body.dataset.rxlistError = result.error || "request_failed";
      setMessages(current => [...current, { role: "assistant", content: response.status === 401 ? "Tu sesión expiró. Vuelve a iniciar sesión." : "No pude conectar con Gemini. Revisa que la API esté configurada y vuelve a intentarlo." }]); setLoading(false); return;
    }
    if (!response.body) { setMessages(current => [...current, { role: "assistant", content: "El asistente no devolvió una respuesta." }]); setLoading(false); return; }
    if (!response.headers.get("content-type")?.includes("text/event-stream")) {
      const result = await response.json().catch(() => null);
      const proposal = result?.proposal;
      document.body.dataset.rxlistProvider = result?.provider || "local";
      setMessages(current => [...current, { role: "assistant", content: isReportRequest(question) ? `Información clínica y operativa\n\n${proposal?.message || "El asistente no devolvió una respuesta válida."}` : (proposal?.message || "El asistente no devolvió una respuesta válida."), fromVoice, report: isReportRequest(question) }]);
      if (proposal?.type === "proposal") setProposal(proposal);
      openPatientDraftFromProposal(proposal);
      document.body.dataset.rxlistRevision = String(result?.revision ?? "(sin datos)");
      document.body.dataset.rxlistContext = result?.debug?.context ? JSON.stringify(result.debug.context) : "(sin datos)";
      document.body.dataset.rxlistHistoryLines = String(result?.debug?.historyLines ?? "(sin datos)");
      document.body.dataset.rxlistMessageLength = String(result?.debug?.messageLength ?? question.length);
      document.body.dataset.rxlistPromptLength = String(result?.debug?.promptLength ?? "(sin datos)");
      setLoading(false); return;
    }
    setMessages(current => [...current, { role: "assistant", content: "", fromVoice, report: isReportRequest(question) }]);
    const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ""; let finalProposal: any = null;
    const event = (raw: string) => {
      const kind = raw.match(/^event:\s*(.+)$/m)?.[1]?.trim(); const data = raw.match(/^data:\s*(.+)$/m)?.[1]?.trim(); if (!data) return;
      try { const payload = JSON.parse(data); if (kind === "delta") setMessages(current => current.map((item, index) => index === current.length - 1 ? { ...item, content: item.content + String(payload.text || "") } : item)); if (kind === "done") finalProposal = payload.proposal; if (kind === "error") setNotice(payload.message || "Gemini no pudo completar la respuesta."); } catch { setNotice("La respuesta de Gemini no fue válida."); }
    };
    while (true) { const part = await reader.read(); if (part.done) break; buffer += decoder.decode(part.value, { stream: true }).replace(/\r\n/g, "\n"); const chunks = buffer.split("\n\n"); buffer = chunks.pop() || ""; chunks.filter(Boolean).forEach(event); }
    if (buffer.trim()) event(buffer);
    if (finalProposal?.message) setMessages(current => current.map((item, index) => index === current.length - 1 ? { ...item, content: isReportRequest(question) ? `Información clínica y operativa\n\n${finalProposal.message}` : finalProposal.message } : item));
    if (finalProposal?.type === "proposal") setProposal(finalProposal);
    openPatientDraftFromProposal(finalProposal);
    setLoading(false);
  }

  async function confirm() {
    if (!proposal || !summary) return;
    setLoading(true);
    const response = await fetch("/api/chat/confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ proposal, revision: summary.revision }) });
    const result = await response.json();
    if (!response.ok) {
      if (!retryUsedRef.current && !retryingProposalRef.current && lastQuestionRef.current) {
        retryUsedRef.current = true;
        retryingProposalRef.current = true;
        setNotice("La propuesta tenía datos incompletos. Estoy pidiendo a Gemini una propuesta corregida…");
        try {
          const retry = await fetch("/api/chat/propose", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: `${lastQuestionRef.current}\n\nLa propuesta anterior falló con el error técnico '${result.error || "validación"}'. Corrige únicamente los datos de la propuesta y devuelve una nueva propuesta válida; no ejecutes nada.`, provider: "gemini", stream: false }) });
          const retryResult = await retry.json().catch(() => null);
          if (retry.ok && retryResult?.proposal) {
            setProposal(retryResult.proposal.type === "proposal" ? retryResult.proposal : null);
            setMessages(current => [...current, { role: "assistant", content: retryResult.proposal.message || "Gemini generó una propuesta corregida." }]);
            setNotice(retryResult.proposal.type === "proposal" ? "Propuesta corregida. Revísala y vuelve a pulsar Aceptar y aplicar." : "Gemini pidió más información para corregir la propuesta.");
          } else {
            setNotice(`No se pudo corregir la propuesta: ${result.error || "error desconocido"}`);
          }
        } catch {
          setNotice(`No se pudo corregir la propuesta: ${result.error || "error desconocido"}`);
        } finally {
          retryingProposalRef.current = false;
          setLoading(false);
        }
        return;
      }
      setLoading(false); setNotice(`No se pudo aplicar el cambio: ${result.error || "error desconocido"}`); return;
    }
    setLoading(false); setProposal(null);
    setMessages(current => [...current, { role: "assistant", content: "Listo. El cambio fue aplicado y quedó auditado." }]);
    const refreshed = await fetch("/api/doctor/summary"); if (refreshed.ok) setSummary(await refreshed.json());
    const inbox = await fetch("/api/messages"); if (inbox.ok) setInternalMessages((await inbox.json()).messages || []);
  }

  async function clearChat() { await fetch("/api/chat/close", { method: "POST" }); setMessages([]); setProposal(null); setNotice(""); }
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); router.replace("/login"); }
  function askPatientInfo(name: string) { void ask(`Dame la información clínica y operativa de ${name}.`); }
  function isReportRequest(value: string) {
    return /\b(?:genera(?:me|r)?|gen[eé]rame|crea(?:me|r)?|cr[eé]ame|haz(?:me)?|prepara(?:me|r)?|hacer|dame)\b[\s\S]{0,80}\b(?:reporte|repote|informe)\b|\b(?:reporte|repote|informe)\b[\s\S]{0,80}\b(?:paciente|de)\b/i.test(value);
  }

  function openPatientDraftFromProposal(result: any) {
    if (result?.type !== "clarification" || result?.intent !== "create_patient") return;
    const operation = result.operations?.find((item: any) => item.action === "create_patient") || {};
    window.dispatchEvent(new CustomEvent("rxlist:patient-draft", { detail: { fullName: operation.fullName || operation.name || "", birthDate: operation.birthDate || "", reason: operation.reason || "", allergies: operation.allergies || "", emergencyContact: operation.emergencyContact || "", emergencyPhone: operation.emergencyPhone || "", floor: typeof operation.floor === "number" ? String(operation.floor) : "", floors: summary?.floors || [] } }));
  }

  function internalMessageLabel(message: any) {
    if (message.senderRole !== "doctor") return message.senderName;
    const names = (message.recipientIds || []).map((id: string) => summary?.nurses?.find((nurse: any) => nurse.userId === id || nurse.id === id)?.name).filter(Boolean);
    return names.length ? `Para ${names.join(", ")}` : "Para enfermería";
  }

  function threadRecipients(threadId: string) {
    return [...new Set(internalMessages.filter(message => message.threadId === threadId).flatMap(message => message.recipientIds || []).filter((id: string) => summary?.nurses?.some((nurse: any) => nurse.userId === id || nurse.id === id)))];
  }

  async function refreshInternalMessages() {
    const inbox = await fetch("/api/messages");
    if (inbox.ok) setInternalMessages((await inbox.json()).messages || []);
  }

  async function archiveThread(threadId: string) {
    const response = await fetch("/api/messages", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "archive", threadId }) });
    if (!response.ok) { setNotice("No se pudo archivar la conversación."); return; }
    setThreadMenu(null); setInternalMessages(current => current.filter(message => message.threadId !== threadId));
    if (selectedInternalThread === threadId) setSelectedInternalThread(null);
  }

  async function deleteThread(threadId: string) {
    const response = await fetch("/api/messages", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ threadId }) });
    if (!response.ok) { setNotice("No se pudo eliminar la conversación."); return; }
    setThreadMenu(null); setInternalMessages(current => current.filter(message => message.threadId !== threadId));
    if (selectedInternalThread === threadId) setSelectedInternalThread(null);
  }

  function newInternalConversation() {
    setSelectedInternalThread("__new__"); setNewRecipientIds(summary?.nurses?.map((nurse: any) => nurse.userId).filter(Boolean) || []); setInternalDraft(""); setSidebarOpen(false);
  }

  function internalThreads() {
    const latest = new Map<string, any>();
    for (const message of internalMessages) latest.set(message.threadId, message);
    return [...latest.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async function sendInternalReply() {
    const body = internalDraft.trim();
    if (!body || !selectedInternalThread || sendingInternal) return;
    const recipientIds = selectedInternalThread === "__new__" ? newRecipientIds : threadRecipients(selectedInternalThread);
    if (!recipientIds.length) { setNotice("No se encontró la enfermera destinataria de este hilo."); return; }
    setSendingInternal(true);
    const isAiCommand = /^\/chat\b/i.test(body);
    const response = await fetch(isAiCommand ? "/api/messages/command" : "/api/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(isAiCommand ? { command: body.replace(/^\/chat\s*/i, ""), recipientIds, threadId: selectedInternalThread === "__new__" ? undefined : selectedInternalThread } : { body, recipientIds, threadId: selectedInternalThread === "__new__" ? undefined : selectedInternalThread }) });
    const result = await response.json().catch(() => null);
    setSendingInternal(false);
    if (!response.ok) { setNotice(`No se pudo enviar el mensaje: ${result?.error || "error desconocido"}`); return; }
    setInternalDraft("");
    const createdThread = result?.message?.threadId;
    await refreshInternalMessages();
    if (selectedInternalThread === "__new__" && createdThread) setSelectedInternalThread(createdThread);
  }

  function createPatientPdf(content: string) {
    const reportWindow = window.open("", "_blank");
    if (!reportWindow) { setNotice("El navegador bloqueó la pestaña del reporte. Permite ventanas emergentes para RXList."); return; }
    reportWindow.opener = null;
    reportWindow.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>RXList · Informe clínico</title><style>*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#111;background:#fff;margin:0;padding:32px;line-height:1.45}main{max-width:850px;margin:0 auto}.toolbar{display:flex;justify-content:flex-end;gap:8px;margin-bottom:24px}.toolbar button{border:1px solid #111;background:#111;color:#fff;border-radius:5px;padding:10px 15px;font-weight:700;cursor:pointer}.toolbar button:last-child{background:#fff;color:#111}header{border-bottom:2px solid #111;padding-bottom:15px;margin-bottom:22px}h1{font-size:25px;letter-spacing:.04em;margin:0 0 5px}h2{font-size:16px;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid #555;padding-bottom:6px;margin:24px 0 10px}p{font-size:12px;margin:7px 0}table{width:100%;border-collapse:collapse;margin:12px 0 20px;font-size:10px;page-break-inside:auto}tr{page-break-inside:avoid}th{background:#eee;text-align:left}th,td{border:1px solid #555;padding:7px;vertical-align:top}li{font-size:12px;margin:4px 0}.meta{font-size:11px;color:#444}.notice{margin-top:34px;padding-top:10px;border-top:1px solid #555;color:#444;font-size:10px}@media(max-width:600px){body{padding:16px}.toolbar{position:sticky;top:0;background:#fff;padding:8px 0;z-index:2}h1{font-size:21px}table{font-size:9px}th,td{padding:5px}}@media print{body{padding:0}.toolbar{display:none}main{max-width:none}header{margin-top:0}h1{font-size:22px}}</style></head><body><main><div class="toolbar"><button onclick="window.print()">Imprimir / Guardar PDF</button><button onclick="window.close()">Cerrar</button></div><header><h1>RXList</h1><div class="meta">Informe clínico y operativo · ${new Date().toLocaleString("es-MX")}</div></header>${reportHtml(content)}<div class="notice">Documento informativo generado por RXList. Verificar la información y las indicaciones antes de utilizarlo en atención clínica.</div></main></body></html>`);
    reportWindow.document.close();
  }

  function submit(event: FormEvent) { event.preventDefault(); void ask(); }
  function handleComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    event.stopPropagation();
    void ask();
  }
  const initials = summary?.doctor?.name?.split(" ").map(part => part[0]).slice(0, 2).join("").toUpperCase() || "DR";

  return <main className="chatgpt-shell">
    <aside className={`chatgpt-sidebar${sidebarOpen ? " open" : ""}`}>
      <button className="chatgpt-brand" onClick={clearChat} aria-label="Ir al inicio de RXList"><span>RXList</span></button>
      <button className="chatgpt-new" onClick={clearChat}><span>⌫</span> Limpiar chat</button>
      <div className="chatgpt-nav-label">Asistente clínico</div>
      <button className="chatgpt-dashboard-link" onClick={() => router.push("/doctor")}><span>▦</span> Ir a dashboard</button>
      <div className="chatgpt-inbox"><div className="chatgpt-inbox-heading"><div className="chatgpt-nav-label">Mensajería interna</div><button type="button" className="chatgpt-inbox-new" onClick={newInternalConversation} aria-label="Nueva conversación">＋</button></div>{internalMessages.length ? internalThreads().slice(-6).reverse().map(message => <div className={`chatgpt-inbox-row${selectedInternalThread === message.threadId ? " selected" : ""}`} key={message.id}><button type="button" className="chatgpt-inbox-thread" onClick={() => { setSelectedInternalThread(message.threadId); setSidebarOpen(false); }}><span className="chatgpt-inbox-dot" /><span><strong>{internalMessageLabel(message)}</strong><small>{message.body}</small></span></button><button type="button" className="chatgpt-inbox-more" onClick={() => setThreadMenu(threadMenu === message.threadId ? null : message.threadId)} aria-label="Opciones de conversación">⋮</button>{threadMenu === message.threadId && <div className="chatgpt-thread-menu"><button type="button" onClick={() => void archiveThread(message.threadId)}>Archivar</button><button type="button" onClick={() => void deleteThread(message.threadId)}>Eliminar</button></div>}</div>) : <small className="chatgpt-inbox-empty">Los mensajes enviados a enfermería aparecerán aquí.</small>}</div>
      <div className="chatgpt-sidebar-foot"><div className="chatgpt-user"><span className="chatgpt-avatar">{initials}</span><span><strong>{summary?.doctor?.name || "Doctor"}</strong><small>Sesión segura</small></span></div><div className="chatgpt-status"><i /> Voz local disponible</div><button className="chatgpt-sidebar-logout" onClick={logout}>↪ <span>Cerrar sesión</span></button></div>
    </aside>
    {sidebarOpen && <button className="chatgpt-overlay" aria-label="Cerrar menú" onClick={() => setSidebarOpen(false)} />}
    <section className="chatgpt-main">
      <header className="chatgpt-header"><button className="chatgpt-menu" onClick={() => setSidebarOpen(value => !value)} aria-label="Abrir menú">☰</button><div><span className="chatgpt-eyebrow">RXList · asistente del doctor</span><h1>Chat clínico</h1></div><div className="chatgpt-header-actions"><button className="chatgpt-clear" onClick={clearChat}>Limpiar chat</button></div></header>
      {selectedInternalThread && <section className="chatgpt-internal-full" aria-label="Chat interno"><header className="chatgpt-internal-full-head"><button type="button" onClick={() => setSelectedInternalThread(null)}>← Volver al asistente</button><div><span className="chatgpt-eyebrow">Mensajería interna</span><h2>{internalMessages.find(message => message.threadId === selectedInternalThread) ? internalMessageLabel(internalMessages.find(message => message.threadId === selectedInternalThread)) : "Enfermería"}</h2></div><span className="chatgpt-internal-online"><i /> Hilo activo</span></header><div className="chatgpt-internal-full-messages">{internalMessages.filter(message => message.threadId === selectedInternalThread).map(message => <div className={`chatgpt-internal-full-bubble ${message.senderRole}`} key={message.id}><strong>{message.senderName}</strong><p>{message.body}</p><small>{new Date(message.createdAt).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}</small></div>)}</div><div className="chatgpt-internal-full-compose"><input value={internalDraft} onChange={event => setInternalDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void sendInternalReply(); } }} placeholder="Escribe o usa /chat para pedirle algo a la IA…" disabled={sendingInternal} /><button type="button" onClick={() => void sendInternalReply()} disabled={sendingInternal || !internalDraft.trim()}>{sendingInternal ? "Enviando…" : "Enviar"}</button></div></section>}
      <div className="chatgpt-scroll" ref={messagesRef} onScroll={handleMessageScroll}>
        {messages.length === 0 ? <div className="chatgpt-welcome"><span className="chatgpt-eyebrow">Buen día, {summary?.doctor?.name?.split(" ")[0] || "doctor"}</span><h2>¿En qué puedo ayudarte?</h2><p>Consulta la operación de tu guardia o pide una acción. Yo preparo una propuesta y tú decides antes de aplicarla.</p><div className="chatgpt-starters">{starters.map(starter => <button key={starter} onClick={() => void ask(starter)}>{starter}<span>↗</span></button>)}</div></div> : <div className="chatgpt-thread">{messages.map((message, index) => <div className={`chatgpt-message ${message.role}`} key={`${message.role}-${index}`}>{message.role === "assistant" && <span className="chatgpt-message-icon"><RxlistBot size={28} /></span>}<div className="chatgpt-message-body">{message.role === "assistant" ? <><ChatMarkdown text={message.content || " "} patientNames={summary?.patients?.map(patient => patient.fullName) || []} onPatientInfo={askPatientInfo} />{/^\s*(?:###\s*)?informaci[oó]n cl[ií]nica/i.test(message.content) && <button className="chatgpt-pdf-button" onClick={() => createPatientPdf(message.content)}>▣ Crear PDF</button>}</> : message.content}</div></div>)}{loading && <div className="chatgpt-message assistant"><span className="chatgpt-message-icon"><RxlistBot emotion="thinking" size={28} /></span><div className="chatgpt-typing"><i /><i /><i /></div></div>}{proposal && <div className="chatgpt-proposal"><div><span className="chatgpt-eyebrow">Revisión requerida</span><h3>Confirmar cambio operativo</h3><p>{proposal.message}</p>{proposal.operations.map((operation: any, index) => <div className="chatgpt-operation" key={index}><span>{operation.action?.replaceAll("_", " ")}</span><strong>{operation.fullName || operation.name || operation.title || "Operación clínica"}</strong></div>)}</div><div className="chatgpt-proposal-actions"><button onClick={() => setProposal(null)}>Cancelar</button><button className="confirm" onClick={() => void confirm()} disabled={loading}>Aceptar y aplicar</button></div></div>}</div>}
      </div>
      {showScrollToBottom && <button className="chatgpt-jump-bottom" onClick={scrollToBottom} aria-label="Bajar al último mensaje" title="Bajar al último mensaje">↓</button>}
      {notice && <div className="chatgpt-notice" role="alert">{notice}</div>}
      <div className="chatgpt-composer-wrap"><form className="chatgpt-composer" onSubmit={submit}><textarea className="chatgpt-input composer" value={text} onChange={event => setText(event.target.value)} onKeyDown={handleComposerKeyDown} placeholder="Escribe una solicitud…" rows={1} /><WhisperVoice /><button className="chatgpt-send" type="submit" disabled={!text.trim() || loading || voiceBusy} aria-label="Enviar mensaje">↑</button></form><small>{voiceBusy ? "Transcribiendo con Whisper local…" : "La IA propone · el servidor valida · tú decides"}</small></div>
    </section>
  </main>;
}
