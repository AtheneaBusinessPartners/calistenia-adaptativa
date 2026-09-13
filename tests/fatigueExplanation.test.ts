import { describe, expect, it } from "vitest";
import { explainFatigueImpact } from "../src/engine/fatigueExplanation.js";
import type { SelectorContext } from "../src/engine/exerciseSelector.js";
import { computeCapabilityProfile } from "../src/engine/capabilityProfile.js";
import { evaluateSkillGate } from "../src/engine/skillGate.js";
import { computeMuscleFatigue } from "../src/engine/fatigueEngine.js";
import { EXERCISES, EXERCISES_BY_ID } from "../src/data/exercises.js";
import { SKILLS_BY_ID } from "../src/data/skills.js";
import type { AssessmentEntry, TrainingDay, UserProfile } from "../src/engine/types.js";

const profile: UserProfile = {
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
  equipment: ["pullup_bar", "parallettes"],
};

const assessment: AssessmentEntry[] = [
  { exerciseId: "pull_up", reps: 7 },
  { exerciseId: "straight_bar_dip", reps: 10 },
  { exerciseId: "chest_to_bar_pull_up", reps: 0 },
];
const capabilityProfile = computeCapabilityProfile(assessment, EXERCISES_BY_ID);
const targetSkill = SKILLS_BY_ID["muscle_up"]!;
const gate = evaluateSkillGate(targetSkill, assessment, capabilityProfile);
const ctx: SelectorContext = { user: { profile, assessment, capabilityProfile }, targetSkill, limitations: gate.limitations };

describe("explainFatigueImpact (§16 del brief)", () => {
  it("sin fatiga, no hay cambio que explicar", () => {
    const result = explainFatigueImpact(EXERCISES, ctx, {}, EXERCISES_BY_ID, profile.sessionDurationMinutes);
    expect(result.changed).toBe(false);
    expect(result.message).toBeUndefined();
  });

  it("con fatiga alta de tirón, explica el cambio nombrando los músculos concretos, no una plantilla genérica", () => {
    const preFatiguedLog: TrainingDay[] = [
      { daysAgo: 0, exercises: [{ exerciseId: "pull_up", sets: 6, reps: 8, rir: 0 }] },
      { daysAgo: 1, exercises: [{ exerciseId: "chest_to_bar_pull_up", sets: 6, reps: 5, rir: 0 }] },
    ];
    const fatigueByMuscle = computeMuscleFatigue(preFatiguedLog, EXERCISES_BY_ID);

    const result = explainFatigueImpact(EXERCISES, ctx, fatigueByMuscle, EXERCISES_BY_ID, profile.sessionDurationMinutes);

    expect(result.changed).toBe(true);
    expect(result.message).toContain("tirón");
    expect(result.message).toMatch(/Dorsal ancho|Bíceps/);
  });
});
