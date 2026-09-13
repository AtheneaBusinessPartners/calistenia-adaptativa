import { describe, expect, it } from "vitest";
import { computeCapabilityProfile } from "../src/engine/capabilityProfile.js";
import { evaluateSkillGate } from "../src/engine/skillGate.js";
import { rankExercises } from "../src/engine/exerciseSelector.js";
import { generateWeeklyPlan } from "../src/engine/weeklyPlan.js";
import { planNextSession } from "../src/engine/sessionPlanner.js";
import type { SessionLogEntry } from "../src/engine/progression.js";
import { EXERCISES, EXERCISES_BY_ID } from "../src/data/exercises.js";
import { SKILLS_BY_ID } from "../src/data/skills.js";
import type { AssessmentEntry, UserProfile } from "../src/engine/types.js";
import type { WorkoutBlockItem } from "../src/engine/workoutSketch.js";

// Pipeline completo FASE 1 -> FASE 2, con un objetivo DISTINTO al usuario de
// referencia del brief (muscle-up), para comprobar que nada del motor está
// pensado a medida de ese caso concreto.

function allBlocks(plan: { days: { blocks: WorkoutBlockItem[] }[] }): WorkoutBlockItem[] {
  return plan.days.flatMap((d) => d.blocks);
}

describe("Integración FASE 1 + FASE 2 — objetivo front lever (no muscle-up), 5 días/semana", () => {
  const profile: UserProfile = {
    age: 30,
    sex: "other",
    heightCm: 175,
    weightKg: 70,
    trainingExperienceYears: 4,
    calisthenicsExperience: "intermediate",
    sleepHoursAvg: 7,
    activityLevel: "active",
    goals: ["specific_skill"],
    primaryGoal: "specific_skill",
    primarySkillTarget: "front_lever",
    daysPerWeek: 5,
    sessionDurationMinutes: 50,
    minSessionDurationMinutes: 20,
    equipment: ["pullup_bar", "parallettes", "rings", "bands"],
  };

  const assessment: AssessmentEntry[] = [
    { exerciseId: "pull_up", reps: 10 },
    { exerciseId: "push_up", reps: 20 },
    { exerciseId: "hollow_body_hold", seconds: 45 },
    { exerciseId: "australian_row", reps: 5 },
    { exerciseId: "tuck_front_lever_hold", seconds: 3 },
  ];

  const capabilityProfile = computeCapabilityProfile(assessment, EXERCISES_BY_ID);
  const targetSkill = SKILLS_BY_ID["front_lever"]!;
  const gate = evaluateSkillGate(targetSkill, assessment, capabilityProfile);
  const ranked = rankExercises(EXERCISES, { user: { profile, assessment, capabilityProfile }, targetSkill, limitations: gate.limitations });
  const plan = generateWeeklyPlan(ranked, EXERCISES_BY_ID, profile.sessionDurationMinutes, profile.daysPerWeek);

  it("FASE 1: identifica tuck_front_lever_hold como la limitación de mayor prioridad", () => {
    expect(gate.limitations[0]?.requirement.type === "exercise" && gate.limitations[0]?.requirement.exerciseId).toBe(
      "tuck_front_lever_hold",
    );
  });

  it("FASE 1: pull_up (ya dominado, 10/8) no aparece como limitación", () => {
    const pullUpLimitation = gate.limitations.find(
      (l) => l.requirement.type === "exercise" && l.requirement.exerciseId === "pull_up",
    );
    expect(pullUpLimitation).toBeUndefined();
  });

  it("FASE 2: genera exactamente 5 días", () => {
    expect(plan.days).toHaveLength(5);
  });

  it("FASE 1 -> FASE 2: la limitación #1 real (tuck_front_lever_hold) SÍ aparece entrenada en el plan semanal", () => {
    const exerciseIds = allBlocks(plan).map((b) => b.exercise.id);
    expect(exerciseIds).toContain("tuck_front_lever_hold");
  });

  it("FASE 1 -> FASE 2: el movimiento final de la skill (front_lever_hold) NO aparece — está a años luz de alcance", () => {
    const exerciseIds = allBlocks(plan).map((b) => b.exercise.id);
    expect(exerciseIds).not.toContain("front_lever_hold");
  });

  it("integración: cada bloque de cada día respeta el equipamiento declarado por el usuario", () => {
    for (const block of allBlocks(plan)) {
      const required = block.exercise.equipment.filter((e) => e !== "none");
      for (const eq of required) {
        expect(profile.equipment).toContain(eq);
      }
    }
  });

  it("progresión sesión a sesión: tuck_front_lever_hold sube de forma monótona hasta el listón y entonces avanza de línea", () => {
    const exercise = EXERCISES_BY_ID["tuck_front_lever_hold"]!;
    const history: SessionLogEntry[] = [];
    let seconds = 3;
    const seenSeconds: number[] = [];
    let finalExerciseId = exercise.id;

    for (let session = 0; session < 8; session++) {
      history.push({ seconds, rir: 2, techniqueOk: true });
      const prescription = planNextSession(exercise, history, EXERCISES_BY_ID);
      if (prescription.exerciseId !== exercise.id) {
        finalExerciseId = prescription.exerciseId;
        break;
      }
      seenSeconds.push(prescription.targetSeconds!);
      seconds = prescription.targetSeconds!;
    }

    // Estrictamente creciente hasta que se alcanza el listón de dominio (15s).
    for (let i = 1; i < seenSeconds.length; i++) {
      expect(seenSeconds[i]!).toBeGreaterThan(seenSeconds[i - 1]!);
    }
    // Y al llegar al listón, avanza a la siguiente progresión de la cadena.
    expect(finalExerciseId).toBe("advanced_tuck_front_lever_hold");
  });

  it("reorganización de 5 a 3 días: no altera la prescripción de un ejercicio en curso", () => {
    const history: SessionLogEntry[] = [{ seconds: 8, rir: 2, techniqueOk: true }];
    const exercise = EXERCISES_BY_ID["tuck_front_lever_hold"]!;

    generateWeeklyPlan(ranked, EXERCISES_BY_ID, profile.sessionDurationMinutes, 5);
    const at5Days = planNextSession(exercise, history, EXERCISES_BY_ID);

    generateWeeklyPlan(ranked, EXERCISES_BY_ID, profile.sessionDurationMinutes, 3);
    const at3Days = planNextSession(exercise, history, EXERCISES_BY_ID);

    expect(at3Days).toEqual(at5Days);
  });
});

describe("Integración — caso límite: objetivo pide material que el usuario no tiene", () => {
  const profile: UserProfile = {
    age: 28,
    sex: "other",
    heightCm: 170,
    weightKg: 65,
    trainingExperienceYears: 1,
    calisthenicsExperience: "beginner",
    sleepHoursAvg: 7,
    activityLevel: "light",
    goals: ["specific_skill"],
    primaryGoal: "specific_skill",
    primarySkillTarget: "front_lever", // necesita barra — pero el usuario no tiene ninguna
    daysPerWeek: 4,
    sessionDurationMinutes: 40,
    minSessionDurationMinutes: 20,
    equipment: ["none"], // calistenia pura sin ningún material
  };

  const assessment: AssessmentEntry[] = [{ exerciseId: "push_up", reps: 8 }];
  const capabilityProfile = computeCapabilityProfile(assessment, EXERCISES_BY_ID);
  const targetSkill = SKILLS_BY_ID["front_lever"]!;
  const gate = evaluateSkillGate(targetSkill, assessment, capabilityProfile);
  const ranked = rankExercises(EXERCISES, { user: { profile, assessment, capabilityProfile }, targetSkill, limitations: gate.limitations });

  it("el ranking nunca incluye un ejercicio que requiera barra/paralelas/anillas/bandas", () => {
    for (const scored of ranked) {
      const exercise = EXERCISES_BY_ID[scored.exerciseId]!;
      const required = exercise.equipment.filter((e) => e !== "none");
      expect(required).toHaveLength(0);
    }
  });

  it("aun así se genera un plan completo de 4 días sin romper y sin días vacíos", () => {
    const plan = generateWeeklyPlan(ranked, EXERCISES_BY_ID, profile.sessionDurationMinutes, profile.daysPerWeek);
    expect(plan.days).toHaveLength(4);
    for (const day of plan.days) {
      expect(day.blocks.length).toBeGreaterThan(0);
    }
  });

  it("ningún bloque de ningún día usa material que el usuario no tiene", () => {
    const plan = generateWeeklyPlan(ranked, EXERCISES_BY_ID, profile.sessionDurationMinutes, profile.daysPerWeek);
    for (const block of allBlocks(plan)) {
      const required = block.exercise.equipment.filter((e) => e !== "none");
      expect(required).toHaveLength(0);
    }
  });
});
