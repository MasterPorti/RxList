"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Login() {
  const [email, setEmail] = useState("admin@rxlist.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [nurseMenuOpen, setNurseMenuOpen] = useState(false);
  const router = useRouter();
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const demoNurses = [
    ["Sofía Rivero", "sofia.rivero@rxlist.com"], ["Pablo Martínez", "pablo.martinez@rxlist.com"],
    ["Mariana Torres", "mariana.torres@rxlist.com"], ["Diego Hernández", "diego.hernandez@rxlist.com"],
    ["Laura Gómez", "laura.gomez@rxlist.com"], ["Andrés Silva", "andres.silva@rxlist.com"],
    ["Carmen Ruiz", "carmen.ruiz@rxlist.com"], ["Ricardo Flores", "ricardo.flores@rxlist.com"],
  ];

  function fillDemo(nextEmail: string) {
    setEmail(nextEmail);
    setPassword("1234");
    setError("");
    setNurseMenuOpen(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      setError("Correo o contraseña incorrectos.");
      return;
    }
    router.push("/");
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
        <button className="btn primary" style={{ width: "100%", marginTop: 24, padding: 13 }}>Entrar al panel →</button>
      </form>
      {demoMode && <div className="demo-login-tools">
        <div className="demo-login-label"><span>Modo demo</span><small>Rellena un acceso de prueba</small></div>
        <div className="demo-login-buttons">
          <button type="button" className="btn demo-login-button" onClick={() => fillDemo("admin@rxlist.local")}>Administrador</button>
          <button type="button" className="btn demo-login-button" onClick={() => fillDemo("erika@rxlist.com")}>Dra. Erika</button>
          <div className="demo-nurse-picker">
            <button type="button" className="btn demo-login-button" onClick={() => setNurseMenuOpen(open => !open)}>Menú enfermeros ▾</button>
            {nurseMenuOpen && <div className="demo-nurse-menu">{demoNurses.map(([name, nurseEmail]) => <button type="button" key={nurseEmail} onClick={() => fillDemo(nurseEmail)}><strong>{name}</strong><small>{nurseEmail}</small></button>)}</div>}
          </div>
        </div>
      </div>}
      <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 24 }}>Usa las credenciales que te haya proporcionado la administración.</p>
    </section>
  </main>;
}
