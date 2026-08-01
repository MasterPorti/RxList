import { describe, expect, it } from "vitest";
import { routePrompt } from "./prompt-gateway";
import type { Doctor, Store } from "./types";

const doctor: Doctor = { id: "d", name: "D", email: "d@x", passwordHash: "x", role: "doctor", nurses: [] };
const store = {
  schemaVersion: 2, revision: 1, users: [], floors: [{ id: 1, name: "Medicina", description: "", beds: 2 }, { id: 2, name: "Pediatría", description: "", beds: 2 }, { id: 3, name: "Cirugía", description: "", beds: 2 }, { id: 4, name: "Urgencias", description: "", beds: 2 }],
  patients: [{ id: "p", fullName: "Roberto Castillo Vega", birthDate: "1964-08-30", reason: "Dolor", allergies: "Ninguna", emergencyContact: "Patricia Vega", emergencyPhone: "555", floor: 4, bed: 2, admittedAt: "", status: "admitted", notes: "" }],
  shifts: [], medications: [], tasks: [], vitals: [], audit: [], chatHistory: {}
} as Store;

describe("prompt gateway", () => {
  it("responde consultas de contacto sin AGY", () => {
    const result = routePrompt("contacto de emergencia de Roberto Castillo Vega", store, doctor);
    expect(result.provider).toBe("local");
    if (result.provider === "local") expect(result.proposal.message).toContain("Patricia Vega");
  });
  it("mantiene las acciones para AGY con contexto compacto", () => {
    const result = routePrompt("mueve a Roberto Castillo Vega al piso 3", store, doctor);
    expect(result.provider).toBe("agy");
    if (result.provider === "agy") expect(result.context.patients).toHaveLength(1);
  });
  it("pide piso y cama localmente en la continuación de un alta de paciente", () => {
    const result = routePrompt(`<HISTORIAL>\nDoctor: agrega a Karime Gonzales\nAsistente: ¿Desea registrar a Karime Gonzales como paciente o como enfermera?\nDoctor: como paciente\nAsistente: Para registrar a Karime Gonzales como paciente, por favor proporcione los datos obligatorios.\n</HISTORIAL>\n<ULTIMO_MENSAJE_DEL_DOCTOR>\n14 de junio del dosmil cinco le duele la panza a las papas es alergica y es Julio 5560305975 el contacto de emergencia\n</ULTIMO_MENSAJE_DEL_DOCTOR>`, store, doctor);
    expect(result.provider).toBe("local");
    if (result.provider === "local") {
      expect(result.proposal.type).toBe("clarification");
      expect(result.proposal.missing).toEqual(["floor"]);
      expect(result.proposal.message).toContain("cama libre");
    }
  });
});
