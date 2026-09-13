import { describe, expect, it } from "vitest";
import { decideProgression, type SessionLogEntry } from "../src/engine/progression.js";
import { EXERCISES_BY_ID } from "../src/data/exercises.js";

const pullUp = EXERCISES_BY_ID["pull_up"]!; // sets_x_reps 3x8, tiene progressions
const nordicCurl = EXERCISES_BY_ID["nordic_curl"]!; // sets_x_reps 3x5, sin progressions (tope de su línea)
const handstand = EXERCISES_BY_ID["freestanding_handstand_hold"]!; // time 30s

describe("decideProgression (§13)", () => {
  it("sin historial: mantiene y pide primera sesión de referencia", () => {
    const result = decideProgression(pullUp, []);
    expect(result.decision).toBe("MAINTAIN");
  });

  it("por debajo del listón con buena técnica: sigue en el mismo ejercicio (reps)", () => {
    const history: SessionLogEntry[] = [{ reps: 5, rir: 2, techniqueOk: true }];
    const result = decideProgression(pullUp, history);
    expect(result.decision).toBe("INCREASE_REPS");
  });

  it("por debajo del listón con buena técnica: sigue en el mismo ejercicio (tiempo)", () => {
    const history: SessionLogEntry[] = [{ seconds: 15, rir: 2, techniqueOk: true }];
    const result = decideProgression(handstand, history);
    expect(result.decision).toBe("INCREASE_TIME");
  });

  it("por debajo del listón y además mala técnica: regresa a la regresión", () => {
    const history: SessionLogEntry[] = [{ reps: 4, rir: 2, techniqueOk: false }];
    const result = decideProgression(pullUp, history);
    expect(result.decision).toBe("REGRESS");
  });

  it("cumple el listón pero con mala técnica: NO desbloquea, mantiene", () => {
    const history: SessionLogEntry[] = [{ reps: 9, rir: 2, techniqueOk: false }];
    const result = decideProgression(pullUp, history);
    expect(result.decision).toBe("MAINTAIN");
  });

  it("cumple el listón con buena técnica y hay progresión disponible: avanza", () => {
    const history: SessionLogEntry[] = [{ reps: 8, rir: 2, techniqueOk: true }];
    const result = decideProgression(pullUp, history);
    expect(result.decision).toBe("ADVANCE_PROGRESSION");
  });

  it("cumple el listón pero ya es el tope de su línea: mantiene, no intenta avanzar a nada", () => {
    const history: SessionLogEntry[] = [{ reps: 5, rir: 2, techniqueOk: true }];
    const result = decideProgression(nordicCurl, history);
    expect(result.decision).toBe("MAINTAIN");
  });

  it("rendimiento en caída con esfuerzo máximo sostenido: candidato a deload, no a regresar", () => {
    const history: SessionLogEntry[] = [
      { reps: 8, rir: 0, techniqueOk: true },
      { reps: 7, rir: 0, techniqueOk: true },
      { reps: 6, rir: 0, techniqueOk: true },
    ];
    const result = decideProgression(pullUp, history);
    expect(result.decision).toBe("DELOAD_CANDIDATE");
  });

  it("rendimiento en caída pero SIN esfuerzo alto (RIR cómodo): no es deload, es simplemente que aún no llega", () => {
    const history: SessionLogEntry[] = [
      { reps: 8, rir: 3, techniqueOk: true },
      { reps: 7, rir: 3, techniqueOk: true },
      { reps: 6, rir: 3, techniqueOk: true },
    ];
    const result = decideProgression(pullUp, history);
    expect(result.decision).not.toBe("DELOAD_CANDIDATE");
  });
});
