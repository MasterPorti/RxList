"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type DemoMessage = { role: "user" | "assistant"; content: string };

const steps = [
  { prompt: "Dame toda la informacion de los pacientes de pediatria", answer: "Pacientes de Pediatría\n\n| Paciente | Piso | Cama | Motivo de ingreso |\n| --- | --- | --- | --- |\n| Lucía Hernández Soto | Pediatría | 3 | Deshidratación por gastroenteritis |\n| Karime Gonzales | Pediatría | 1 | Dolor estomacal |\n| Enrique Manuel | Pediatría | 2 | Dolor abdominal |\n| Marta Sofía Castillo | Pediatría | 4 | Bronquiolitis viral |\n| Diego Emiliano Vargas | Pediatría | 5 | Apendicitis en observación |\n| Valentina Ortega Cruz | Pediatría | 6 | Fiebre sin foco |\n| Mateo Alejandro Flores | Pediatría | 7 | Asma con sibilancias |\n| Regina Méndez Soto | Pediatría | 8 | Gastroenteritis con deshidratación |" },
  { prompt: "Dame la informacion clinica y operativa de Regina Mendez Soto", answer: "Información clínica y operativa de Regina Méndez Soto\n\nEstado: Ingresada\nPiso: Pediatría\nCama: 8\nMotivo: Gastroenteritis con deshidratación\nAlergias: Ninguna conocida\nContacto de emergencia: Carlos Soto · 555 0215\n\nSignos vitales recientes\n\n| Fecha | Temperatura | Presión | FC | FR | Sat O2 |\n| --- | --- | --- | --- | --- | --- |\n| 06 agosto 2026 | 36.9 C | 118 74 | 75 | 16 | 98 por ciento |\n| 05 agosto 2026 | 37.2 C | 120 76 | 83 | 17 | 97 por ciento |\n\nMedicamento activo: Omeprazol 20 mg cada 12 horas\n\n<button>▣ Crear PDF</button>" },
  { prompt: "Manda un mensaje a Mariana Torres del piso 3 informa que Regina llegara a las 17 00 para prepararla", answer: "Se propone enviar un mensaje a Mariana Torres de Cirugía informando que Regina Méndez Soto llegará alrededor de las 17 00 para preparar su recepción.\n\nRevisión requerida\nOperación de mensajería interna\n\n<button class=confirm>Enviar mensaje</button>" },
  { prompt: "Manda un mensaje a Pablo Martinez y Andres Silva de pediatria informa que Regina sera trasladada", answer: "Mensaje preparado para Pablo Martínez y Andrés Silva de Pediatría.\n\nRegina Méndez Soto será trasladada a Cirugía. Por favor preparen la salida y compartan la información clínica relevante con el equipo receptor.\n\n<button class=confirm>Enviar mensaje</button>" },
  { prompt: "Dame los medicamentos y signos vitales de Regina Mendez Soto", answer: "Resumen clínico de Regina Méndez Soto\n\nMedicamento activo: Omeprazol 20 mg cada 12 horas\nTemperatura reciente: 36.9 C\nPresión arterial: 118 74\nFrecuencia cardíaca: 75\nFrecuencia respiratoria: 16\nSaturación de oxígeno: 98 por ciento\n\nLa tendencia de temperatura se mantiene estable." },
  { prompt: "Dame la informacion clinica y operativa de Regina Mendez Soto para crear el PDF", answer: "Informe clínico listo para imprimir\n\nPaciente: Regina Méndez Soto\nUbicación: Pediatría · Cama 8\nMotivo: Gastroenteritis con deshidratación\nContacto de emergencia: Carlos Soto · 555 0215\nMedicamento: Omeprazol 20 mg cada 12 horas\nSignos vitales: estables\n\n<button>▣ Crear PDF</button>" },
  { prompt: "Registra un nuevo paciente llamado Jose Manuel Ochoa con motivo de ingreso dolor abdominal", answer: "Tengo la información inicial para registrar a José Manuel Ochoa. Completa los campos restantes en el formulario para continuar.\n\n<button class=form>▣ Abrir formulario de paciente</button>" },
  { prompt: "Que camas estan disponibles en todos los pisos", answer: "Disponibilidad actual\n\n| Piso | Pacientes | Disponibles |\n| --- | --- | --- |\n| Medicina interna | 14 | 6 |\n| Pediatría | 13 | 3 |\n| Cirugía | 14 | 4 |\n| Urgencias | 9 | 3 |\n\nHay 16 espacios disponibles en total." },
  { prompt: "Administra paracetamol a Regina Mendez Soto cada 8 horas", answer: "Se propone registrar Paracetamol para Regina Méndez Soto cada 8 horas.\n\nLa indicación quedará pendiente de confirmación antes de crear las tareas de administración.\n\n<button class=confirm>Aceptar y aplicar</button>" },
];

function sleep(ms: number) { return new Promise(resolve => window.setTimeout(resolve, ms)); }

function DemoText({ content }: { content: string }) {
  return <div className="demo-response">{content.split("\n").map((line, index) => {
    if (!line.trim()) return <span className="demo-break" key={index} />;
    if (line.startsWith("|")) return <div className="demo-table-line" key={index}>{line.split("|").filter(Boolean).map((cell, cellIndex) => <span key={cellIndex}>{cell.trim()}</span>)}</div>;
    if (line.startsWith("<button")) { const confirm = line.includes("confirm"); const form = line.includes("form"); return <button className={`demo-action ${confirm ? "confirm" : ""}`} key={index}>{form ? "▣ Abrir formulario de paciente" : confirm ? line.includes("Aceptar") ? "Aceptar y aplicar" : "Enviar mensaje" : "▣ Crear PDF"}</button>; }
    return <p key={index}>{line}</p>;
  })}</div>;
}

export default function Chat01Page() {
  const [messages, setMessages] = useState<DemoMessage[]>([]);
  const [text, setText] = useState("");
  const [step, setStep] = useState(0);
  const [typing, setTyping] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [finished, setFinished] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typeTimer = useRef<number | undefined>(undefined);

  useEffect(() => { const box = scrollRef.current; if (box) box.scrollTop = box.scrollHeight; }, [messages, thinking]);
  useEffect(() => () => { if (typeTimer.current) window.clearTimeout(typeTimer.current); }, []);
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(Math.max(input.scrollHeight, 28), 120)}px`;
  }, [text]);
  useEffect(() => {
    const handleUserInput = (event: Event) => {
      const input = event.target as HTMLTextAreaElement;
      if (input?.classList.contains("chatgpt-input") && input.value.trim() && !typing) loadScript();
    };
    document.addEventListener("input", handleUserInput);
    return () => document.removeEventListener("input", handleUserInput);
  }, [typing, text, step, finished]);

  function loadScript() {
    if (typing || finished) return;
    const prompt = steps[Math.min(step, steps.length - 1)].prompt;
    setTyping(true); let index = 0;
    const next = () => { index += 1; setText(prompt.slice(0, index)); if (index < prompt.length) typeTimer.current = window.setTimeout(next, 78 + Math.round(Math.random() * 48)); else setTyping(false); };
    typeTimer.current = window.setTimeout(next, 160);
  }

  async function submit() {
    if (!text.trim() || typing || thinking || finished) return;
    const current = steps[Math.min(step, steps.length - 1)];
    setMessages(value => [...value, { role: "user", content: current.prompt }]); setText(""); setThinking(true);
    await sleep(720);
    setThinking(false); setMessages(value => [...value, { role: "assistant", content: current.answer }]);
    if (step >= steps.length - 1) setFinished(true); else setStep(value => value + 1);
  }

  function clearDemo() { setMessages([]); setText(""); setStep(0); setFinished(false); setThinking(false); }

  return <main className="chatgpt-shell chat01-shell">
    <aside className="chatgpt-sidebar"><Link className="chatgpt-brand" href="/chat-01"><span>RXList</span></Link><button className="chatgpt-new" onClick={clearDemo}><span>⌫</span> Limpiar demo</button><div className="chatgpt-nav-label">Plantilla de presentación</div><div className="chat01-progress"><strong>Demo local</strong><span>{Math.min(step + (finished ? 1 : 0), steps.length)} de {steps.length} mensajes</span><i><b style={{ width: `${((finished ? steps.length : step) / steps.length) * 100}%` }} /></i></div><div className="chatgpt-sidebar-foot"><div className="chatgpt-status"><i /> Sin conexión a Gemini</div><Link className="chatgpt-dashboard-link" href="/chat"><span>＋</span> Nuevo chat</Link></div></aside>
    <section className="chatgpt-main"><header className="chatgpt-header"><div><span className="chatgpt-eyebrow">RXList · presentación</span><h1>Chat clínico demo</h1></div><div className="chatgpt-header-actions"><span className="chat01-local-pill">Respuesta precargada</span><Link className="chatgpt-clear" href="/chat">Nuevo chat</Link></div></header><div className="chatgpt-scroll" ref={scrollRef}>{messages.length === 0 ? <div className="chatgpt-welcome chat01-welcome"><span className="chatgpt-eyebrow">Modo presentación</span><h2>Demo guiada del asistente clínico</h2><p>Escribe cualquier tecla para cargar el siguiente mensaje. La respuesta se genera de forma local para que la presentación no dependa de internet.</p><div className="chatgpt-starters"><button onClick={loadScript}>Iniciar demo <span>↗</span></button></div></div> : <div className="chatgpt-thread">{messages.map((message, index) => <div className={`chatgpt-message ${message.role}`} key={index}>{message.role === "assistant" && <span className="chatgpt-message-icon">✦</span>}<div className="chatgpt-message-body">{message.role === "assistant" ? <DemoText content={message.content} /> : message.content}</div></div>)}{thinking && <div className="chatgpt-message assistant"><span className="chatgpt-message-icon">✦</span><div className="chatgpt-typing"><i /><i /><i /><small>Analizando la solicitud</small></div></div>}{finished && <div className="chat01-finished"><strong>Demo terminada</strong><span>Ya mostraste {steps.length} mensajes y funciones principales.</span><button onClick={clearDemo}>Limpiar demo</button><Link href="/chat">Entrar al chat real</Link></div>}</div>}</div><div className="chatgpt-composer-wrap"><form className="chatgpt-composer" onSubmit={event => { event.preventDefault(); void submit(); }}><textarea ref={inputRef} className="chatgpt-input" value={text} onChange={event => { if (!typing) { setText(event.target.value); if (!event.target.value.trim()) loadScript(); } }} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(); } }} placeholder="Escribe una solicitud para iniciar la demo" rows={1} /><button className="chatgpt-send" type="submit" disabled={!text.trim() || typing || thinking}>↑</button></form><small>{typing ? "Cargando el mensaje de presentación…" : thinking ? "Analizando la solicitud…" : finished ? "Demo terminada · usa Nuevo chat para volver al asistente real" : `Mensaje ${Math.min(step + 1, steps.length)} de ${steps.length} · cualquier tecla carga el guion`}</small></div></section>
  </main>;
}
