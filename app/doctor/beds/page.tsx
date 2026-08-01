"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function BedsPage() {
  const [data, setData] = useState<any>(null);
  const [selected, setSelected] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/doctor/summary").then(async response => {
      if (!response.ok) { router.push("/login"); return; }
      setData(await response.json());
    });
  }, [router]);

  if (!data) return <main className="page">Cargando camas…</main>;
  const active = data.patients.filter((patient: any) => patient.status !== "discharged");
  const occupied = active.filter((patient: any) => typeof patient.floor === "number" && patient.bed).length;
  const total = data.floors.reduce((sum: number, floor: any) => sum + floor.beds, 0);

  return <main className="shell">
    <header className="topbar"><div className="brand"><span className="mark">✚</span> RXList</div><div className="topright"><span>Mapa de camas</span><button className="btn ghost" onClick={() => router.push("/doctor")}>Volver al panel</button></div></header>
    <section className="page"><div className="eyebrow">Ocupación hospitalaria</div><h1 className="headline">Mapa de camas</h1><p className="sub">Si un paciente está registrado, ya tiene una cama asignada. Una cama ocupada no puede asignarse a otra persona.</p>
      <div className="stats"><div className="stat"><strong>{occupied}</strong><span>Ocupadas</span></div><div className="stat"><strong>{total - occupied}</strong><span>Libres</span></div><div className="stat"><strong>{total}</strong><span>Total</span></div></div>
      <section className="panel bedmap-panel standalone-bedmap">{data.floors.map((floor: any) => <div className="bed-floor" key={floor.id}><div className="bed-floor-title"><strong>Piso {floor.id} · {floor.name}</strong><span>{active.filter((patient: any) => patient.floor === floor.id).length}/{floor.beds} camas ocupadas</span></div><div className="bed-grid">{Array.from({ length: floor.beds }, (_, index) => index + 1).map(bed => { const patient = active.find((item: any) => item.floor === floor.id && item.bed === bed); return <button className={patient ? "bed-card occupied" : "bed-card"} key={bed} onClick={() => patient && setSelected(patient)}><strong>Cama {bed}</strong><small>{patient ? patient.fullName : "Libre"}</small></button>; })}</div></div>)}</section>
      <section className="panel patient-history-panel"><div className="panelhead"><div><span className="paneltitle">Historial de pacientes</span><p className="census-subtitle">Ingresos, egresos y tratamientos asociados.</p></div><span className="count">{data.patients.length} registros</span></div><div className="history-list">{data.patients.map((patient: any) => <article className="history-row" key={patient.id}><div><strong>{patient.fullName}</strong><small>Motivo de ingreso: {patient.reason || "No registrado"}</small></div><div><span>Ingreso</span><strong>{patient.admittedAt ? new Date(patient.admittedAt).toLocaleString("es-MX") : "—"}</strong></div><div><span>Salida</span><strong>{patient.dischargedAt ? new Date(patient.dischargedAt).toLocaleString("es-MX") : "Aún ingresado"}</strong></div><div><span>Medicamentos</span><strong>{data.medications.filter((medication: any) => medication.patientId === patient.id).length || "Ninguno"}</strong></div><div className="history-reason">{patient.dischargeReason ? `Causa de salida: ${patient.dischargeReason}` : patient.status === "discharged" ? "Causa de salida no registrada" : ""}</div></article>)}{!data.patients.length && <div className="empty census-empty">Todavía no hay pacientes.</div>}</div></section>
    </section>
    {selected && <div className="modalback"><section className="proposal"><div className="proposalhead"><div><div className="eyebrow">Ficha del paciente</div><strong style={{ fontFamily: "Manrope", fontSize: 18 }}>{selected.fullName}</strong></div><button className="iconbtn" onClick={() => setSelected(null)}>×</button></div><div className="proposalbody"><div className="patient-details"><div><span>Ubicación</span><strong>Piso {selected.floor} · Cama {selected.bed}</strong></div><div><span>Estado</span><strong>{selected.status === "discharged" ? "Dado de alta" : "Paciente ingresado"}</strong></div><div><span>Motivo de ingreso</span><strong>{selected.reason || "No registrado"}</strong></div><div><span>Ingreso</span><strong>{selected.admittedAt ? new Date(selected.admittedAt).toLocaleString("es-MX") : "—"}</strong></div><div><span>Salida</span><strong>{selected.dischargedAt ? new Date(selected.dischargedAt).toLocaleString("es-MX") : "Aún ingresado"}</strong></div><div><span>Causa de salida</span><strong>{selected.dischargeReason || "—"}</strong></div></div><h3 className="modalsectiontitle">Medicamentos registrados</h3><div className="history-medications">{data.medications.filter((medication: any) => medication.patientId === selected.id).map((medication: any) => <div key={medication.id}><strong>{medication.name}</strong><span>{medication.dose || "Sin dosis"} · Horarios: {medication.times.join(", ")}</span></div>)}{!data.medications.some((medication: any) => medication.patientId === selected.id) && <span className="empty">No hay medicamentos registrados.</span>}</div></div><div className="proposalfoot"><button className="btn primary" onClick={() => router.push("/doctor")}>Ver ficha completa</button><button className="btn" onClick={() => setSelected(null)}>Cerrar</button></div></section></div>}
  </main>;
}
