"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type BrowserSpeech = { lang: string; continuous: boolean; interimResults: boolean; onresult: ((event: any) => void) | null; onerror: (() => void) | null; start: () => void; stop: () => void };

export default function WhisperVoice() {
  const pathname = usePathname();
  const recorder = useRef<MediaRecorder | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const animation = useRef<number | null>(null);
  const chunks = useRef<Blob[]>([]);
  const speech = useRef<BrowserSpeech | null>(null);
  const fallbackTranscript = useRef("");
  const fallbackInterim = useRef("");
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [levels, setLevels] = useState<number[]>(() => Array.from({ length: 24 }, () => .12));

  useEffect(() => () => {
    recorder.current?.stop();
    try { speech.current?.stop(); } catch { /* el navegador puede detenerlo automáticamente */ }
    if (animation.current) cancelAnimationFrame(animation.current);
    audioContext.current?.close();
  }, []);
  if (pathname !== "/doctor") return null;

  async function toggle() {
    setError("");
    if (recording) { recorder.current?.stop(); return; }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { setError("Este navegador no permite grabar audio."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const supportedType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find(type => MediaRecorder.isTypeSupported(type));
      const media = supportedType ? new MediaRecorder(stream, { mimeType: supportedType }) : new MediaRecorder(stream);
      const context = new AudioContext();
      const meter = context.createAnalyser();
      meter.fftSize = 64;
      context.createMediaStreamSource(stream).connect(meter);
      const samples = new Uint8Array(meter.frequencyBinCount);
      analyser.current = meter;
      audioContext.current = context;
      const draw = () => {
        meter.getByteFrequencyData(samples);
        const next = Array.from({ length: 24 }, (_, index) => Math.max(.12, Math.min(1, (samples[index % samples.length] || 0) / 150)));
        setLevels(next);
        animation.current = requestAnimationFrame(draw);
      };
      draw();
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
      media.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        try { speech.current?.stop(); } catch { /* el navegador puede detenerlo automáticamente */ }
        speech.current = null;
        await new Promise(resolve => setTimeout(resolve, 250));
        if (animation.current) cancelAnimationFrame(animation.current);
        animation.current = null;
        analyser.current = null;
        await audioContext.current?.close();
        audioContext.current = null;
        setLevels(Array.from({ length: 24 }, () => .12));
        setRecording(false); setBusy(true);
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
          const textarea = document.querySelector(".composer textarea") as HTMLTextAreaElement | null;
          if (!textarea) throw new Error("No encontré el campo del chat.");
          const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
          setter?.call(textarea, result.text);
          textarea.dispatchEvent(new Event("input", { bubbles: true }));
          textarea.focus();
        } catch (e) { setError(e instanceof Error ? e.message : "No se pudo transcribir el audio."); }
        setBusy(false);
      };
      recorder.current = media; media.start(); setRecording(true);
    } catch { setError("Permite el acceso al micrófono para dictar al asistente."); }
  }

  return <div className="whisper-control"><button type="button" className={"voice-button" + (recording ? " recording" : "") + (busy ? " processing" : "")} onClick={toggle} disabled={busy} aria-label={recording ? "Detener grabación" : busy ? "Transcribiendo audio" : "Hablar con Whisper"}>{busy ? "…" : recording ? "■" : "🎙"}</button>{recording && <><div className="voice-wave" aria-label="Nivel de voz">{levels.map((level, index) => <i key={index} style={{ height: `${Math.round(7 + level * 20)}px` }} />)}</div><span className="voice-status">Escuchando… pulsa para terminar</span></>}{busy && <><div className="voice-spinner" aria-hidden="true" /><span className="voice-status processing-status">Transcribiendo…</span></>}{error && <small>{error}</small>}</div>;
}
