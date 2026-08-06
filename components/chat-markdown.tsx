"use client";
import { useEffect, useRef, useState } from "react";
import type {ReactNode} from "react";

function inline(value:string):ReactNode[]{
  return value.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean).map((part,i)=>{
    if(part.startsWith("**")&&part.endsWith("**"))return <strong key={i}>{part.slice(2,-2)}</strong>;
    if(part.startsWith("`")&&part.endsWith("`"))return <code key={i}>{part.slice(1,-1)}</code>;
    return <span key={i}>{part}</span>;
  });
}

function cells(line:string){return line.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(x=>x.trim());}

let speakNextResponse = false;

function patientCell(value: string, patientNames: string[] | undefined, onPatientInfo: ((name: string) => void) | undefined, key: string): ReactNode {
  const name = patientNames?.find(candidate => value.trim().toLocaleLowerCase() === candidate.trim().toLocaleLowerCase());
  if (!name || !onPatientInfo) return inline(value);
  return <span className="patient-hover" key={key}><button type="button" onClick={() => onPatientInfo(name)}>{value}</button><span className="patient-hover-card">Pedir información</span></span>;
}

export default function ChatMarkdown({text, patientNames, onPatientInfo, autoSpeak = false}:{text:string; patientNames?: string[]; onPatientInfo?: (name: string) => void; autoSpeak?: boolean}){
  const [speaking, setSpeaking] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [boundary, setBoundary] = useState(-1);
  const autoStarted = useRef(false);
  const speechStarted = useRef(false);
  const readable = text.replace(/```[\s\S]*?```/g, "").replace(/^\s*\|.*$/gm, "").replace(/^\s*[-*]\s*/gm, "").replace(/[*_#`|]/g, " ").replace(/\s+/g, " ").trim();
  useEffect(() => {
    const markNext = () => { speakNextResponse = true; };
    window.addEventListener("rxlist:speak-next", markNext);
    return () => window.removeEventListener("rxlist:speak-next", markNext);
  }, []);
  function speak() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); setBoundary(-1); return; }
    const utterance = new SpeechSynthesisUtterance(readable);
    utterance.lang = "es-MX";
    const voice = window.speechSynthesis.getVoices().find(item => item.lang.toLocaleLowerCase().startsWith("es"));
    if (voice) utterance.voice = voice;
    utterance.rate = .96; utterance.pitch = 1;
    speechStarted.current = false;
    utterance.onstart = () => {
      speechStarted.current = true;
      setAutoplayBlocked(false);
      window.localStorage.removeItem("rxlist:read-next");
    };
    utterance.onboundary = event => setBoundary(event.charIndex ?? -1);
    utterance.onend = () => { setSpeaking(false); setBoundary(-1); };
    utterance.onerror = () => { setSpeaking(false); setBoundary(-1); };
    setSpeaking(true); setAutoplayBlocked(false); setBoundary(0); window.speechSynthesis.cancel(); window.speechSynthesis.resume(); window.speechSynthesis.speak(utterance);
    window.setTimeout(() => {
      if (!speechStarted.current && (autoSpeak || window.localStorage.getItem("rxlist:read-next") === "true")) {
        setAutoplayBlocked(true);
        setSpeaking(false);
      }
    }, 1200);
  }
  useEffect(() => {
    const storedVoiceRequest = window.sessionStorage.getItem("rxlist:speak-next") === "1" || window.localStorage.getItem("rxlist:read-next") === "true";
    if ((!autoSpeak && !speakNextResponse && !storedVoiceRequest) || !readable || autoStarted.current) return;
    speakNextResponse = false;
    window.sessionStorage.removeItem("rxlist:speak-next");
    autoStarted.current = true;
    const timer = window.setTimeout(speak, 40);
    return () => window.clearTimeout(timer);
  }, [autoSpeak, readable]);
  const readTokens = readable ? [...readable.matchAll(/\S+\s*/g)].map(match => ({ value: match[0], start: match.index || 0, end: (match.index || 0) + match[0].length })) : [];
  function readInline(value: string, key: string): ReactNode {
    const plain = value.replace(/\*\*|`/g, "");
    const start = Math.max(readable.indexOf(plain), 0);
    return [...plain.matchAll(/\S+\s*/g)].map((match, index) => {
      const tokenStart = start + (match.index || 0), tokenEnd = tokenStart + match[0].length;
      const state = boundary >= tokenStart && boundary < tokenEnd ? "current" : boundary >= tokenEnd ? "read" : "";
      return <span className={state} key={`${key}-${index}`}>{match[0]}</span>;
    });
  }
  const lines=text.split(/\r?\n/), blocks:ReactNode[]=[];
  for(let i=0;i<lines.length;i++){
    const line=lines[i].trim();
    if(!line)continue;
    if(line.startsWith("### ")){blocks.push(<h3 key={i}>{inline(line.slice(4))}</h3>);continue;}
    if(line.startsWith("|")&&lines[i+1]?.trim().match(/^\|?\s*:?-{3,}/)){
      const head=cells(line), rows:string[][]=[];i+=2;
      while(i<lines.length&&lines[i].trim().startsWith("|")){rows.push(cells(lines[i]));i++;}
      i--;
      blocks.push(<div className="mdtablewrap" key={i}><table className="mdtable"><thead><tr>{head.map((x,j)=><th key={j}>{inline(x)}</th>)}</tr></thead><tbody>{rows.map((row,j)=><tr key={j}>{head.map((_,k)=><td key={k}>{patientCell(row[k]||"—", patientNames, onPatientInfo, `${j}-${k}`)}</td>)}</tr>)}</tbody></table></div>);
      continue;
    }
    if(/^[-*]\s+/.test(line)){
      const items:string[]=[];while(i<lines.length&&/^[-*]\s+/.test(lines[i].trim())){items.push(lines[i].trim().replace(/^[-*]\s+/,""));i++;}i--;blocks.push(<ul key={i}>{items.map((x,j)=><li key={j}>{inline(x)}</li>)}</ul>);continue;
    }
    blocks.push(<p key={i} className={speaking ? "chatmarkdown-reading-line" : ""}>{speaking ? readInline(line, String(i)) : inline(line)}</p>);
  }
  return <div className="chatmarkdown"><button type="button" className={`chatmarkdown-speak${speaking ? " active" : ""}`} onClick={speak} aria-label={speaking ? "Detener lectura" : "Leer respuesta en voz alta"} title={speaking ? "Detener lectura" : "Leer en voz alta"}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Zm12.5 3a4.5 4.5 0 0 0-2.1-3.8v7.6a4.5 4.5 0 0 0 2.1-3.8Zm0-8.2v2.1A8 8 0 0 1 20 12a8 8 0 0 1-3.5 6.1v2.1A10 10 0 0 0 22 12a10 10 0 0 0-5.5-8.2Z" /></svg></button>{blocks}</div>;
}
