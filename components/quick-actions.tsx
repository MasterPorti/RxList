"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function QuickActions() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [empty, setEmpty] = useState(false);
  const [floors, setFloors] = useState<any[]>([]);
  const [floorInfo, setFloorInfo] = useState<any[] | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const locate = () => { const next = document.querySelector<HTMLElement>(".chat .messages"); setHost(next); if (next) setEmpty(![...next.children].some(child => !child.classList.contains("quick-actions"))); };
    locate(); const observer = new MutationObserver(locate); observer.observe(document.body, { childList: true, subtree: true });
    const saved = (event: Event) => { setNotice((event as CustomEvent<string>).detail); window.setTimeout(() => setNotice(""), 3000); };
    window.addEventListener("rxlist:quick-action-saved", saved);
    return () => { observer.disconnect(); window.removeEventListener("rxlist:quick-action-saved", saved); };
  }, []);
  if (!host || !empty) return null;
  async function loadFloors() {
    const response = await fetch("/api/doctor/summary"); const data = await response.json();
    setFloors(data.floors || []); setFloorInfo((data.floors || []).map((floor: any) => ({ ...floor, nurses: (data.doctor?.nurses || []).filter((nurse: any) => nurse.floor === floor.id), patients: (data.patients || []).filter((patient: any) => patient.status !== "discharged" && patient.floor === floor.id) })));
  }
  async function openPatient() { const response = await fetch("/api/doctor/summary"); const data = await response.json(); window.dispatchEvent(new CustomEvent("rxlist:open-patient-form", { detail: { fullName: "", birthDate: "", reason: "", allergies: "", emergencyContact: "", emergencyPhone: "", floor: "", floors: data.floors || [] } })); }
  async function openNurse() { const response = await fetch("/api/doctor/summary"); const data = await response.json(); window.dispatchEvent(new CustomEvent("rxlist:open-nurse-form", { detail: { name: "", birthDate: "", phone: "", floor: "", floors: data.floors || [] } })); }
  return createPortal(<div className="quick-actions"><div className="quick-welcome">💬<strong>Tu guardia, en orden.</strong><span>Atajos para las acciones más comunes.</span></div><div className="quick-action-grid"><button onClick={openPatient}><span>＋</span><strong>Agregar paciente</strong><small>Formulario directo</small></button><button onClick={openNurse}><span>♙</span><strong>Agregar enfermero</strong><small>Alta directa</small></button><button onClick={loadFloors}><span>▦</span><strong>Estado de pisos</strong><small>Personal y pacientes</small></button></div>{notice && <div className="quick-notice">{notice}</div>}{floorInfo && <div className="floor-info-modal"><div className="floor-info-head"><strong>Estado general de pisos</strong><button className="iconbtn" onClick={() => setFloorInfo(null)}>×</button></div>{floorInfo.map(floor => <div className="floor-info-row" key={floor.id}><div><strong>Piso {floor.id} · {floor.name}</strong><small>{floor.patients.length} pacientes · {floor.nurses.length} enfermeras · {floor.beds} camas</small></div><span>{floor.nurses.map((nurse: any) => nurse.name).join(", ") || "Sin personal"}</span></div>)}</div>}</div>, host);
}
