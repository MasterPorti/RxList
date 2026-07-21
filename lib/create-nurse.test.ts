import { describe, expect, it } from "vitest";
import { handleCreateNurse, type CreateNurseFlowState } from "./create-nurse";
import type { Doctor } from "./types";

const doctor: Doctor = {
  id: "d",
  name: "D",
  email: "d@x",
  passwordHash: "x",
  role: "doctor",
  nurses: [{ id: "s", name: "Sofía Rivero", floor: 1 }],
};

function turn(message: string, state?: CreateNurseFlowState) {
  const result = handleCreateNurse(message, doctor, state);
  expect(result).not.toBeNull();
  return result!;
}

describe("flujo determinista para registrar enfermeras", () => {
  it("reemplaza el nombre corto pendiente cuando llega el nombre completo", () => {
    const first = turn("agrega a jose");
    expect(first.proposal.message).toContain("apellido de jose");

    const second = turn("puedes crear un nuevo enefermero llamado jose Morales", first.nextState!);
    expect(second.proposal).toMatchObject({
      type: "clarification",
      message: expect.stringContaining("jose Morales"),
    });

    const third = turn("en el piso 3", second.nextState!);
    expect(third.proposal).toMatchObject({
      type: "proposal",
      operations: [{ action: "create_nurse", name: "jose Morales", floor: 3 }],
    });
    expect(third.nextState).toBeNull();
  });

  it("permite responder solo con el apellido", () => {
    const first = turn("agrega a José");
    const second = turn("Morales", first.nextState!);
    expect(second.nextState).toEqual({ name: "José Morales" });
    expect(second.proposal.message).toContain("José Morales");
  });

  it("crea en un solo turno si recibe nombre completo y piso", () => {
    expect(turn("crea una enfermera llamada Ana López en el piso 2").proposal).toMatchObject({
      type: "proposal",
      operations: [{ name: "Ana López", floor: 2 }],
    });
  });

  it("acepta una ubicación sin asignar explícita", () => {
    expect(turn("registra a Luis Pérez sin asignar").proposal).toMatchObject({
      type: "proposal",
      operations: [{ name: "Luis Pérez", floor: "unassigned" }],
    });
  });

  it("detecta duplicados ignorando acentos y mayúsculas", () => {
    expect(turn("agrega una enfermera llamada sofia rivero al piso 2").proposal).toMatchObject({
      type: "clarification",
      message: expect.stringContaining("Ya existe"),
    });
  });

  it("no secuestra una instrucción no relacionada mientras espera el piso", () => {
    expect(handleCreateNurse("mueve a Sofía al piso 2", doctor, { name: "Ana López" })).toBeNull();
  });
});
