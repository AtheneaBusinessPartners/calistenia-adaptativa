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
