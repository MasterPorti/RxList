"use client";
import { useState } from "react";
export default function DebugCopy() {
  const [copied, setCopied] = useState(false);
  async function copyDebug() {
    const chat = document.querySelector(".chat .messages")?.textContent?.trim() || "(sin mensajes)";
    const proposal = document.querySelector(".proposal-inline")?.textContent?.trim() || "(sin propuesta abierta)";
    const payload = `RXList DEBUG\nFecha: ${new Date().toISOString()}\nURL: ${location.href}\n\nCONVERSACIÓN:\n${chat}\n\nPROPUESTA:\n${proposal}`;
    await navigator.clipboard.writeText(payload); setCopied(true); setTimeout(() => setCopied(false), 1800);
  }
  return <button className="debugcopy" onClick={copyDebug} title="Copiar información para debug">🐞 {copied ? "Copiado" : "Copy debug"}</button>;
}
