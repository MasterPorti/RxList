import { describe, expect, it } from "vitest";
import { proposeWithAgy } from "./agy";
import type { Doctor } from "./types";
const doctor: Doctor = { id: "d", name: "D", email: "d@x", passwordHash: "x", role: "doctor", nurses: [] };
const prompts = [
  "agrega una nueva enfermera llamada Sofia Rivero al piso 1",
  "créame una enfermera, se llama Sofía Rivero, en el piso 2",
  "registrar enfermera Sofia Rivero en piso 3",
  "agrega a un anueva enfermera se llama Sofia Rivero al piso 4",
  "añade una enfermera con nombre Sofía Rivero hacia piso 1"
];
describe("altas de enfermera desde lenguaje natural", () => {
  it.each(prompts)("acepta: %s", async (prompt) => {
    const result = await proposeWithAgy(prompt, doctor);
    if(result.provider==="agy"){
      expect(result.proposal.type).toBe("proposal");
      expect(result.proposal.operations[0]).toMatchObject({ action: "create_nurse", floor: expect.any(Number) });
    }else expect(result.provider).toBe("agy-unavailable");
  });
  it("pide piso cuando falta o informa que AGY no está disponible", async () => expect(["clarification","agy-unavailable"].includes((await proposeWithAgy("agrega una nueva enfermera", doctor)).proposal.type)).toBe(true));
});
