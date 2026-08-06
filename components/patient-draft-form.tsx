"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Draft = { fullName: string; birthDate: string; reason: string; allergies: string; emergencyContact: string; emergencyPhone: string; floor: string; floors?: { id: number; name: string }[] };

export default function PatientDraftForm() {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [chatMessages, setChatMessages] = useState<HTMLElement | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const open = (event: Event) => { setDraft((event as CustomEvent<Draft>).detail); setNotice(""); setChatMessages(document.querySelector<HTMLElement>(".chat .messages, .chatgpt-scroll")); };
    const close = () => { setDraft(null); setChatMessages(null); };
    window.addEventListener("rxlist:patient-draft", open);
    window.addEventListener("rxlist:open-patient-form", open);
    window.addEventListener("rxlist:chat-closed", close);
    return () => { window.removeEventListener("rxlist:patient-draft", open); window.removeEventListener("rxlist:open-patient-form", open); window.removeEventListener("rxlist:chat-closed", close); };
  }, []);
  if (!draft || !chatMessages || !["/doctor", "/chat"].includes(location.pathname)) return null;
  function update(key: keyof Draft, value: string) { setDraft(current => current ? { ...current, [key]: value } : current); }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    if (location.pathname === "/chat") {
      const response = await fetch("/api/patients", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...draft, floor: Number(draft.floor) }) });
      if (!response.ok) { const result = await response.json().catch(() => null); const error = result?.error; setNotice(response.status === 401 || response.status === 403 ? "Tu sesión ya no es válida. Mantén este formulario abierto y vuelve a iniciar sesión." : error === "bed_unavailable" ? "No hay cama libre en ese piso." : error === "patient_exists" ? "Ya existe un paciente con ese nombre y fecha de nacimiento." : error === "patient_required_data" ? "Completa todos los campos obligatorios." : "No se pudo guardar el paciente. Revisa los datos e inténtalo de nuevo."); return; }
      setNotice("Paciente guardado correctamente.");
      window.dispatchEvent(new CustomEvent("rxlist:patient-saved", { detail: "Paciente ingresado correctamente." }));
      window.dispatchEvent(new CustomEvent("rxlist:quick-action-saved", { detail: "Paciente ingresado correctamente." }));
      setTimeout(() => { setDraft(null); setChatMessages(null); }, 700);
      return;
    }
    window.dispatchEvent(new CustomEvent("rxlist:patient-draft-confirm", { detail: draft }));
    setDraft(null);
  }
  return createPortal(<div className="patient-draft-message"><form className="patient-chat-form" onSubmit={submit}><div className="eyebrow">Completa el registro del paciente</div><div className="patient-form-grid"><label>Nombre completo<input className="field" value={draft.fullName} onChange={e => update("fullName", e.target.value)} required /></label><label>Fecha de nacimiento<input className="field" type="date" value={draft.birthDate} onChange={e => update("birthDate", e.target.value)} required /></label><label>Motivo de ingreso<input className="field" value={draft.reason} onChange={e => update("reason", e.target.value)} required /></label><label>Alergias<input className="field" value={draft.allergies} onChange={e => update("allergies", e.target.value)} required /></label><label>Contacto de emergencia<input className="field" value={draft.emergencyContact} onChange={e => update("emergencyContact", e.target.value)} required /></label><label>Teléfono de emergencia<input className="field" inputMode="tel" value={draft.emergencyPhone} onChange={e => update("emergencyPhone", e.target.value)} required /></label><label>Piso<select className="field" value={draft.floor} onChange={e => update("floor", e.target.value)} required><option value="">Selecciona piso</option>{(draft.floors || []).map(floor => <option key={floor.id} value={floor.id}>Piso {floor.id} · {floor.name}</option>)}</select></label></div>{notice && <p className="error">{notice}</p>}<div className="patient-form-foot"><span>La cama libre se asignará automáticamente.</span><button className="btn primary" type="submit">Guardar paciente</button></div></form></div>, chatMessages);
}
