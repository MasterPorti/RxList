import { Plan, type Doctor } from "./types";

export type CreateNurseFlowState = { name?: string };

type CreateNurseFlowResult = {
  proposal: Plan;
  nextState: CreateNurseFlowState | null;
};

const ACTION = /\b(?:agrega(?:r)?|añade|añadir|anade|anadir|registra(?:r)?|crea(?:r)?|créame)\b/iu;
const NURSE = /\bene?fermer[oa]\b/iu;
const NAME_TOKEN = /^[\p{L}][\p{L}'’-]*$/u;

const normalize = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/\s+/g, " ")
  .trim();

function locationFrom(message: string): 1 | 2 | 3 | 4 | "unassigned" | undefined {
  const floor = message.match(/\bpiso\s*(?:n(?:úmero|umero)?\.?\s*)?(1|2|3|4)\b/iu);
  if (floor) return Number(floor[1]) as 1 | 2 | 3 | 4;
  if (/\bsin\s+asignar\b|\bning(?:un|uno|una)\s+piso\b|\bno\s+(?:le\s+)?pongas?\s+piso\b|\bdéjal[oa]\s+pendiente\b/iu.test(message)) return "unassigned";
  return undefined;
}

function cleanName(value: string) {
  const withoutLocation = value
    .replace(/\s+(?:al?|en|hacia)\s+(?:el\s+)?piso\b[\s\S]*$/iu, "")
    .replace(/\s+(?:sin\s+asignar|en\s+ning(?:un|uno|una)\s+piso)\b[\s\S]*$/iu, "")
    .replace(/[.,!?;:]+$/g, "")
    .trim();
  const tokens = withoutLocation.split(/\s+/).filter(Boolean);
  return tokens.length > 0 && tokens.length <= 6 && tokens.every(token => NAME_TOKEN.test(token))
    ? tokens.join(" ")
    : "";
}

function extractNameFromIntent(message: string) {
  const action = ACTION.exec(message);
  if (!action) return "";
  let tail = message.slice(action.index + action[0].length).trim();
  const markedName = tail.match(/(?:con\s+(?:el\s+)?nombre\s+(?:de\s+)?|(?:que\s+)?se\s+llama\s+|llamad[oa]\s+)([\s\S]+)/iu)?.[1];
  if (markedName) return cleanName(markedName);
  tail = tail.replace(
    /^(?:(?:a|un|una|nuevo|nueva)\s+|ene?fermer[oa]\s+|(?:que\s+)?se\s+llama\s+|llamad[oa]\s+|con\s+(?:el\s+)?nombre\s+(?:de\s+)?)+/iu,
    "",
  );
  return cleanName(tail);
}

function extractNameReply(message: string) {
  const withMarker = message.match(/(?:el\s+nombre\s+es|(?:que\s+)?se\s+llama|llamad[oa])\s+([\s\S]+)/iu)?.[1];
  return cleanName(withMarker || message);
}

function isFullName(name: string) {
  return name.split(/\s+/).filter(Boolean).length >= 2;
}

export function handleCreateNurse(
  message: string,
  doctor: Doctor,
  state?: CreateNurseFlowState,
): CreateNurseFlowResult | null {
  const current = message.trim();
  const hasPendingFlow = state !== undefined;
  const action = ACTION.test(current);
  const addIntent = action && (NURSE.test(current) || /\b(?:agrega(?:r)?|registra(?:r)?)\s+a\b/iu.test(current));

  // A floor mentioned as part of a different command is not an answer to this flow.
  if (hasPendingFlow && /\b(?:mueve|mover|traslada|trasladar|reubica|reubicar)\b/iu.test(current)) return null;

  if (hasPendingFlow && /^(?:cancela(?:r)?|olvida(?:lo)?|ya\s+no)$/iu.test(current)) {
    return {
      proposal: Plan.parse({ type: "no_change", message: "De acuerdo, cancelé el registro pendiente.", operations: [] }),
      nextState: null,
    };
  }

  if (!addIntent && !hasPendingFlow) return null;

  const location = locationFrom(current);
  let suppliedName = addIntent ? extractNameFromIntent(current) : "";

  if (hasPendingFlow && !suppliedName && location === undefined) {
    suppliedName = extractNameReply(current);
    if (!suppliedName) return null;
  }

  let name = suppliedName || state?.name || "";
  if (state?.name && suppliedName && !isFullName(suppliedName) && !isFullName(state.name)) {
    name = `${state.name} ${suppliedName}`;
  }
  name = name.replace(/\s+/g, " ").trim();

  if (!isFullName(name)) {
    return {
      proposal: Plan.parse({
        type: "clarification",
        message: name
          ? `Necesito el apellido de ${name}. Por ejemplo: ${name} Morales.`
          : "Necesito nombre y apellido, por ejemplo: José Morales.",
        operations: [],
      }),
      nextState: name ? { name } : {},
    };
  }

  if (doctor.nurses.some(nurse => normalize(nurse.name) === normalize(name))) {
    return {
      proposal: Plan.parse({
        type: "clarification",
        message: `Ya existe ${name}. Agrega un segundo nombre, apellido o modifica el nombre completo.`,
        operations: [],
      }),
      nextState: { name },
    };
  }

  if (location === undefined) {
    return {
      proposal: Plan.parse({
        type: "clarification",
        message: `¿En qué piso deseas registrar a ${name}? También puedes indicar “sin asignar”.`,
        operations: [],
      }),
      nextState: { name },
    };
  }

  const destination = location === "unassigned" ? "Sin asignar" : `el piso ${location}`;
  return {
    proposal: Plan.parse({
      type: "proposal",
      message: `Se propone registrar a ${name} como nueva enfermera en ${destination}.`,
      operations: [{
        action: "create_nurse",
        nurseId: "new",
        name,
        from: location,
        to: location,
        floor: location,
      }],
    }),
    nextState: null,
  };
}
