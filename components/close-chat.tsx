"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

export default function CloseChat() {
  const path = usePathname();
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [cleared, setCleared] = useState(false);
  if (path !== "/doctor") return null;

  async function close() {
    setBusy(true);
    const response = await fetch("/api/chat/close", { method: "POST" });
    if (response.ok) {
      window.dispatchEvent(new Event("rxlist:chat-closed"));
      setCleared(true);
      window.setTimeout(() => setCleared(false), 2400);
    }
    setBusy(false);
    setAsking(false);
  }

  return <div className="closechat">
    {cleared && <span className="closechat-success" role="status">✓ Conversación eliminada</span>}
    {asking ? <div className="closechat-confirm"><span>¿Limpiar la conversación?</span><button className="btn" onClick={() => setAsking(false)}>Cancelar</button><button className="btn primary" onClick={close} disabled={busy}>{busy ? "Limpiando…" : "Sí, limpiar"}</button></div> : <button className="btn clear-chat-button" onClick={() => setAsking(true)} disabled={busy}><span aria-hidden="true">🗑</span> Limpiar conversación</button>}
  </div>;
}
