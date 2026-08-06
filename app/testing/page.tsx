"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const options = [
  { id: "clinical", name: "Clínica premium", note: "Sobria, clara y orientada a decisiones médicas.", icon: "✦", message: "Se propone enviar un mensaje a Andrés Silva para preparar la recepción de Ismael Mendoza Ortiz.", accent: "Azul RXList" },
  { id: "handoff", name: "Pase de guardia", note: "Enfatiza quién recibe, qué debe preparar y el siguiente paso.", icon: "↗", message: "Andrés Silva · Pediatría\nPreparar recepción de Ismael Mendoza Ortiz\nTraslado: Urgencias → Cirugía", accent: "Pase operativo" },
  { id: "command", name: "Command center", note: "Más visual, con estado, impacto y trazabilidad de la acción.", icon: "◈", message: "TRASLADO PENDIENTE\nIsmael Mendoza Ortiz · Cirugía\nNotificación a enfermería lista para confirmar", accent: "Acción protegida" },
  { id: "compact", name: "Compacta rápida", note: "Minimalista para responder y confirmar en pocos segundos.", icon: "✓", message: "Enviar a Andrés Silva\nPreparar recepción de Ismael Mendoza Ortiz", accent: "Confirmación rápida" },
];

export default function TestingPage() {
  const router = useRouter();
  const [selected, setSelected] = useState("handoff");
  useEffect(() => setSelected(localStorage.getItem("rxlist-proposal-style") || "handoff"), []);
  function choose(id: string) {
    setSelected(id);
    localStorage.setItem("rxlist-proposal-style", id);
    window.dispatchEvent(new Event("rxlist:proposal-style-changed"));
  }
  return <main className="testing-page"><header className="testing-header"><div><span className="testing-eyebrow">RXList · laboratorio de interfaz</span><h1>Elige la tarjeta de revisión</h1><p>Selecciona cómo quieres revisar y confirmar las acciones que prepara Gemini.</p></div><button onClick={() => router.push("/chat")}>Abrir chat →</button></header><section className="testing-grid">{options.map(option => <article className={`testing-option ${selected === option.id ? "selected" : ""}`} key={option.id}><div className="testing-option-top"><span className={`testing-icon testing-${option.id}`}>{option.icon}</span><div><span className="testing-tag">{option.accent}</span><h2>{option.name}</h2><p>{option.note}</p></div></div><div className={`testing-preview proposal-${option.id}`}><div className="preview-label">Revisión requerida</div><h3>{option.id === "clinical" ? "Confirmar cambio operativo" : option.id === "handoff" ? "Preparar recepción" : option.id === "command" ? "Acción pendiente" : "Confirmar envío"}</h3><div className="preview-message">{option.message.split("\n").map((line, index) => <span key={index}>{line}</span>)}</div><div className="preview-operation"><span>{option.id === "command" ? "TRASLADO" : "OPERACIÓN CLÍNICA"}</span><strong>{option.id === "compact" ? "Andrés Silva" : "Ismael Mendoza Ortiz"}</strong></div><div className="preview-actions"><button>Cancelar</button><button>✓ Aceptar y aplicar</button></div></div><button className="testing-choose" onClick={() => choose(option.id)}>{selected === option.id ? "✓ Seleccionada para /chat" : "Usar esta interfaz"}</button></article>)}</section></main>;
}
