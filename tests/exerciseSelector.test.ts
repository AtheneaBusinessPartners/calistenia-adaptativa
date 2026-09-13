import { describe, expect, it } from "vitest";
import { scoreExercise } from "../src/engine/exerciseSelector.js";
import { EXERCISES_BY_ID } from "../src/data/exercises.js";
import { SKILLS_BY_ID } from "../src/data/skills.js";
import { computeCapabilityProfile } from "../src/engine/capabilityProfile.js";
import { evaluateSkillGate } from "../src/engine/skillGate.js";
import type { AssessmentEntry, UserProfile } from "../src/engine/types.js";

const baseProfile: UserProfile = {
  age: 25,
  sex: "other",
  heightCm: 180,
  weightKg: 75,
  trainingExperienceYears: 2,
  calisthenicsExperience: "intermediate",
  sleepHoursAvg: 7,
  activityLevel: "moderate",
  goals: ["specific_skill"],
  primaryGoal: "specific_skill",
  primarySkillTarget: "muscle_up",
  daysPerWeek: 4,
  sessionDurationMinutes: 45,
  minSessionDurationMinutes: 20,
  equipment: ["pullup_bar", "parallettes"], // sin bandas, sin anillas
};

const assessment: AssessmentEntry[] = [{ exerciseId: "pull_up", reps: 7 }];
const capabilityProfile = computeCapabilityProfile(assessment, EXERCISES_BY_ID);
const targetSkill = SKILLS_BY_ID["muscle_up"]!;
const gate = evaluateSkillGate(targetSkill, assessment, capabilityProfile);

describe("gates duros (§29, §32): material y dolor anulan la puntuación, no la reducen", () => {
  it("descarta un ejercicio si falta el material requerido (anillas)", () => {
    const score = scoreExercise(EXERCISES_BY_ID["ring_muscle_up"]!, {
      user: { profile: baseProfile, assessment, capabilityProfile },
      targetSkill,
      limitations: gate.limitations,
    });
    expect(score.gated).toBe(true);
    expect(score.total).toBe(0);
  });

  it("no descarta un ejercicio de calistenia pura aunque falten anillas/bandas", () => {
    const score = scoreExercise(EXERCISES_BY_ID["pull_up"]!, {
      user: { profile: baseProfile, assessment, capabilityProfile },
      targetSkill,
      limitations: gate.limitations,
    });
    expect(score.gated).toBe(false);
  });

  it("descarta un ejercicio que trabaja una zona con dolor activo", () => {
    const score = scoreExercise(EXERCISES_BY_ID["pull_up"]!, {
      user: { profile: baseProfile, assessment, capabilityProfile, painZones: ["lats"] },
      targetSkill,
      limitations: gate.limitations,
    });
    expect(score.gated).toBe(true);
  });
});

describe("goalRelevance multi-objetivo (§31)", () => {
  it("un objetivo secundario de fuerza sube la relevancia de un ejercicio de fuerza, aunque el objetivo principal sea una skill", () => {
    const dip = EXERCISES_BY_ID["straight_bar_dip"]!;
    const onlySkill = scoreExercise(dip, {
      user: { profile: { ...baseProfile, goals: ["specific_skill"] }, assessment, capabilityProfile },
      targetSkill,
      limitations: gate.limitations,
    });
    const withStrength = scoreExercise(dip, {
      user: { profile: { ...baseProfile, goals: ["specific_skill", "strength"] }, assessment, capabilityProfile },
      targetSkill,
      limitations: gate.limitations,
    });
    expect(withStrength.goalRelevance).toBeGreaterThan(onlySkill.goalRelevance);
  });

  it("el objetivo principal pesa más que uno secundario más abajo en la lista", () => {
    const dip = EXERCISES_BY_ID["straight_bar_dip"]!;
    // "strength" como principal debería pesar más que como secundario de "mobility"
    const strengthPrimary = scoreExercise(dip, {
      user: { profile: { ...baseProfile, primaryGoal: "strength", goals: ["strength", "mobility"] }, assessment, capabilityProfile },
      targetSkill,
      limitations: gate.limitations,
    });
    const strengthSecondary = scoreExercise(dip, {
      user: { profile: { ...baseProfile, primaryGoal: "mobility", goals: ["mobility", "strength"] }, assessment, capabilityProfile },
      targetSkill,
      limitations: gate.limitations,
    });
    expect(strengthPrimary.goalRelevance).toBeGreaterThan(strengthSecondary.goalRelevance);
  });
});

describe("amortiguación por preparación (§30/§33): el movimiento final de una skill no debe rankear por delante de un paso intermedio apropiado solo por ser más 'relevante' en abstracto", () => {
  it("muscle-up puntúa por debajo de chest-to-bar, dominada explosiva y dominada cuando el usuario está lejos de esos requisitos", () => {
    // Mismo escenario que src/scenarios/muscleup-user.ts: 0 chest-to-bar, 0
    // dominada explosiva. Antes de este arreglo, muscle_up rankeaba #4
    // (por delante de casi todo salvo los 3 pasos intermedios más obvios)
    // solo porque desarrolla mucha capacidad "pull"/"explosiveness" en
    // abstracto — sin que importara que el usuario no puede ni intentarlo.
    const fullAssessment: AssessmentEntry[] = [
      { exerciseId: "pull_up", reps: 7 },
      { exerciseId: "straight_bar_dip", reps: 10 },
      { exerciseId: "chest_to_bar_pull_up", reps: 0 },
    ];
    const cp = computeCapabilityProfile(fullAssessment, EXERCISES_BY_ID);
    const g = evaluateSkillGate(targetSkill, fullAssessment, cp);
    const ctx = { user: { profile: baseProfile, assessment: fullAssessment, capabilityProfile: cp }, targetSkill, limitations: g.limitations };

    const muscleUpScore = scoreExercise(EXERCISES_BY_ID["muscle_up"]!, ctx).total;
    const chestToBarScore = scoreExercise(EXERCISES_BY_ID["chest_to_bar_pull_up"]!, ctx).total;
    const explosivePullUpScore = scoreExercise(EXERCISES_BY_ID["explosive_pull_up"]!, ctx).total;
    const pullUpScore = scoreExercise(EXERCISES_BY_ID["pull_up"]!, ctx).total;

    expect(muscleUpScore).toBeLessThan(chestToBarScore);
    expect(muscleUpScore).toBeLessThan(explosivePullUpScore);
    expect(muscleUpScore).toBeLessThan(pullUpScore);
  });

  it("front_lever_hold (el movimiento completo) puntúa por debajo de tuck_front_lever_hold cuando el usuario apenas ha empezado esa cadena", () => {
    const frontLeverSkill = SKILLS_BY_ID["front_lever"]!;
    const flAssessment: AssessmentEntry[] = [
      { exerciseId: "pull_up", reps: 10 },
      { exerciseId: "australian_row", reps: 5 },
      { exerciseId: "tuck_front_lever_hold", seconds: 3 },
    ];
    const flCapabilityProfile = computeCapabilityProfile(flAssessment, EXERCISES_BY_ID);
    const flGate = evaluateSkillGate(frontLeverSkill, flAssessment, flCapabilityProfile);
    const flProfile: UserProfile = {
      ...baseProfile,
      primarySkillTarget: "front_lever",
      equipment: ["pullup_bar", "parallettes", "rings", "bands"],
    };
    const ctx = {
      user: { profile: flProfile, assessment: flAssessment, capabilityProfile: flCapabilityProfile },
      targetSkill: frontLeverSkill,
      limitations: flGate.limitations,
    };

    const tuckScore = scoreExercise(EXERCISES_BY_ID["tuck_front_lever_hold"]!, ctx).total;
    const fullScore = scoreExercise(EXERCISES_BY_ID["front_lever_hold"]!, ctx).total;

    expect(tuckScore).toBeGreaterThan(fullScore);
  });
});
