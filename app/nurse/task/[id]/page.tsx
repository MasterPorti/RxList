"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type VisitForm = { temperature: string; systolic: string; diastolic: string; heartRate: string; respiratoryRate: string; oxygenSaturation: string; notes: string };
const emptyForm: VisitForm = { temperature: "", systolic: "", diastolic: "", heartRate: "", respiratoryRate: "", oxygenSaturation: "", notes: "" };

function numberProps(min: number, max: number, step = "1") { return { type: "number", min, max, step, inputMode: "decimal" as const }; }

export default function NurseTaskPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [form, setForm] = useState<VisitForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/nurse/me").then(async response => {
      if (response.status === 401) { router.push("/login"); return; }
      if (response.ok) setData(await response.json());
    }).catch(() => setError("No se pudo cargar la tarea."));
  }, [router]);

  const task = data?.tasks.find((item: any) => item.id === id);
  const patient = task ? data.patients.find((item: any) => item.id === task.patientId) : null;

  async function save(status: "completed" | "skipped") {
    if (!task) return;
    setSaving(true); setError("");
    const vitals = { temperature: form.temperature, bloodPressure: form.systolic && form.diastolic ? `${form.systolic}/${form.diastolic}` : "", heartRate: form.heartRate, respiratoryRate: form.respiratoryRate, oxygenSaturation: form.oxygenSaturation, notes: form.notes };
    try {
      const response = await fetch(`/api/tasks/${task.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status, vitals }) });
      if (!response.ok) { setError("No se pudo guardar la visita. Intenta nuevamente."); return; }
      router.push("/nurse");
    } catch { setError("No se pudo conectar con RXList."); } finally { setSaving(false); }
  }

  if (!data) return <main className="nurse-task-page"><div className="nurse-task-loading">Cargando registro de visita…</div></main>;
  if (!task || !patient) return <main className="nurse-task-page"><div className="nurse-task-loading"><h1>Tarea no encontrada</h1><Link href="/nurse">Volver a mis tareas</Link></div></main>;

  return <main className="nurse-task-page"><header className="topbar"><div className="brand"><span className="mark">✚</span> RXList</div><div className="topright"><span>{data.user.name}</span><span className="avatar">{data.user.name[0]}</span><a className="btn ghost" href="/api/auth/logout">Cerrar sesión</a></div></header><section className="nurse-task-shell"><Link className="back-link" href="/nurse">← Volver a mis tareas</Link><div className="nurse-task-heading"><div><span className="eyebrow">Registro de visita</span><h1>{task.title}</h1><p>{patient.fullName} · {patient.floor === "unassigned" ? "Sin piso" : `Piso ${patient.floor}`} · programada {new Date(task.scheduledAt).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}</p></div><span className="visit-badge">Captura clínica</span></div><section className="visit-card"><div className="visit-card-heading"><div><span className="eyebrow">Signos vitales</span><h2>¿Cómo está el paciente?</h2></div><span className="visit-required">Los campos vacíos se guardan sin dato</span></div><div className="visit-grid"><label>Temperatura (°C)<input {...numberProps(25, 45, "0.1")} value={form.temperature} onChange={e => setForm({ ...form, temperature: e.target.value })} placeholder="36.8" /></label><label>Presión sistólica<input {...numberProps(60, 250)} value={form.systolic} onChange={e => setForm({ ...form, systolic: e.target.value })} placeholder="120" /></label><label>Presión diastólica<input {...numberProps(30, 150)} value={form.diastolic} onChange={e => setForm({ ...form, diastolic: e.target.value })} placeholder="80" /></label><label>Frecuencia cardíaca (lpm)<input {...numberProps(20, 240)} value={form.heartRate} onChange={e => setForm({ ...form, heartRate: e.target.value })} placeholder="80" /></label><label>Respiraciones por minuto<input {...numberProps(5, 80)} value={form.respiratoryRate} onChange={e => setForm({ ...form, respiratoryRate: e.target.value })} placeholder="16" /></label><label>Saturación de oxígeno (%)<input {...numberProps(50, 100)} value={form.oxygenSaturation} onChange={e => setForm({ ...form, oxygenSaturation: e.target.value })} placeholder="98" /></label></div><label className="visit-notes">Observaciones<textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Escribe aquí cualquier observación relevante…" rows={4} /></label>{error && <p className="error">{error}</p>}<div className="visit-actions"><button className="btn" disabled={saving} onClick={() => save("skipped")}>Omitir tarea</button><button className="btn primary" disabled={saving} onClick={() => save("completed")}>{saving ? "Guardando…" : "Guardar visita y medicamento ✓"}</button></div></section></section></main>;
}
