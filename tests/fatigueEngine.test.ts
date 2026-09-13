import { describe, expect, it } from "vitest";
import { computeMuscleFatigue, exerciseFatigueLoad } from "../src/engine/fatigueEngine.js";
import { EXERCISES_BY_ID } from "../src/data/exercises.js";
import type { TrainingDay } from "../src/engine/types.js";

describe("computeMuscleFatigue (§14 del brief)", () => {
  it("sin historial, no hay fatiga en ningún músculo", () => {
    expect(computeMuscleFatigue([], EXERCISES_BY_ID)).toEqual({});
  });

  it("una sesión de hoy (daysAgo=0) fatiga más que la misma sesión hace varios días", () => {
    const today: TrainingDay[] = [{ daysAgo: 0, exercises: [{ exerciseId: "pull_up", sets: 5, reps: 8, rir: 0 }] }];
    const daysAgo: TrainingDay[] = [{ daysAgo: 5, exercises: [{ exerciseId: "pull_up", sets: 5, reps: 8, rir: 0 }] }];
    const fatigueToday = computeMuscleFatigue(today, EXERCISES_BY_ID);
    const fatigueOld = computeMuscleFatigue(daysAgo, EXERCISES_BY_ID);
    expect(fatigueToday["lats"]!).toBeGreaterThan(fatigueOld["lats"] ?? 0);
  });

  it("un RIR más bajo (más cerca del fallo) genera más fatiga que uno alto con las mismas series", () => {
    const hard: TrainingDay[] = [{ daysAgo: 0, exercises: [{ exerciseId: "pull_up", sets: 4, reps: 8, rir: 0 }] }];
    const easy: TrainingDay[] = [{ daysAgo: 0, exercises: [{ exerciseId: "pull_up", sets: 4, reps: 8, rir: 4 }] }];
    const fatigueHard = computeMuscleFatigue(hard, EXERCISES_BY_ID);
    const fatigueEasy = computeMuscleFatigue(easy, EXERCISES_BY_ID);
    expect(fatigueHard["lats"]!).toBeGreaterThan(fatigueEasy["lats"]!);
  });

  it("los músculos secundarios se fatigan menos que los primarios con el mismo ejercicio", () => {
    const log: TrainingDay[] = [{ daysAgo: 0, exercises: [{ exerciseId: "pull_up", sets: 4, reps: 8, rir: 2 }] }];
    const fatigue = computeMuscleFatigue(log, EXERCISES_BY_ID);
    // pull_up: primaryMuscles=[lats,biceps], secondaryMuscles=[rhomboids,forearms]
    expect(fatigue["lats"]!).toBeGreaterThan(fatigue["rhomboids"]!);
  });

  it("un músculo que nunca aparece en ningún ejercicio realizado se queda en 0 (no en un valor inventado)", () => {
    const log: TrainingDay[] = [{ daysAgo: 0, exercises: [{ exerciseId: "bodyweight_squat", sets: 4, reps: 15, rir: 2 }] }];
    const fatigue = computeMuscleFatigue(log, EXERCISES_BY_ID);
    expect(fatigue["lats"]).toBeUndefined();
  });

  it("nunca supera 100 aunque se acumule mucho volumen sin recuperación", () => {
    const heavyLog: TrainingDay[] = Array.from({ length: 10 }, (_, i) => ({
      daysAgo: i,
      exercises: [{ exerciseId: "pull_up", sets: 8, reps: 10, rir: 0 }],
    }));
    const fatigue = computeMuscleFatigue(heavyLog, EXERCISES_BY_ID);
    expect(fatigue["lats"]!).toBeLessThanOrEqual(100);
  });
});

describe("exerciseFatigueLoad", () => {
  it("sin fatigueByMuscle, la carga es 0 (no rompe si el usuario no tiene historial)", () => {
    expect(exerciseFatigueLoad(EXERCISES_BY_ID["pull_up"]!, undefined)).toBe(0);
  });

  it("toma el máximo entre músculos primarios, no la media: uno solo agotado ya limita el ejercicio entero", () => {
    // pull_up: primaryMuscles=[lats,biceps]. Aunque biceps esté fresco,
    // lats al 80 es el cuello de botella real — no se diluye promediando.
    const load = exerciseFatigueLoad(EXERCISES_BY_ID["pull_up"]!, { lats: 80, biceps: 0 });
    expect(load).toBe(80);
  });

  it("los músculos secundarios pesan menos que un primario igual de fatigado", () => {
    const primaryFatigued = exerciseFatigueLoad(EXERCISES_BY_ID["pull_up"]!, { lats: 80 });
    const secondaryFatigued = exerciseFatigueLoad(EXERCISES_BY_ID["pull_up"]!, { rhomboids: 80, forearms: 80 });
    expect(secondaryFatigued).toBeLessThan(primaryFatigued);
  });
});
