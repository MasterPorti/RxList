"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Login() {
  const [email, setEmail] = useState("admin@rxlist.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [nurseMenuOpen, setNurseMenuOpen] = useState(false);
  const router = useRouter();
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const demoNurses = [
    ["Sofía Rivero", "sofia.rivero@rxlist.com"], ["Pablo Martínez", "pablo.martinez@rxlist.com"],
    ["Mariana Torres", "mariana.torres@rxlist.com"], ["Diego Hernández", "diego.hernandez@rxlist.com"],
    ["Laura Gómez", "laura.gomez@rxlist.com"], ["Andrés Silva", "andres.silva@rxlist.com"],
    ["Carmen Ruiz", "carmen.ruiz@rxlist.com"], ["Ricardo Flores", "ricardo.flores@rxlist.com"],
  ];

  async function loginWithCredentials(nextEmail: string, nextPassword: string) {
    setEmail(nextEmail);
    setPassword(nextPassword);
    setError("");
    setNurseMenuOpen(false);
    setBusy(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: nextEmail, password: nextPassword }),
      });
      if (!response.ok) {
        setError("El acceso demo no está disponible. Reinicia el proyecto con ALLOW_DEMO_LOGIN=true.");
        return;
      }
      router.push("/");
    } catch {
      setError("No se pudo conectar con RXList. Verifica que el proyecto esté iniciado.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    await loginWithCredentials(email, password);
  }

  return <main className="loginpage">
    <section className="loginintro">
      <div className="brand"><span className="mark">✚</span> RXList</div>
      <div><div className="eyebrow" style={{ color: "#a6ded6" }}>Control clínico, con calma</div><h1>El turno bajo control.</h1><p>Una vista clara para que los equipos médicos puedan concentrarse en lo importante: cuidar.</p></div>
      <small style={{ color: "#a6ded6" }}>MVP local · acceso protegido</small>
    </section>
    <section className="loginform">
      <div className="eyebrow">Bienvenido de nuevo</div><h2>Inicia sesión</h2><p className="sub">Accede a tu espacio de trabajo RXList.</p>
      <form onSubmit={submit}>
        <label className="formlabel">Correo electrónico<input className="field" type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
        <label className="formlabel">Contraseña<input className="field" type="password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
        {error && <div className="error">{error}</div>}
        <button className="btn primary" disabled={busy} style={{ width: "100%", marginTop: 24, padding: 13 }}>{busy ? "Entrando…" : "Entrar al panel →"}</button>
      </form>
      {demoMode && <div className="demo-login-tools">
        <div className="demo-login-label"><span>Modo demo</span><small>Rellena un acceso de prueba</small></div>
        <div className="demo-login-buttons">
          <a className="btn demo-login-button" href="/api/auth/demo?email=admin%40rxlist.local">Administrador</a>
          <a className="btn demo-login-button" href="/api/auth/demo?email=erika%40rxlist.com">Dra. Erika</a>
          <details className="demo-nurse-picker">
            <summary className="btn demo-login-button">Menú enfermeros ▾</summary>
            <div className="demo-nurse-menu">{demoNurses.map(([name, nurseEmail]) => <a href={`/api/auth/demo?email=${encodeURIComponent(nurseEmail)}`} key={nurseEmail}><strong>{name}</strong><small>{nurseEmail}</small></a>)}</div>
          </details>
        </div>
      </div>}
      <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 24 }}>Usa las credenciales que te haya proporcionado la administración.</p>
    </section>
  </main>;
}
