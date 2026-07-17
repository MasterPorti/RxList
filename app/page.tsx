"use client";

import { useState, useEffect, useMemo, type ReactNode } from "react";
import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";
import {
  getSession,
  logoutUser,
  loginUser,
  registerDoctor,
  updateDoctor,
  getDoctors,
  registerNurse,
  updateNurse,
  getDoctorNurses,
  assignNurseToFloor,
  type User,
} from "@/lib/db";

type FloorJobState = "interpreting" | "awaiting_confirmation" | "running" | "completed" | "failed";

interface FloorJobView {
  id?: string;
  state: FloorJobState;
  status: "success" | "error";
  output: string;
  nurseName?: string;
  fromFloor?: string;
  toFloor?: string;
}

/* ─── SVG Icon Components ─── */
function RxIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h6a3 3 0 0 1 3 3v0a3 3 0 0 1-3 3H6V3z" />
      <path d="M6 9h5l5 12" />
      <path d="M13 15l5-6" />
      <line x1="6" y1="3" x2="6" y2="21" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M22 4L12 13L2 4" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    </svg>
  );
}

function ShieldAlertIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function StethoscopeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5C3.5 15.5 3 14 3 12.5V11c0-4 3-7 7-7s7 3 7 7v1.5c0 1.5-.5 3-1.5 4" />
      <path d="M21 10a2 2 0 0 0-2-2h-2v4h2a2 2 0 0 0 2-2z" />
      <path d="M7 10a2 2 0 0 1 2-2h2v4H9a2 2 0 0 1-2-2z" />
      <path d="M12 4v16a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}

function renderInlineMarkdown(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return <span key={index}>{part}</span>;
  });
}

function renderRxBotMarkdown(text: string) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (!listItems.length) return;
    blocks.push(
      <ul key={`list-${blocks.length}`}>
        {listItems.map((item, index) => (
          <li key={index}>{renderInlineMarkdown(item)}</li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const listItem = trimmed.match(/^(?:[-*])\s+(.+)$/);

    if (listItem) {
      listItems.push(listItem[1]);
      return;
    }

    flushList();
    if (!trimmed) return;

    const heading = trimmed.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      blocks.push(
        <strong className="rxbot-markdown-heading" key={`heading-${index}`}>
          {renderInlineMarkdown(heading[1])}
        </strong>,
      );
    } else {
      blocks.push(<p key={`paragraph-${index}`}>{renderInlineMarkdown(trimmed)}</p>);
    }
  });

  flushList();
  return blocks;
}

export default function UnifiedApp() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Login Form Inputs
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Admin Panel: Register/Edit Doctor Form Inputs
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [docName, setDocName] = useState("");
  const [docEmail, setDocEmail] = useState("");
  const [docPassword, setDocPassword] = useState("");
  const [docRegError, setDocRegError] = useState<string | null>(null);
  const [docRegSuccess, setDocRegSuccess] = useState<string | null>(null);
  const [doctorsList, setDoctorsList] = useState<User[]>([]);

  // Doctor Panel: Register/Edit Nurse Modal & List State
  const [nursesList, setNursesList] = useState<User[]>([]);
  const [showAddNurseModal, setShowAddNurseModal] = useState(false);
  const [editingNurseId, setEditingNurseId] = useState<string | null>(null);
  const [nurseName, setNurseName] = useState("");
  const [nurseEmail, setNurseEmail] = useState("");
  const [nursePassword, setNursePassword] = useState("");
  const [nurseRegError, setNurseRegError] = useState<string | null>(null);
  const [nurseRegSuccess, setNurseRegSuccess] = useState<string | null>(null);

  // Dictado Clínico IA
  const [noteText, setNoteText] = useState("");
  const [dictationEngine, setDictationEngine] = useState<"whisper" | "browser">("whisper");
  const [isDictating, setIsDictating] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recognitionObj, setRecognitionObj] = useState<any>(null);
  const [dictationStatus, setDictationStatus] = useState("Listo para dictar");
  const [floorJob, setFloorJob] = useState<FloorJobView | null>(null);
  const rxBotTransport = useMemo(() => new TextStreamChatTransport({
    api: "/api/rxbot",
    body: { doctorId: user?.id ?? null },
  }), [user?.id]);
  const {
    messages: rxBotMessages,
    setMessages: setRxBotMessages,
    sendMessage: sendRxBotMessage,
    status: rxBotStatus,
    error: rxBotError,
    clearError: clearRxBotError,
  } = useChat({ transport: rxBotTransport });
  const isRxBotThinking = rxBotStatus === "submitted" || rxBotStatus === "streaming";

  // Check session on mount
  useEffect(() => {
    const session = getSession();
    if (session) {
      setUser(session);
      setIsLoggedIn(true);
      if (session.role === "admin") {
        loadDoctors();
      } else if (session.role === "doctor") {
        loadNurses(session.id);
      }
    } else {
      setIsLoggedIn(false);
    }
  }, []);

  const loadDoctors = async () => {
    const docs = await getDoctors();
    setDoctorsList(docs);
  };

  const loadNurses = async (doctorId: string) => {
    const nurses = await getDoctorNurses(doctorId);
    setNursesList(nurses);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!email || !password) {
      setAuthError("Por favor, introduce todos los campos.");
      return;
    }
    setLoading(true);
    const res = await loginUser(email, password);
    setLoading(false);
    
    if (typeof res === "string") {
      setAuthError(res);
    } else {
      setUser(res);
      setIsLoggedIn(true);
      if (res.role === "admin") {
        await loadDoctors();
      } else if (res.role === "doctor") {
        await loadNurses(res.id);
      }
    }
  };

  const handleSaveDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    setDocRegError(null);
    setDocRegSuccess(null);
    if (!docName || !docEmail) {
      setDocRegError("Por favor llena todos los campos obligatorios.");
      return;
    }
    
    setLoading(true);
    let res;
    if (editingDocId) {
      res = await updateDoctor(editingDocId, docName, docEmail, docPassword || undefined);
    } else {
      if (!docPassword) {
        setDocRegError("Por favor ingresa una contraseña.");
        setLoading(false);
        return;
      }
      res = await registerDoctor(docName, docEmail, docPassword);
    }
    setLoading(false);

    if (typeof res === "string") {
      setDocRegError(res);
    } else {
      setDocRegSuccess(
        editingDocId
          ? `El Dr. ${res.name} fue actualizado con éxito.`
          : `El Dr. ${res.name} fue registrado con éxito.`
      );
      setDocName("");
      setDocEmail("");
      setDocPassword("");
      setEditingDocId(null);
      await loadDoctors();
    }
  };

  const handleSaveNurse = async (e: React.FormEvent) => {
    e.preventDefault();
    setNurseRegError(null);
    setNurseRegSuccess(null);
    if (!user) return;

    if (!nurseName || !nurseEmail) {
      setNurseRegError("Por favor llena todos los campos obligatorios.");
      return;
    }

    setLoading(true);
    let res;
    if (editingNurseId) {
      res = await updateNurse(editingNurseId, nurseName, nurseEmail, nursePassword || undefined);
    } else {
      if (!nursePassword) {
        setNurseRegError("Por favor ingresa una contraseña.");
        setLoading(false);
        return;
      }
      res = await registerNurse(nurseName, nurseEmail, nursePassword, user.id);
    }
    setLoading(false);

    if (typeof res === "string") {
      setNurseRegError(res);
    } else {
      setNurseRegSuccess(
        editingNurseId
          ? `La enfermera ${res.name} fue actualizada con éxito.`
          : `La enfermera ${res.name} fue registrada con éxito.`
      );
      setNurseName("");
      setNurseEmail("");
      setNursePassword("");
      setEditingNurseId(null);
      await loadNurses(user.id);
      setTimeout(() => {
        setNurseRegSuccess(null);
        setShowAddNurseModal(false);
      }, 1200);
    }
  };

  const handleAssignFloor = async (nurseId: string, floor: string) => {
    if (!user) return;
    setLoading(true);
    const res = await assignNurseToFloor(nurseId, floor);
    setLoading(false);
    
    if (typeof res === "string") {
      alert(`Error al asignar piso: ${res}`);
    } else {
      await loadNurses(user.id);
    }
  };

  const interpretFloorOrder = async (transcript = noteText) => {
    if (!user || user.role !== "doctor" || !transcript.trim()) return;
    setFloorJob({ state: "interpreting", status: "success", output: "Esperando razonamiento para validar la orden..." });
    try {
      const response = await fetch("/api/agent/floor-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "interpret", transcript, doctorId: user.id }),
      });
      const data = (await response.json()) as FloorJobView;
      // Las preguntas normales no son cambios de piso; no mostramos una
      // tarjeta de error por ellas. Solo dejamos visible una orden válida.
      setFloorJob(data.state === "failed" ? null : data);
    } catch {
      setFloorJob({ state: "failed", status: "error", output: "No se pudo contactar al servicio de asignaciones." });
    }
  };

  const confirmFloorOrder = async () => {
    if (!floorJob?.id || floorJob.state !== "awaiting_confirmation") return;
    setFloorJob((current) => current ? { ...current, state: "running", output: "Iniciando agy..." } : current);
    try {
      const response = await fetch("/api/agent/floor-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", jobId: floorJob.id }),
      });
      const data = (await response.json()) as FloorJobView;
      setFloorJob(data);
    } catch {
      setFloorJob((current) => current ? { ...current, state: "failed", status: "error", output: "No se pudo iniciar agy." } : current);
    }
  };

  useEffect(() => {
    if (!floorJob?.id || floorJob.state !== "running") return;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/agent/floor-jobs/${floorJob.id}`, { cache: "no-store" });
        const data = (await response.json()) as FloorJobView;
        setFloorJob(data);
        if (data.state === "completed" && user) {
          const nurses = await getDoctorNurses(user.id);
          setNursesList(nurses);
        }
      } catch {
        setFloorJob((current) => current ? { ...current, state: "failed", status: "error", output: "Se perdió la conexión con el trabajo." } : current);
      }
    }, 750);
    return () => window.clearInterval(timer);
  }, [floorJob?.id, floorJob?.state, user]);

  const handleEditDoctorStart = (doc: User) => {
    setEditingDocId(doc.id);
    setDocName(doc.name);
    setDocEmail(doc.email);
    setDocPassword("");
    setDocRegError(null);
    setDocRegSuccess(null);
  };

  const handleCancelEditDoctor = () => {
    setEditingDocId(null);
    setDocName("");
    setDocEmail("");
    setDocPassword("");
    setDocRegError(null);
    setDocRegSuccess(null);
  };

  const handleEditNurseStart = (nurse: User) => {
    setEditingNurseId(nurse.id);
    setNurseName(nurse.name);
    setNurseEmail(nurse.email);
    setNursePassword("");
    setNurseRegError(null);
    setNurseRegSuccess(null);
    setShowAddNurseModal(true);
  };

  const handleCancelEditNurse = () => {
    setEditingNurseId(null);
    setNurseName("");
    setNurseEmail("");
    setNursePassword("");
    setNurseRegError(null);
    setNurseRegSuccess(null);
    setShowAddNurseModal(false);
  };

  // Dictado Clínico IA handlers
  const startBrowserRecognition = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setDictationStatus("Web Speech API no soportada en este navegador.");
      alert("Tu navegador no soporta el reconocimiento de voz nativo. Por favor usa Google Chrome o Microsoft Edge.");
      return;
    }
    
    try {
      const recognition = new SpeechRecognitionAPI();
      recognition.lang = "es-ES";
      recognition.continuous = true;
      recognition.interimResults = false;
      
      recognition.onstart = () => {
        setIsDictating(true);
        setDictationStatus("Escuchando (Navegador Online)...");
      };
      
      recognition.onresult = (event: any) => {
        let finalTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setNoteText(prev => prev + (prev ? " " : "") + finalTranscript.trim());
        }
      };
      
      recognition.onerror = (event: any) => {
        console.error("Error en reconocimiento:", event.error);
        if (event.error === "no-speech") return;
        setDictationStatus(`Error: ${event.error}`);
        setIsDictating(false);
      };
      
      recognition.onend = () => {
        setIsDictating(false);
        setDictationStatus("Dictado finalizado.");
      };
      
      recognition.start();
      setRecognitionObj(recognition);
    } catch (e: any) {
      console.error(e);
      setDictationStatus(`Error: ${e.message}`);
    }
  };

  const stopBrowserRecognition = () => {
    if (recognitionObj) {
      recognitionObj.stop();
      setRecognitionObj(null);
    }
  };

  const startWhisperRecording = async () => {
    if (typeof window === "undefined") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let options = {};
      if (MediaRecorder.isTypeSupported("audio/webm")) {
        options = { mimeType: "audio/webm" };
      }
      
      const recorder = new MediaRecorder(stream, options);
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(chunks, { type: chunks[0]?.type || "audio/wav" });
        await sendAudioToLocalWhisper(audioBlob);
      };
      
      recorder.start();
      setMediaRecorder(recorder);
      setIsDictating(true);
      setDictationStatus("Grabando audio local...");
    } catch (err: any) {
      console.error("Error al acceder al micrófono:", err);
      setDictationStatus("Error: Permiso de micrófono denegado.");
      alert("No se pudo acceder al micrófono. Por favor permite el acceso en tu navegador.");
    }
  };

  const stopWhisperRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setMediaRecorder(null);
      setIsDictating(false);
    }
  };

  const sendAudioToLocalWhisper = async (audioBlob: Blob) => {
    setDictationStatus("Transcribiendo con Whisper Local...");
    const formData = new FormData();
    formData.append("file", audioBlob, "audio.wav");
    
    try {
      const res = await fetch("http://127.0.0.1:8000/transcribe", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        throw new Error(`Servidor retornó código HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.success) {
        setNoteText(prev => prev + (prev ? " " : "") + data.text);
        setDictationStatus("Transcripción Whisper completada.");
        await submitRxBotMessage(data.text);
      } else {
        setDictationStatus(`Error en Whisper: ${data.error}`);
        alert(`Error en Whisper: ${data.error}`);
      }
    } catch (err) {
      console.error("Error conectando con Whisper local:", err);
      setDictationStatus("Servidor offline. Cambiando a Navegador...");
      alert("El servidor Whisper local (puerto 8000) no responde o está apagado.\nSe cambiará automáticamente al reconocimiento de voz del navegador.");
      setDictationEngine("browser");
      setIsDictating(false);
    }
  };

  const submitRxBotMessage = async (text = noteText) => {
    const trimmedText = text.trim();
    if (!trimmedText || isRxBotThinking) return;

    const authorizesFloorChange = floorJob?.state === "awaiting_confirmation" &&
      /^(sí|si|confirmo|confirmar|autoriza|autorizo|adelante|hazlo)\b/i.test(trimmedText);
    if (authorizesFloorChange) {
      setNoteText("");
      setDictationStatus("Autorización recibida. Aplicando cambio...");
      void confirmFloorOrder();
      return;
    }

    // El servidor analiza automáticamente si el mensaje contiene una orden
    // de cambio. El frontend no depende de una lista fija de palabras.
    void interpretFloorOrder(trimmedText);

    setDictationStatus("RxBot pensando con Gemini 3.5 Flash...");
    await sendRxBotMessage({ text: trimmedText });
    setNoteText("");
    setDictationStatus("RxBot listo.");
  };

  const startNewRxBotChat = () => {
    const hasConversation = rxBotMessages.length > 0 || noteText.trim() || floorJob;
    if (hasConversation && !window.confirm("Se va a borrar el chat actual de RxBot. ¿Quieres empezar uno nuevo?")) {
      return;
    }

    setRxBotMessages([]);
    clearRxBotError();
    setNoteText("");
    setFloorJob(null);
    setDictationStatus("Nuevo chat listo.");
  };

  const toggleDictation = () => {
    if (isDictating) {
      if (dictationEngine === "browser") {
        stopBrowserRecognition();
      } else {
        stopWhisperRecording();
      }
    } else {
      if (dictationEngine === "browser") {
        startBrowserRecognition();
      } else {
        startWhisperRecording();
      }
    }
  };

  const handleCopyNote = () => {
    if (!noteText) return;
    navigator.clipboard.writeText(noteText);
    const prevStatus = dictationStatus;
    setDictationStatus("¡Nota copiada al portapapeles!");
    setTimeout(() => {
      setDictationStatus(prevStatus);
    }, 1500);
  };

  const handleLogout = () => {
    if (recognitionObj) recognitionObj.stop();
    if (mediaRecorder) mediaRecorder.stop();
    logoutUser();
    setUser(null);
    setIsLoggedIn(false);
    setEmail("");
    setPassword("");
    setAuthError(null);
    handleCancelEditDoctor();
    handleCancelEditNurse();
    setNursesList([]);
    setNoteText("");
    setIsDictating(false);
    setDictationStatus("Listo para dictar");
    setFloorJob(null);
  };

  // Prevent server render hydration flashes
  if (isLoggedIn === null) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", backgroundColor: "var(--md-sys-color-background)" }}>
        <div className="brand-logo-icon" style={{ animation: "pulse 2s infinite" }}>
          <RxIcon />
        </div>
      </div>
    );
  }

  // ─── LOGIN VIEW ───
  if (!isLoggedIn) {
    return (
      <div className="login-wrapper">
        <div className="login-left">
          <div className="animate-fade-in">
            <div className="brand-logo">
              <div className="brand-logo-icon">
                <RxIcon />
              </div>
              <div className="brand-name">
                Rx<span>List</span>
              </div>
            </div>
          </div>

          <div className="animate-fade-in-delay-1">
            <div className="status-indicator">
              <span className="status-dot" />
              Portal de Acceso Seguro Unificado
            </div>
          </div>

          <div className="login-card animate-fade-in-delay-2">
            <h1>Iniciar Sesión</h1>
            <p className="subtitle">
              Ingresa tus credenciales autorizadas como Administrador o Médico Supervisor.
            </p>

            {authError && <div className="error-message">{authError}</div>}

            <form onSubmit={handleLogin}>
              {/* Email */}
              <div className="form-group">
                <label className="form-label" htmlFor="user-email">
                  Correo Electrónico
                </label>
                <div className="form-input-wrapper">
                  <span className="form-input-icon">
                    <MailIcon />
                  </span>
                  <input
                    id="user-email"
                    className="form-input"
                    type="email"
                    placeholder="ejemplo@rxlist.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="form-group">
                <label className="form-label" htmlFor="user-password">
                  Contraseña
                </label>
                <div className="form-input-wrapper">
                  <span className="form-input-icon">
                    <LockIcon />
                  </span>
                  <input
                    id="user-password"
                    className="form-input"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? "Verificando..." : "Entrar al Sistema"}
              </button>
            </form>

            <div className="login-divider">
              <span>Accesos Rápidos Demo</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                type="button"
                className="btn-social"
                onClick={() => {
                  setEmail("admin@rxlist.com");
                  setPassword("admin123");
                }}
                style={{ marginBottom: 0 }}
              >
                Autocompletar Administrador
              </button>
              <button
                type="button"
                className="btn-social"
                onClick={() => {
                  setEmail("doctor@hospital.mx");
                  setPassword("password123");
                }}
                style={{ marginBottom: 0 }}
              >
                Autocompletar Médico Demo (Dr. Carlos)
              </button>
            </div>
          </div>

          <div className="login-footer animate-fade-in-delay-4">
            © 2026 RxList · Secure Clinical Access · HIPAA Certified
          </div>
        </div>

        {/* Right Panel — Visual Showcase */}
        <div className="login-right">
          <div className="scan-line-effect" />

          <div className="feature-showcase animate-fade-in-delay-1">
            <div className="glyph-interface">
              <div className="glyph-ring" />
              <div className="glyph-ring" />
              <div className="glyph-ring" />
              <div className="glyph-center">
                <ShieldAlertIcon />
              </div>
              <div className="glyph-dots">
                <div className="glyph-dot" />
                <div className="glyph-dot" />
                <div className="glyph-dot" />
                <div className="glyph-dot" />
              </div>
            </div>

            <h2>Seguridad de Datos Clínicos</h2>
            <p>
              RxList restringe el control y acceso según los niveles asignados. Los administradores gestionan los perfiles médicos, mientras que los médicos supervisores operan su espacio de trabajo personalizado.
            </p>

            <div className="feature-steps">
              <div className="feature-step">
                <div className="feature-step-number">01</div>
                <div className="feature-step-content">
                  <h3>Panel del Administrador</h3>
                  <p>Gestión de altas y accesos seguros de todo el personal médico supervisor.</p>
                </div>
              </div>

              <div className="feature-step">
                <div className="feature-step-number">02</div>
                <div className="feature-step-content">
                  <h3>Panel del Doctor Despejado</h3>
                  <p>Acceso a un entorno simplificado y limpio para la monitorización clínica diaria.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── ADMIN DASHBOARD VIEW ───
  if (user?.role === "admin") {
    return (
      <div className="dashboard-wrapper">
        {/* Navbar */}
        <nav className="dashboard-nav">
          <div className="nav-left">
            <div className="brand-logo" style={{ marginBottom: 0 }}>
              <div className="brand-logo-icon" style={{ width: 36, height: 36, borderRadius: "8px" }}>
                <RxIcon />
              </div>
              <div className="brand-name" style={{ fontSize: 20 }}>
                Rx<span>List</span> <span style={{ fontSize: "11px", opacity: 0.7, textTransform: "uppercase", letterSpacing: "1px" }}>[Consola Admin]</span>
              </div>
            </div>
          </div>

          <div className="nav-right">
            <div className="user-info">
              <div className="user-avatar">
                AD
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ fontWeight: 600 }}>{user?.name}</span>
                <span style={{ fontSize: "10px", color: "var(--md-sys-color-text-secondary)", textTransform: "uppercase" }}>
                  Super Administrador
                </span>
              </div>
            </div>
            <button onClick={handleLogout} className="btn-logout">
              Cerrar Sesión
            </button>
          </div>
        </nav>

        {/* Dashboard Grid Container */}
        <main className="dashboard-container">
          {loading && (
            <div style={{ background: "rgba(255, 255, 255, 0.7)", position: "fixed", inset: 0, display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
              <div style={{ textAlign: "center" }}>
                <div className="brand-logo-icon" style={{ width: 48, height: 48, margin: "0 auto 16px", animation: "pulse 1s infinite" }}>
                  <RxIcon />
                </div>
                <p style={{ fontSize: "14px", color: "var(--md-sys-color-text-secondary)" }}>Procesando...</p>
              </div>
            </div>
          )}

          <div className="dashboard-grid">
            {/* Form Column */}
            <div>
              <div className="dashboard-section-title">
                {editingDocId ? "Modificación de Perfil" : "Registro de Personal Médico"}
              </div>
              <div className="scanner-card">
                <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>
                  {editingDocId ? "Editar Perfil Médico" : "Agregar Nuevo Médico"}
                </h3>
                <p style={{ fontSize: "13px", color: "var(--rx-text-secondary)", marginBottom: "24px" }}>
                  {editingDocId 
                    ? "Modifica los datos del médico seleccionado. Deja la contraseña en blanco si no deseas cambiarla."
                    : "Ingresa los datos para registrar un Doctor. Este podrá iniciar sesión inmediatamente en la plataforma."}
                </p>

                {docRegError && <div className="error-message">{docRegError}</div>}
                {docRegSuccess && (
                  <div className="success-message">
                    {docRegSuccess}
                  </div>
                )}

                <form onSubmit={handleSaveDoctor}>
                  <div className="form-group">
                    <label className="form-label">Nombre del Doctor</label>
                    <div className="form-input-wrapper">
                      <span className="form-input-icon"><UserIcon /></span>
                      <input
                        className="form-input"
                        type="text"
                        placeholder="Dr. Carlos Ochoa"
                        value={docName}
                        onChange={(e) => setDocName(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Correo Electrónico</label>
                    <div className="form-input-wrapper">
                      <span className="form-input-icon"><MailIcon /></span>
                      <input
                        className="form-input"
                        type="email"
                        placeholder="doctor@hospital.mx"
                        value={docEmail}
                        onChange={(e) => setDocEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      {editingDocId ? "Nueva Contraseña (Dejar en blanco para conservar)" : "Contraseña de Acceso"}
                    </label>
                    <div className="form-input-wrapper">
                      <span className="form-input-icon"><LockIcon /></span>
                      <input
                        className="form-input"
                        type="password"
                        placeholder={editingDocId ? "Escribe nueva contraseña" : "Asigna una contraseña"}
                        value={docPassword}
                        onChange={(e) => setDocPassword(e.target.value)}
                        required={!editingDocId}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "12px" }}>
                    <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                      {editingDocId ? "Guardar Cambios" : "Registrar Médico en BD"}
                    </button>
                    {editingDocId && (
                      <button
                        type="button"
                        className="btn-logout"
                        onClick={handleCancelEditDoctor}
                        style={{ padding: "14px 20px" }}
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>

            {/* List Column */}
            <div>
              <div className="dashboard-section-title">Médicos Registrados ({doctorsList.length})</div>
              {doctorsList.length === 0 ? (
                <div className="rx-detail-placeholder">
                  <StethoscopeIcon />
                  <h3>No hay doctores registrados</h3>
                  <p style={{ maxWidth: "320px", fontSize: "13px", color: "var(--md-sys-color-text-secondary)" }}>
                    Los doctores que agregues mediante el formulario de la izquierda aparecerán aquí.
                  </p>
                </div>
              ) : (
                <div className="rx-list">
                  {doctorsList.map((doc) => (
                    <div key={doc.id} className="rx-item" style={{ cursor: "default" }}>
                      <div className="rx-item-header">
                        <h3 className="rx-patient-name" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ color: "var(--md-sys-color-primary)", display: "inline-flex" }}><StethoscopeIcon /></span>
                          {doc.name}
                        </h3>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          <button
                            type="button"
                            onClick={() => handleEditDoctorStart(doc)}
                            className="btn-logout"
                          >
                            Editar
                          </button>
                          <span className="rx-badge badge-active" style={{ fontSize: "9px" }}>{doc.id}</span>
                        </div>
                      </div>
                      <p className="rx-preview-text" style={{ fontStyle: "normal", marginBottom: 0 }}>
                        Contacto: <strong style={{ color: "var(--md-sys-color-text-primary)" }}>{doc.email}</strong>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ─── DOCTOR DASHBOARD VIEW (NURSE & FLOOR MANAGEMENT) ───
  return (
    <div className="dashboard-wrapper">
      {/* Navbar */}
      <nav className="dashboard-nav">
        <div className="nav-left">
          <div className="brand-logo" style={{ marginBottom: 0 }}>
            <div className="brand-logo-icon" style={{ width: 36, height: 36, borderRadius: "8px" }}>
              <RxIcon />
            </div>
            <div className="brand-name" style={{ fontSize: 20 }}>
              Rx<span>List</span> <span style={{ fontSize: "11px", opacity: 0.7, textTransform: "uppercase", letterSpacing: "1px" }}>[Portal Médico]</span>
            </div>
          </div>
        </div>

        <div className="nav-right">
          {/* Add Nurse Button in Navbar (Top Right) */}
          <button 
            onClick={() => {
              setEditingNurseId(null);
              setNurseName("");
              setNurseEmail("");
              setNursePassword("");
              setNurseRegError(null);
              setNurseRegSuccess(null);
              setShowAddNurseModal(true);
            }} 
            className="btn-primary" 
            style={{ width: "auto" }}
          >
            Agregar Enfermera
          </button>

          <div className="user-info" style={{ marginLeft: "12px" }}>
            <div className="user-avatar">
              DR
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontWeight: 600 }}>{user?.name}</span>
              <span style={{ fontSize: "10px", color: "var(--md-sys-color-text-secondary)", textTransform: "uppercase" }}>
                Médico Supervisor
              </span>
            </div>
          </div>
          <button onClick={handleLogout} className="btn-logout" style={{ marginLeft: "12px" }}>
            Cerrar Sesión
          </button>
        </div>
      </nav>

      {/* Main Dashboard Container */}
      <main className="dashboard-container">
        {loading && (
          <div style={{ background: "rgba(255, 255, 255, 0.7)", position: "fixed", inset: 0, display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
            <div style={{ textAlign: "center" }}>
              <div className="brand-logo-icon" style={{ width: 48, height: 48, margin: "0 auto 16px", animation: "pulse 1s infinite" }}>
                <RxIcon />
              </div>
              <p style={{ fontSize: "14px", color: "var(--md-sys-color-text-secondary)" }}>Sincronizando...</p>
            </div>
          </div>
        )}

        <div className="animate-fade-in" style={{ width: "100%" }}>
          {/* Welcome clean hero */}
          <div className="project-hero" style={{ marginBottom: "40px", padding: "40px 32px", textAlign: "left" }}>
            <h1 style={{ fontSize: "28px", marginBottom: "8px" }}>Bienvenido, {user?.name}</h1>
            <p style={{ fontSize: "14px", maxWidth: "none" }}>
              Tu panel de control clínico está simplificado. Puedes gestionar el registro de enfermeras en el centro médico y asignar personal a cada piso de hospitalización en tiempo real.
            </p>
          </div>

          <div className="dashboard-grid">
            {/* Left Column: Dictado Clínico IA */}
            <div>
              <div className="dashboard-section-title">Dictado Clínico IA</div>
              <div className="scanner-card rxbot-card">
                <div className="rxbot-header">
                  <div className="rxbot-avatar">
                    <RxIcon />
                  </div>
                  <div>
                    <h3>RxBot</h3>
                    <p>Pregunta por enfermeras, pisos o escribe una orden como “cambia a Laura al piso 2”.</p>
                  </div>
                  <div className="rxbot-header-actions">
                    <span className="rxbot-model-pill">Gemini 3.5 Flash</span>
                    <button type="button" className="btn-logout" onClick={startNewRxBotChat}>
                      Nuevo chat
                    </button>
                  </div>
                </div>

                {/* Selector de Motor de Voz */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <label className="form-label" style={{ fontSize: "10px" }}>Motor de Transcripción</label>
                  <div style={{ display: "flex", gap: "10px", background: "var(--md-sys-color-surface-container)", padding: "4px", borderRadius: "var(--md-radius-full)", border: "1px solid var(--md-sys-color-outline)" }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!isDictating) setDictationEngine("whisper");
                      }}
                      disabled={isDictating}
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        borderRadius: "var(--md-radius-full)",
                        border: "none",
                        background: dictationEngine === "whisper" ? "var(--md-sys-color-primary)" : "transparent",
                        color: dictationEngine === "whisper" ? "var(--md-sys-color-on-primary)" : "var(--md-sys-color-text-secondary)",
                        fontSize: "12px",
                        fontWeight: 500,
                        cursor: isDictating ? "not-allowed" : "pointer",
                        transition: "var(--md-transition-hover)"
                      }}
                    >
                      Whisper Local (Offline :8000)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!isDictating) setDictationEngine("browser");
                      }}
                      disabled={isDictating}
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        borderRadius: "var(--md-radius-full)",
                        border: "none",
                        background: dictationEngine === "browser" ? "var(--md-sys-color-primary)" : "transparent",
                        color: dictationEngine === "browser" ? "var(--md-sys-color-on-primary)" : "var(--md-sys-color-text-secondary)",
                        fontSize: "12px",
                        fontWeight: 500,
                        cursor: isDictating ? "not-allowed" : "pointer",
                        transition: "var(--md-transition-hover)"
                      }}
                    >
                      Navegador (Online)
                    </button>
                  </div>
                </div>

                <div className="rxbot-thread" aria-live="polite">
                  {rxBotMessages.length === 0 ? (
                    <div className="rxbot-empty">
                      <div className="rxbot-empty-icon">
                        <MicIcon />
                      </div>
                      <strong>Hola, soy RxBot.</strong>
                      <span>Puedes preguntarme “qué enfermeras hay”, “qué pisos existen” o “cambia a Laura al piso 2”.</span>
                    </div>
                  ) : (
                    rxBotMessages.map((message) => (
                      <div
                        key={message.id}
                        className={`rxbot-message-row ${message.role === "user" ? "rxbot-message-row-user" : "rxbot-message-row-assistant"}`}
                      >
                        <div className={`rxbot-bubble ${message.role === "user" ? "rxbot-bubble-user" : "rxbot-bubble-assistant"}`}>
                            {message.parts.map((part, index) => (
                              part.type === "text"
                                ? message.role === "assistant"
                                  ? <div key={index} className="rxbot-markdown">{renderRxBotMarkdown(part.text)}</div>
                                  : <span key={index}>{part.text}</span>
                                : null
                            ))}
                        </div>
                      </div>
                    ))
                  )}

                  {isRxBotThinking && (
                    <div className="rxbot-message-row rxbot-message-row-assistant">
                      <div className="rxbot-bubble rxbot-bubble-assistant rxbot-typing" aria-label="RxBot está escribiendo">
                        <span />
                        <span />
                        <span />
                      </div>
                    </div>
                  )}

                  {rxBotError && (
                    <div className="rxbot-error">
                      RxBot no pudo responder. Intenta mandar el mensaje otra vez.
                    </div>
                  )}
                </div>

                {floorJob && (
                  <div className={`floor-agent-card floor-agent-${floorJob.status}`} aria-live="polite">
                    <div className="floor-agent-heading">
                      <span className={`floor-agent-dot floor-agent-dot-${floorJob.state}`} />
                      <div>
                        <strong>
                          {floorJob.state === "interpreting" && "Esperando razonamiento"}
                          {floorJob.state === "awaiting_confirmation" && "RxBot necesita confirmación"}
                          {floorJob.state === "running" && "Aplicando cambio"}
                          {floorJob.state === "completed" && "Cambio terminado"}
                          {floorJob.state === "failed" && "Cambio bloqueado"}
                        </strong>
                        <p>{floorJob.output}</p>
                      </div>
                    </div>

                    {floorJob.state === "awaiting_confirmation" && (
                      <div className="floor-agent-confirmation">
                        <div>
                          <span>Enfermera</span>
                          <strong>{floorJob.nurseName}</strong>
                        </div>
                        <div>
                          <span>Movimiento</span>
                          <strong>{floorJob.fromFloor} → {floorJob.toFloor}</strong>
                        </div>
                        <div className="floor-agent-buttons">
                          <button type="button" className="btn-logout" onClick={() => setFloorJob(null)}>
                            Cancelar
                          </button>
                            <button type="button" className="btn-primary" onClick={confirmFloorOrder}>
                            Autorizar cambio
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Message composer */}
                <div className="rxbot-composer">
                  <div className="rxbot-composer-meta">
                    <span>Escribe una pregunta u orden para RxBot</span>
                    <span>{noteText.length} caracteres</span>
                  </div>
                  <input
                    className="rxbot-input"
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Ejemplo: ¿qué enfermeras hay? o cambia a Laura al piso 2"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void submitRxBotMessage();
                      }
                    }}
                  />
                  <div className="rxbot-composer-actions">
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => submitRxBotMessage()}
                      disabled={!noteText.trim() || isDictating || isRxBotThinking}
                    >
                      Enviar
                    </button>
                  </div>
                </div>

                {/* Microphone and controls row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
                  {/* Status Indicator */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span style={{ fontSize: "10px", color: "var(--md-sys-color-text-secondary)", textTransform: "uppercase", letterSpacing: "1px" }}>
                      Estado del Dictado
                    </span>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: isDictating ? "var(--md-sys-color-primary)" : "var(--md-sys-color-text-secondary)" }}>
                      {dictationStatus}
                    </span>
                  </div>

                  {/* Controls (Clear / Copy / Toggle Mic) */}
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <button
                      type="button"
                      onClick={() => setNoteText("")}
                      className="btn-logout"
                      disabled={!noteText || isDictating}
                    >
                      Limpiar
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyNote}
                      className="btn-logout"
                      disabled={!noteText}
                    >
                      Copiar Nota
                    </button>

                    {/* Microphone Circle FAB Button */}
                    <button
                      type="button"
                      onClick={toggleDictation}
                      className={`btn-primary ${isDictating ? "mic-pulsing" : ""}`}
                      style={{
                        width: "56px",
                        height: "56px",
                        borderRadius: "50%",
                        padding: 0,
                        boxShadow: "0px 4px 8px 3px rgba(0, 0, 0, 0.15)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "var(--md-sys-color-primary)",
                        border: "none",
                        cursor: "pointer"
                      }}
                      title={isDictating ? "Detener dictado" : "Iniciar dictado"}
                    >
                      <div style={{ width: "24px", height: "24px", color: "var(--md-sys-color-on-primary)" }}>
                        <MicIcon />
                      </div>
                    </button>
                  </div>
                </div>

                <div className="voice-order-actions">
                  <span>Whisper manda la transcripción a RxBot automáticamente. También puedes editar el mensaje antes de enviarlo.</span>
                </div>
              </div>
            </div>

            {/* Right Column: Enfermeras y Pisos */}
            <div>
              <div className="dashboard-section-title">
                Enfermeras y Pisos <span>({nursesList.length} registradas)</span>
              </div>

              {nursesList.length === 0 ? (
                <div className="rx-detail-placeholder">
                  <div className="checkmark-circle">
                    <UserIcon />
                  </div>
                  <h3>No tienes enfermeras registradas</h3>
                  <p style={{ maxWidth: "340px", fontSize: "13px", color: "var(--md-sys-color-text-secondary)", margin: "0 auto 16px" }}>
                    Comienza registrando tu personal a cargo presionando el botón "Agregar Enfermera".
                  </p>
                  <button 
                    onClick={() => {
                      setEditingNurseId(null);
                      setNurseName("");
                      setNurseEmail("");
                      setNursePassword("");
                      setNurseRegError(null);
                      setNurseRegSuccess(null);
                      setShowAddNurseModal(true);
                    }} 
                    className="btn-primary" 
                    style={{ width: "auto" }}
                  >
                    Registrar Primera Enfermera
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {nursesList.map((nurse) => (
                    <div key={nurse.id} className="rx-item" style={{ cursor: "default" }}>
                      <div style={{ display: "flex", gap: "16px", alignItems: "flex-start", marginBottom: "16px" }}>
                        <div className="user-avatar">
                          EN
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h3 className="rx-patient-name" style={{ fontSize: "15px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {nurse.name}
                          </h3>
                          <p style={{ fontSize: "11px", color: "var(--md-sys-color-text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {nurse.email}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleEditNurseStart(nurse)}
                          className="btn-logout"
                        >
                          Editar
                        </button>
                      </div>

                      {/* Floor Badge Indicator */}
                      <div style={{ marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "11px", color: "var(--md-sys-color-text-secondary)" }}>Ubicación:</span>
                        <span className={`rx-badge ${nurse.assignedFloor !== "Sin asignar" ? "badge-completed" : "badge-active"}`} style={{ fontSize: "10px" }}>
                          {nurse.assignedFloor || "Sin asignar"}
                        </span>
                      </div>

                      {/* Floor Selector Dropdown */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <label className="form-label" style={{ fontSize: "9px", marginBottom: "2px" }}>Asignar Piso Clínico</label>
                        <div style={{ position: "relative", width: "100%" }}>
                          <select
                            value={nurse.assignedFloor || "Sin asignar"}
                            onChange={(e) => handleAssignFloor(nurse.id, e.target.value)}
                            className="form-input"
                          >
                            <option value="Sin asignar">Sin asignar</option>
                            <option value="Piso 1 - Cardiología">Piso 1 - Cardiología</option>
                            <option value="Piso 2 - Pediatría">Piso 2 - Pediatría</option>
                            <option value="Piso 3 - Urgencias">Piso 3 - Urgencias</option>
                            <option value="Piso 4 - Terapia Intensiva">Piso 4 - Terapia Intensiva</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Floating Add/Edit Nurse Modal */}
      {showAddNurseModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "20px", fontWeight: 500, margin: 0, color: "var(--md-sys-color-text-primary)" }}>
                {editingNurseId ? "Editar Enfermera" : "Registrar Enfermera"}
              </h2>
              <button 
                onClick={handleCancelEditNurse}
                style={{ background: "none", border: "none", color: "var(--md-sys-color-text-secondary)", cursor: "pointer", fontSize: "24px", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                ×
              </button>
            </div>

            {nurseRegError && <div className="error-message">{nurseRegError}</div>}
            {nurseRegSuccess && (
              <div className="success-message">
                {nurseRegSuccess}
              </div>
            )}

            <form onSubmit={handleSaveNurse}>
              <div className="form-group">
                <label className="form-label">Nombre Completo</label>
                <div className="form-input-wrapper">
                  <span className="form-input-icon"><UserIcon /></span>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="Enf. Laura Gómez"
                    value={nurseName}
                    onChange={(e) => setNurseName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Correo Electrónico</label>
                <div className="form-input-wrapper">
                  <span className="form-input-icon"><MailIcon /></span>
                  <input
                    className="form-input"
                    type="email"
                    placeholder="enfermera@hospital.mx"
                    value={nurseEmail}
                    onChange={(e) => setNurseEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  {editingNurseId ? "Nueva Contraseña (Dejar en blanco para conservar)" : "Contraseña de Acceso"}
                </label>
                <div className="form-input-wrapper">
                  <span className="form-input-icon"><LockIcon /></span>
                  <input
                    className="form-input"
                    type="password"
                    placeholder={editingNurseId ? "Escribe nueva contraseña" : "Asigna una contraseña"}
                    value={nursePassword}
                    onChange={(e) => setNursePassword(e.target.value)}
                    required={!editingNurseId}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                  {editingNurseId ? "Guardar Cambios" : "Registrar Enfermera"}
                </button>
                <button 
                  type="button" 
                  onClick={handleCancelEditNurse}
                  className="btn-logout"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
