import type { Doctor } from "./types";
import { Plan } from "./types";

const rejection = "La siguiente tarea no se puede realizar. Por favor, comunícate con soporte técnico.";
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export function propose(message: string, doctor: Doctor) {
  const text = message.toLowerCase();
  const current = message.match(/<ULTIMO_MENSAJE_DEL_DOCTOR>\s*([\s\S]*?)\s*<\/ULTIMO_MENSAJE_DEL_DOCTOR>/i)?.[1] || message;
  if (/borr|elimin|contraseña|password|endpoint|secreto|comando|proyecto|doctor/.test(current.toLowerCase())) {
    return Plan.parse({ type: "rejected", message: rejection, operations: [] });
  }

  // The API includes the conversation history, so a second message can supply only the floor.
  if (/agreg|añad|anad|registr|crea|nueva enfermera/.test(text)) {
    const nameMatch = message.match(/(?:agrega|añade|anade|registrar|registra|crea|crear)\s+(?:a\s+)?(?:una\s+nueva\s+enfermera\s+)?(?:llamada\s+|con\s+nombre\s+|se\s+llama\s+)?([\p{L}]+(?:\s+[\p{L}]+)+?)(?=\s+(?:al?|en|hacia)\s+(?:el\s+)?piso\b|[,.!?]|[\n<>]|$)/iu);
    const floorMatch = text.match(/(?:al?|en|hacia)\s+(?:el\s+)?piso\s*(1|2|3|4)/);
    if (nameMatch) {
      const name = nameMatch[1].replace(/^a\s+/i, "").replace(/\s+/g, " ").trim();
      if (!floorMatch) return Plan.parse({ type: "clarification", message: `¿En qué piso deseas registrar a ${name}?`, operations: [] });
      const floor = Number(floorMatch[1]) as 1 | 2 | 3 | 4;
      if (doctor.nurses.some(n => normalize(n.name) === normalize(name))) {
        return Plan.parse({ type: "clarification", message: `Ya existe ${name}. Indica un alias, turno o código para distinguirla.`, operations: [] });
      }
      return Plan.parse({ type: "proposal", message: `Se propone registrar a ${name} en el piso ${floor}.`, operations: [{ action: "create_nurse", nurseId: "new", name, from: floor, to: floor, floor }] });
    }
  }

  const operations = [] as { nurseId: string; from: 1 | 2 | 3 | 4; to: 1 | 2 | 3 | 4 }[];
  for (const n of doctor.nurses) {
    const terms = [n.name, ...n.name.split(" "), n.alias || ""].filter(Boolean).map(x => x.toLowerCase());
    const term = terms.find(t => text.includes(t));
    if (term) {
      const context = text.slice(text.indexOf(term), text.indexOf(term) + 100);
      const match = context.match(/(?:al?|hacia)\s+(?:el\s+)?(?:piso|floor)\s*(1|2|3|4)/);
      if (!match) return Plan.parse({ type: "clarification", message: `¿A qué piso quieres mover a ${n.alias || n.name}?`, operations: [] });
      const to = Number(match[1]) as 1 | 2 | 3 | 4;
      if (n.floor === "unassigned") return Plan.parse({ type: "clarification", message: `${n.alias || n.name} está sin asignar. Confirma el piso desde el que quieres organizarla.`, operations: [] });
      if (to === n.floor) return Plan.parse({ type: "no_change", message: `${n.alias || n.name} ya se encuentra en el piso ${to}.`, operations: [] });
      operations.push({ nurseId: n.id, from: n.floor, to });
    }
  }
  if (!operations.length) return Plan.parse({ type: "clarification", message: "No identifiqué una enfermera y un piso destino. Prueba: “mueve a Sofía al piso 2”.", operations: [] });
  return Plan.parse({ type: "proposal", message: `Preparé ${operations.length} movimiento${operations.length > 1 ? "s" : ""}. Revisa y confirma para aplicarlo.`, operations });
}
