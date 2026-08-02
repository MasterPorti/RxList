"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type NurseDraft = { name: string; birthDate: string; phone: string; floor: string; floors?: { id: number; name: string }[] };

export default function NurseDirectForm() {
  const [draft, setDraft] = useState<NurseDraft | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const open = (event: Event) => { setDraft((event as CustomEvent<NurseDraft>).detail); setHost(document.querySelector<HTMLElement>(".chat .messages")); setNotice(""); };
    const close = () => setDraft(null);
    window.addEventListener("rxlist:open-nurse-form", open);
    window.addEventListener("rxlist:chat-closed", close);
    return () => { window.removeEventListener("rxlist:open-nurse-form", open); window.removeEventListener("rxlist:chat-closed", close); };
  }, []);
  if (!draft || !host) return null;
  const update = (key: keyof NurseDraft, value: string) => setDraft(current => current ? { ...current, [key]: value } : current);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!draft) return; setSaving(true); setNotice("");
    const response = await fetch("/api/nurses", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: draft.name, birthDate: draft.birthDate, phone: draft.phone, floor: draft.floor }) });
    const result = await response.json(); setSaving(false);
    if (!response.ok) { setNotice(result.error === "nurse_exists" ? "Ya existe una enfermera con ese nombre." : "No se pudo guardar la enfermera."); return; }
    setDraft(null); window.dispatchEvent(new CustomEvent("rxlist:nurse-access", { detail: [{ name: result.nurse.name, email: result.nurse.email, password: result.password, message: result.message, floor: result.nurse.floor }] }));
    window.dispatchEvent(new CustomEvent("rxlist:quick-action-saved", { detail: `Enfermera ${draft.name} guardada correctamente.` }));
  }
  return createPortal(<div className="direct-form-message"><form className="patient-chat-form" onSubmit={submit}><div className="eyebrow">Alta directa de enfermera</div><div className="patient-form-grid"><label>Nombre completo<input className="field" value={draft.name} onChange={e => update("name", e.target.value)} required /></label><label>Fecha de nacimiento<input className="field" type="date" value={draft.birthDate} onChange={e => update("birthDate", e.target.value)} required /></label><label>Teléfono<input className="field" inputMode="tel" value={draft.phone} onChange={e => update("phone", e.target.value)} /></label><label>Piso<select className="field" value={draft.floor} onChange={e => update("floor", e.target.value)}><option value="">Sin piso asignado</option>{(draft.floors || []).map(floor => <option key={floor.id} value={floor.id}>Piso {floor.id} · {floor.name}</option>)}</select></label></div>{notice && <p className="error">{notice}</p>}<div className="patient-form-foot"><span>Se guardará directamente, sin IA.</span><button className="btn primary" type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar enfermera"}</button></div></form></div>, host);
}
