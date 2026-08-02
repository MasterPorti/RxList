"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Draft = { fullName: string; birthDate: string; reason: string; allergies: string; emergencyContact: string; emergencyPhone: string; floor: string; floors?: { id: number; name: string }[] };

export default function PatientDraftForm() {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [chatMessages, setChatMessages] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const open = (event: Event) => { setDraft((event as CustomEvent<Draft>).detail); setChatMessages(document.querySelector<HTMLElement>(".chat .messages")); };
    const close = () => { setDraft(null); setChatMessages(null); };
    window.addEventListener("rxlist:patient-draft", open);
    window.addEventListener("rxlist:open-patient-form", open);
    window.addEventListener("rxlist:chat-closed", close);
    return () => { window.removeEventListener("rxlist:patient-draft", open); window.removeEventListener("rxlist:open-patient-form", open); window.removeEventListener("rxlist:chat-closed", close); };
  }, []);
  if (!draft || !chatMessages || location.pathname !== "/doctor") return null;
  function update(key: keyof Draft, value: string) { setDraft(current => current ? { ...current, [key]: value } : current); }
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    window.dispatchEvent(new CustomEvent("rxlist:patient-draft-confirm", { detail: draft }));
    setDraft(null);
  }
  return createPortal(<div className="patient-draft-message"><form className="patient-chat-form" onSubmit={submit}><div className="eyebrow">Completa el registro del paciente</div><div className="patient-form-grid"><label>Nombre completo<input className="field" value={draft.fullName} onChange={e => update("fullName", e.target.value)} required /></label><label>Fecha de nacimiento<input className="field" type="date" value={draft.birthDate} onChange={e => update("birthDate", e.target.value)} required /></label><label>Motivo de ingreso<input className="field" value={draft.reason} onChange={e => update("reason", e.target.value)} required /></label><label>Alergias<input className="field" value={draft.allergies} onChange={e => update("allergies", e.target.value)} required /></label><label>Contacto de emergencia<input className="field" value={draft.emergencyContact} onChange={e => update("emergencyContact", e.target.value)} required /></label><label>Teléfono de emergencia<input className="field" inputMode="tel" value={draft.emergencyPhone} onChange={e => update("emergencyPhone", e.target.value)} required /></label><label>Piso<select className="field" value={draft.floor} onChange={e => update("floor", e.target.value)} required><option value="">Selecciona piso</option>{(draft.floors || []).map(floor => <option key={floor.id} value={floor.id}>Piso {floor.id} · {floor.name}</option>)}</select></label></div><div className="patient-form-foot"><span>La cama libre se asignará automáticamente.</span><button className="btn primary" type="submit">Guardar paciente</button></div></form></div>, chatMessages);
}
