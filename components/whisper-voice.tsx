"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type BrowserSpeech = { lang: string; continuous: boolean; interimResults: boolean; onresult: ((event: any) => void) | null; onerror: (() => void) | null; start: () => void; stop: () => void };

export default function WhisperVoice({ onTranscribed }: { onTranscribed?: (text: string) => void }) {
  const pathname = usePathname();
  const recorder = useRef<MediaRecorder | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const animation = useRef<number | null>(null);
  const timer = useRef<number | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const speech = useRef<BrowserSpeech | null>(null);
  const fallbackTranscript = useRef("");
  const fallbackInterim = useRef("");
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [levels, setLevels] = useState<number[]>(() => Array.from({ length: 24 }, () => .12));

  useEffect(() => () => {
    try { if (recorder.current?.state === "recording") recorder.current.stop(); } catch { /* Safari puede cerrar el recorder automáticamente */ }
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    try { speech.current?.stop(); } catch { /* el navegador puede detenerlo automáticamente */ }
    if (animation.current) cancelAnimationFrame(animation.current);
    if (timer.current) window.clearInterval(timer.current);
    audioContext.current?.close();
  }, []);
  if (pathname !== "/doctor" && pathname !== "/chat") return null;

  async function toggle() {
    setError("");
    if (recording) { recorder.current?.stop(); return; }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { setError("Este navegador no permite grabar audio."); return; }
    try {
      // Desbloquea la síntesis de voz dentro del gesto del micrófono. Algunos
      // navegadores bloquean una lectura iniciada después de un fetch.
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const unlock = new SpeechSynthesisUtterance("");
        unlock.volume = 0;
        window.speechSynthesis.speak(unlock);
        window.speechSynthesis.resume();
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = mediaStream;
      const canCheckType = typeof MediaRecorder.isTypeSupported === "function";
      const supportedType = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"].find(type => !canCheckType || MediaRecorder.isTypeSupported(type));
      const media = supportedType ? new MediaRecorder(mediaStream, { mimeType: supportedType }) : new MediaRecorder(mediaStream);
      // En iOS el medidor puede fallar o quedar suspendido aunque la grabación
      // sí funcione. Es opcional: nunca debe impedir iniciar MediaRecorder.
      let context: AudioContext | null = null;
      try {
        const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextCtor) {
          context = new AudioContextCtor();
          if (context.state === "suspended") await context.resume().catch(() => undefined);
          const meter = context.createAnalyser();
          meter.fftSize = 64;
          context.createMediaStreamSource(mediaStream).connect(meter);
          const samples = new Uint8Array(meter.frequencyBinCount);
          analyser.current = meter;
          audioContext.current = context;
          const draw = () => {
            try {
              meter.getByteFrequencyData(samples);
              const next = Array.from({ length: 24 }, (_, index) => Math.max(.12, Math.min(1, (samples[index % samples.length] || 0) / 150)));
              setLevels(next);
              animation.current = requestAnimationFrame(draw);
            } catch { /* El medidor de iOS puede cerrarse mientras se graba. */ }
          };
          draw();
        }
      } catch { context = null; analyser.current = null; audioContext.current = null; }
      chunks.current = [];
      fallbackTranscript.current = "";
      fallbackInterim.current = "";
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const listener = new SpeechRecognition() as BrowserSpeech;
        listener.lang = "es-MX"; listener.continuous = true; listener.interimResults = true;
        listener.onresult = event => {
          let interim = "";
          for (let index = event.resultIndex; index < event.results.length; index++) {
            const transcript = event.results[index][0]?.transcript || "";
            if (event.results[index].isFinal) fallbackTranscript.current = `${fallbackTranscript.current} ${transcript}`.trim();
            else interim += transcript;
          }
          fallbackInterim.current = interim.trim();
        };
        listener.onerror = () => undefined;
        speech.current = listener;
        try { listener.start(); } catch { speech.current = null; }
      }
      media.ondataavailable = event => { if (event.data.size) chunks.current.push(event.data); };
      let stopHandled = false;
      media.onstop = async () => {
        if (stopHandled) return;
        stopHandled = true;
        // Safari/iOS puede disparar onstop más de una vez o rechazar close().
        // El recorder y el stream deben quedar libres antes de iniciar el siguiente audio.
        if (recorder.current === media) recorder.current = null;
        mediaStream.getTracks().forEach(track => track.stop());
        if (stream.current === mediaStream) stream.current = null;
        try { speech.current?.stop(); } catch { /* el navegador puede detenerlo automáticamente */ }
        speech.current = null;
        if (animation.current) cancelAnimationFrame(animation.current);
        animation.current = null;
        analyser.current = null;
        try { await context?.close(); } catch { /* AudioContext ya cerrado por iOS */ }
        if (audioContext.current === context) audioContext.current = null;
        setLevels(Array.from({ length: 24 }, () => .12));
        setRecording(false); setBusy(true); setVoiceState(false, true);
        const form = new FormData();
        const audioType = media.mimeType || "audio/webm";
        const extension = audioType.includes("mp4") ? "mp4" : audioType.includes("ogg") ? "ogg" : "webm";
        form.append("audio", new Blob(chunks.current, { type: audioType }), `rxlist-voice.${extension}`);
        try {
          const response = await fetch("/api/transcribe", { method: "POST", body: form, credentials: "same-origin" });
          const result = await response.json();
          if (response.status === 401) throw new Error("Tu sesión expiró. Vuelve a iniciar sesión en RXList y prueba otra vez.");
          if (!response.ok || !result.text) {
            const browserText = `${fallbackTranscript.current} ${fallbackInterim.current}`.trim();
            if (!browserText) throw new Error(result.error === "transcription_unavailable" ? "Whisper no está disponible. Levanta el servicio Whisper o usa Chrome para dictar con el respaldo del navegador." : result.error || "No se pudo transcribir el audio.");
            result.text = browserText;
          }
          if (onTranscribed) onTranscribed(result.text.trim());
          else {
            const textarea = (document.querySelector(".composer textarea") || document.querySelector("textarea.composer")) as HTMLTextAreaElement | null;
            if (!textarea) throw new Error("No encontré el campo del chat.");
            window.localStorage.setItem("rxlist:read-next", "true");
            window.sessionStorage.setItem("rxlist:speak-next", "1");
            window.dispatchEvent(new CustomEvent("rxlist:speak-next"));
            const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
            setter?.call(textarea, result.text);
            textarea.dispatchEvent(new Event("input", { bubbles: true }));
            textarea.focus();
            textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
          }
        } catch (e) { setError(e instanceof Error ? e.message : "No se pudo transcribir el audio."); }
        finally { setBusy(false); setVoiceState(false, false); }
      };
      recorder.current = media; media.start(); setElapsed(0); setRecording(true); setVoiceState(true, false);
    } catch {
      stream.current?.getTracks().forEach(track => track.stop());
      stream.current = null;
      try { await audioContext.current?.close(); } catch { /* iOS puede cerrarlo automáticamente */ }
      audioContext.current = null;
      analyser.current = null;
      setRecording(false); setBusy(false);
      setError("Permite el acceso al micrófono para dictar al asistente."); setVoiceState(false, false);
    }
  }

  function setVoiceState(nextRecording: boolean, nextBusy: boolean) { window.dispatchEvent(new CustomEvent("rxlist:voice-state", { detail: { recording: nextRecording, busy: nextBusy } })); }
  function formatElapsed(value: number) { return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`; }

  useEffect(() => {
    if (recording) {
      const started = Date.now() - elapsed * 1000;
      timer.current = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 250);
    } else if (timer.current) {
      window.clearInterval(timer.current); timer.current = null;
    }
    return () => { if (timer.current) { window.clearInterval(timer.current); timer.current = null; } };
  }, [recording]);

  return <div className="whisper-control"><button type="button" className={"voice-button" + (recording ? " recording" : "") + (busy ? " processing" : "")} onClick={toggle} disabled={busy} aria-label={recording ? "Detener grabación" : busy ? "Transcribiendo audio" : "Hablar con Whisper"}>{busy ? "…" : recording ? "■" : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Zm6-3a1 1 0 0 0-2 0 4 4 0 0 1-8 0 1 1 0 0 0-2 0 6 6 0 0 0 5 5.91V20H8a1 1 0 0 0 0 2h8a1 1 0 0 0 0-2h-3v-3.09A6 6 0 0 0 18 11Z" /></svg>}</button>{recording && <><div className="voice-wave" aria-label="Nivel de voz">{levels.map((level, index) => <i key={index} style={{ height: `${Math.round(5 + level * 24)}px` }} />)}</div><span className="voice-timer" aria-live="off">{formatElapsed(elapsed)}</span></>}{busy && <><div className="voice-spinner" aria-hidden="true" /><span className="voice-status processing-status">Transcribiendo…</span></>}{error && <small>{error}</small>}</div>;
}
