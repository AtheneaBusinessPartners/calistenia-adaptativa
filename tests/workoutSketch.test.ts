import { describe, expect, it } from "vitest";
import { assembleWorkoutSketch } from "../src/engine/workoutSketch.js";
import { rankExercises } from "../src/engine/exerciseSelector.js";
import { EXERCISES, EXERCISES_BY_ID } from "../src/data/exercises.js";
import { SKILLS_BY_ID } from "../src/data/skills.js";
import { computeCapabilityProfile } from "../src/engine/capabilityProfile.js";
import { evaluateSkillGate } from "../src/engine/skillGate.js";
import type { AssessmentEntry, UserProfile } from "../src/engine/types.js";

// Mismos datos que el escenario de §40 del brief.
const profile: UserProfile = {
  age: 25,
  sex: "other",
  heightCm: 180,
  weightKg: 75,
  trainingExperienceYears: 2,
  calisthenicsExperience: "intermediate",
  sleepHoursAvg: 7,
  activityLevel: "moderate",
  goals: ["specific_skill", "strength", "muscle_mass"],
  primaryGoal: "specific_skill",
  primarySkillTarget: "muscle_up",
  daysPerWeek: 4,
  sessionDurationMinutes: 45,
  minSessionDurationMinutes: 20,
  equipment: ["pullup_bar", "parallettes"],
};

const assessment: AssessmentEntry[] = [
  { exerciseId: "pull_up", reps: 7 },
  { exerciseId: "push_up", reps: 12 },
  { exerciseId: "straight_bar_dip", reps: 10 },
  { exerciseId: "hollow_body_hold", seconds: 30 },
  { exerciseId: "freestanding_handstand_hold", seconds: 60 },
  { exerciseId: "chest_to_bar_pull_up", reps: 0 },
];

const capabilityProfile = computeCapabilityProfile(assessment, EXERCISES_BY_ID);
const targetSkill = SKILLS_BY_ID["muscle_up"]!;
const gate = evaluateSkillGate(targetSkill, assessment, capabilityProfile);
const ranked = rankExercises(EXERCISES, { user: { profile, assessment, capabilityProfile }, targetSkill, limitations: gate.limitations });

describe("assembleWorkoutSketch — duración flexible (§19)", () => {
  it("una sesión muy corta (10 min) siempre incluye al menos un bloque", () => {
    const w = assembleWorkoutSketch(ranked, EXERCISES_BY_ID, 10);
    expect(w.length).toBeGreaterThanOrEqual(1);
  });

  it("una sesión de 20 min nunca tiene más bloques que una de 90 min", () => {
    const short = assembleWorkoutSketch(ranked, EXERCISES_BY_ID, 20);
    const long = assembleWorkoutSketch(ranked, EXERCISES_BY_ID, 90);
    expect(short.length).toBeLessThanOrEqual(long.length);
  });

  it("con más tiempo se amplían las series de fuerza secundaria, no solo el número de bloques", () => {
    const short = assembleWorkoutSketch(ranked, EXERCISES_BY_ID, 45);
    const long = assembleWorkoutSketch(ranked, EXERCISES_BY_ID, 90);
    const secondaryShort = short.find((b) => b.block === "Fuerza secundaria");
    const secondaryLong = long.find((b) => b.block === "Fuerza secundaria");
    expect(secondaryShort).toBeDefined();
    expect(secondaryLong).toBeDefined();
    expect(secondaryLong!.sets).toBeGreaterThan(secondaryShort!.sets);
  });

  it("respeta el orden de prioridad: el primer bloque es el ejercicio de mayor prioridad real (chest-to-bar)", () => {
    const w = assembleWorkoutSketch(ranked, EXERCISES_BY_ID, 45);
    expect(w[0]?.exercise.id).toBe("chest_to_bar_pull_up");
  });

  it("no mete el ejercicio final de la skill objetivo como bloque de técnica si no está a su alcance", () => {
    const w = assembleWorkoutSketch(ranked, EXERCISES_BY_ID, 45);
    const skillBlock = w.find((b) => b.block === "Skill / técnica");
    expect(skillBlock?.exercise.id).not.toBe("muscle_up");
  });
});
