"use client";
import { useState } from "react";
export default function DebugCopy() {
  const [copied, setCopied] = useState(false);
  async function copyDebug() {
    const chat = document.querySelector(".chat .messages")?.textContent?.trim() || document.querySelector(".chatgpt-thread")?.textContent?.trim() || "(sin mensajes)";
    const proposal = document.querySelector(".proposal-inline")?.textContent?.trim() || document.querySelector(".chatgpt-proposal")?.textContent?.trim() || "(sin propuesta abierta)";
    const body = document.body.dataset;
    const diagnostics = [
      `Último mensaje: ${body.rxlistLastMessage || "(sin datos)"}`,
      `Ruta: ${body.rxlistRoute || "(sin datos)"}`,
      `Proveedor: ${body.rxlistProvider || "(sin datos)"}`,
      `Duración: ${body.rxlistDurationMs ? `${body.rxlistDurationMs} ms` : "(sin datos)"}`,
      `Revisión: ${body.rxlistRevision || "(sin datos)"}`,
      `Contexto enviado: ${body.rxlistContext || "(sin datos)"}`,
      `Historial enviado: ${body.rxlistHistoryLines || "(sin datos)"} líneas`,
      `Longitud del mensaje: ${body.rxlistMessageLength || "(sin datos)"} caracteres`,
      `Longitud del prompt: ${body.rxlistPromptLength || "(sin datos)"} caracteres`,
      `Timeout AGY configurado: ${body.rxlistAgyTimeoutMs ? `${body.rxlistAgyTimeoutMs} ms` : "(sin datos)"}`,
      `HTTP: ${body.rxlistHttpStatus || "(sin datos)"}`,
      `Error: ${body.rxlistError || "ninguno"}`,
    ].join("\n");
    const payload = `RXList DEBUG\nFecha: ${new Date().toISOString()}\nURL: ${location.href}\n\nDIAGNÓSTICO:\n${diagnostics}\n\nCONVERSACIÓN:\n${chat}\n\nPROPUESTA:\n${proposal}`;
    await navigator.clipboard.writeText(payload); setCopied(true); setTimeout(() => setCopied(false), 1800);
  }
  return <button className="debugcopy" onClick={copyDebug} title="Copiar información para debug">🐞 {copied ? "Copiado" : "Copy debug"}</button>;
}
