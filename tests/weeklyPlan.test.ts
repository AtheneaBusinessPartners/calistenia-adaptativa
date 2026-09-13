import { describe, expect, it } from "vitest";
import { generateWeeklyPlan } from "../src/engine/weeklyPlan.js";
import { planNextSession } from "../src/engine/sessionPlanner.js";
import { rankExercises } from "../src/engine/exerciseSelector.js";
import { EXERCISES, EXERCISES_BY_ID } from "../src/data/exercises.js";
import { SKILLS_BY_ID } from "../src/data/skills.js";
import { computeCapabilityProfile } from "../src/engine/capabilityProfile.js";
import { evaluateSkillGate } from "../src/engine/skillGate.js";
import type { AssessmentEntry, UserProfile } from "../src/engine/types.js";
import type { SessionLogEntry } from "../src/engine/progression.js";

const profile: UserProfile = {
  age: 25,
  sex: "other",
  heightCm: 180,
  weightKg: 75,
  trainingExperienceYears: 2,
  calisthenicsExperience: "intermediate",
  sleepHoursAvg: 7,
  activityLevel: "moderate",
  goals: ["specific_skill", "strength"],
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

describe("generateWeeklyPlan (§20)", () => {
  it("genera un día por cada día de la plantilla (4 días/semana)", () => {
    const plan = generateWeeklyPlan(ranked, EXERCISES_BY_ID, profile.sessionDurationMinutes, 4);
    expect(plan.days).toHaveLength(4);
  });

  it("los días 'priority_focus' comparten el mismo foco principal (la limitación real), los 'complementary' evitan repetir su patrón de movimiento", () => {
    const plan = generateWeeklyPlan(ranked, EXERCISES_BY_ID, profile.sessionDurationMinutes, 4);
    const day0Main = plan.days[0]?.blocks.find((b) => b.block === "Fuerza principal");
    const day1Main = plan.days[1]?.blocks.find((b) => b.block === "Fuerza principal");
    expect(plan.days[0]?.archetype).toBe("priority_focus");
    expect(plan.days[1]?.archetype).toBe("complementary");
    expect(day0Main).toBeDefined();
    expect(day1Main).toBeDefined();
    expect(day1Main!.exercise.movementPattern).not.toBe(day0Main!.exercise.movementPattern);
  });

  it("clampa un número de días fuera de 2-6 en vez de fallar", () => {
    const plan = generateWeeklyPlan(ranked, EXERCISES_BY_ID, profile.sessionDurationMinutes, 10);
    expect(plan.days).toHaveLength(6);
  });
});

describe("reorganización por disponibilidad (§20): no destruye la progresión", () => {
  it("planNextSession para un ejercicio da la misma prescripción independientemente de a cuántos días se reorganice la semana", () => {
    const history: SessionLogEntry[] = [{ reps: 5, rir: 2, techniqueOk: true }];
    const exercise = EXERCISES_BY_ID["pull_up"]!;

    // Generar planes de 4 y de 3 días no debe tocar el historial de este
    // ejercicio en absoluto — el historial vive aparte, por ejercicio.
    generateWeeklyPlan(ranked, EXERCISES_BY_ID, profile.sessionDurationMinutes, 4);
    const prescriptionAt4Days = planNextSession(exercise, history, EXERCISES_BY_ID);

    generateWeeklyPlan(ranked, EXERCISES_BY_ID, profile.sessionDurationMinutes, 3);
    const prescriptionAt3Days = planNextSession(exercise, history, EXERCISES_BY_ID);

    expect(prescriptionAt3Days).toEqual(prescriptionAt4Days);
  });
});
