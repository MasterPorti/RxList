import { describe, expect, it } from "vitest";
import { routePrompt } from "./prompt-gateway";
import type { Doctor, Store } from "./types";

const doctor: Doctor = { id: "d", name: "D", email: "d@x", passwordHash: "x", role: "doctor", nurses: [] };
const store = {
  schemaVersion: 2, revision: 1, users: [], floors: [{ id: 1, name: "Medicina", description: "", beds: 2 }, { id: 2, name: "Pediatría", description: "", beds: 2 }, { id: 3, name: "Cirugía", description: "", beds: 2 }, { id: 4, name: "Urgencias", description: "", beds: 2 }],
  patients: [{ id: "p", fullName: "Roberto Castillo Vega", birthDate: "1964-08-30", reason: "Dolor", allergies: "Ninguna", emergencyContact: "Patricia Vega", emergencyPhone: "555", floor: 4, bed: 2, admittedAt: "", status: "admitted", notes: "" }],
  shifts: [], medications: [], tasks: [], vitals: [], messages: [], audit: [], chatHistory: {}
} as Store;

describe("prompt gateway", () => {
  it("delega consultas de información al proveedor configurado", () => {
    const result = routePrompt("contacto de emergencia de Roberto Castillo Vega", store, doctor);
    expect(result.provider).toBe("agy");
    if (result.provider === "agy") expect(result.context.patients[0].fullName).toBe("Roberto Castillo Vega");
  });
  it("incluye todos los pacientes del piso mencionado en el contexto", () => {
    const result = routePrompt("dime quién está en pediatría", store, doctor);
    expect(result.provider).toBe("agy");
    if (result.provider === "agy") expect(result.context.patients).toHaveLength(1);
  });
  it("no decide internamente si la consulta es de enfermeros o pacientes", () => {
    const result = routePrompt("enfemeros que estan en pediatria?", store, doctor);
    expect(result.provider).toBe("agy");
    if (result.provider === "agy") expect(result.message).toContain("enfemeros");
  });
});
