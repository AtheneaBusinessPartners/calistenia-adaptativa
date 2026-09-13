import { describe, expect, it } from "vitest";
import { planNextSession } from "../src/engine/sessionPlanner.js";
import { EXERCISES_BY_ID } from "../src/data/exercises.js";
import type { SessionLogEntry } from "../src/engine/progression.js";

const pullUp = EXERCISES_BY_ID["pull_up"]!; // sets_x_reps 3x8, progressions -> chest_to_bar_pull_up / weighted_pull_up
const handstand = EXERCISES_BY_ID["freestanding_handstand_hold"]!; // time 30s
const nordicCurl = EXERCISES_BY_ID["nordic_curl"]!; // sin progressions

describe("planNextSession (§13: progresión de volumen sesión a sesión)", () => {
  it("por debajo del listón: sube 1 rep sobre lo conseguido la última vez, no un salto arbitrario", () => {
    const history: SessionLogEntry[] = [{ reps: 5, rir: 2, techniqueOk: true }];
    const result = planNextSession(pullUp, history, EXERCISES_BY_ID);
    expect(result.exerciseId).toBe("pull_up");
    expect(result.targetReps).toBe(6);
  });

  it("simula 3×5 -> 3×6 -> 3×7 -> 3×8 sesión a sesión, tal como pide el brief", () => {
    const history: SessionLogEntry[] = [];
    const targets: (number | undefined)[] = [];
    let reps = 5;
    for (let i = 0; i < 3; i++) {
      history.push({ reps, rir: 2, techniqueOk: true });
      const result = planNextSession(pullUp, history, EXERCISES_BY_ID);
      targets.push(result.targetReps);
      reps = result.targetReps ?? reps; // el usuario cumple el nuevo objetivo la próxima sesión
    }
    expect(targets).toEqual([6, 7, 8]);

    // Al llegar exactamente al listón de dominio (8), la SIGUIENTE sesión ya
    // no sigue subiendo reps del mismo ejercicio para siempre: avanza de
    // línea (principio de "no repetición estúpida", §30).
    history.push({ reps: 8, rir: 2, techniqueOk: true });
    const afterMastery = planNextSession(pullUp, history, EXERCISES_BY_ID);
    expect(afterMastery.exerciseId).toBe("chest_to_bar_pull_up");
  });

  it("por debajo del listón en un ejercicio de tiempo: sube unos segundos, no reps", () => {
    const history: SessionLogEntry[] = [{ seconds: 15, rir: 2, techniqueOk: true }];
    const result = planNextSession(handstand, history, EXERCISES_BY_ID);
    expect(result.targetSeconds).toBe(18);
    expect(result.targetReps).toBeUndefined();
  });

  it("al cumplir el listón, avanza al primer ejercicio de progressions en su extremo bajo", () => {
    const history: SessionLogEntry[] = [{ reps: 8, rir: 2, techniqueOk: true }];
    const result = planNextSession(pullUp, history, EXERCISES_BY_ID);
    const next = EXERCISES_BY_ID[pullUp.progressions![0]!]!;
    expect(result.exerciseId).toBe(next.id);
    expect(result.targetReps).toBeLessThanOrEqual(next.masteryCriteria.type === "sets_x_reps" ? next.masteryCriteria.reps : Infinity);
  });

  it("mala técnica por debajo del listón: retrocede a la regresión, no se queda en el mismo ejercicio", () => {
    const history: SessionLogEntry[] = [{ reps: 4, rir: 2, techniqueOk: false }];
    const result = planNextSession(pullUp, history, EXERCISES_BY_ID);
    const prev = EXERCISES_BY_ID[pullUp.regressions![0]!]!;
    expect(result.exerciseId).toBe(prev.id);
  });

  it("deload: mismo ejercicio y objetivo, series reducidas", () => {
    const history: SessionLogEntry[] = [
      { reps: 8, rir: 0, techniqueOk: true },
      { reps: 7, rir: 0, techniqueOk: true },
      { reps: 6, rir: 0, techniqueOk: true },
    ];
    const result = planNextSession(pullUp, history, EXERCISES_BY_ID);
    expect(result.exerciseId).toBe("pull_up");
    expect(result.sets).toBeLessThan(pullUp.recommendedSets);
    expect(result.targetReps).toBe(6); // mismo objetivo que la última sesión, no más exigente
  });

  it("ejercicio sin progressions al cumplir el listón: mantiene la prescripción anterior", () => {
    const history: SessionLogEntry[] = [{ reps: 5, rir: 2, techniqueOk: true }];
    const result = planNextSession(nordicCurl, history, EXERCISES_BY_ID);
    expect(result.exerciseId).toBe("nordic_curl");
  });
});
