import { describe, expect, it } from "vitest";
import { applyDeloadWeek, shouldRecommendDeloadWeek } from "../src/engine/deloadWeek.js";
import { generateWeeklyPlan } from "../src/engine/weeklyPlan.js";
import { computeCapabilityProfile } from "../src/engine/capabilityProfile.js";
import { evaluateSkillGate } from "../src/engine/skillGate.js";
import type { SelectorContext } from "../src/engine/exerciseSelector.js";
import { EXERCISES, EXERCISES_BY_ID } from "../src/data/exercises.js";
import { SKILLS_BY_ID } from "../src/data/skills.js";
import type { AssessmentEntry, CheckIn, TrainingDay, UserProfile } from "../src/engine/types.js";
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
  goals: ["specific_skill"],
  primaryGoal: "specific_skill",
  primarySkillTarget: "muscle_up",
  daysPerWeek: 4,
  sessionDurationMinutes: 45,
  minSessionDurationMinutes: 20,
  equipment: ["pullup_bar", "parallettes"],
};

const assessment: AssessmentEntry[] = [{ exerciseId: "pull_up", reps: 7 }];
const capabilityProfile = computeCapabilityProfile(assessment, EXERCISES_BY_ID);
const targetSkill = SKILLS_BY_ID["muscle_up"]!;
const gate = evaluateSkillGate(targetSkill, assessment, capabilityProfile);
const ctx: SelectorContext = { user: { profile, assessment, capabilityProfile }, targetSkill, limitations: gate.limitations };

describe("shouldRecommendDeloadWeek (§24 del brief)", () => {
  it("sin ninguna señal, no recomienda descarga", () => {
    const signal = shouldRecommendDeloadWeek({
      trainingLog: [],
      exercisesById: EXERCISES_BY_ID,
      exercisesInProgress: [],
    });
    expect(signal.recommend).toBe(false);
    expect(signal.reasons).toHaveLength(0);
  });

  it("fatiga sostenida y alta en grupos musculares grandes recomienda descarga", () => {
    // Estimula los 4 grupos grandes (lats, chest, quads, hamstrings) — con
    // solo 2 de ellos, la media de los 4 se queda corta aunque esos 2 estén
    // muy fatigados: la señal es deliberadamente "fatiga en TODO lo grande",
    // no solo en una zona.
    const heavyLog: TrainingDay[] = Array.from({ length: 4 }, (_, i) => ({
      daysAgo: i,
      exercises: [
        { exerciseId: "pull_up", sets: 8, reps: 8, rir: 0 }, // lats
        { exerciseId: "straight_bar_dip", sets: 8, reps: 10, rir: 0 }, // chest
        { exerciseId: "bodyweight_squat", sets: 8, reps: 15, rir: 0 }, // quads
        { exerciseId: "nordic_curl", sets: 8, reps: 5, rir: 0 }, // hamstrings
      ],
    }));
    const signal = shouldRecommendDeloadWeek({
      trainingLog: heavyLog,
      exercisesById: EXERCISES_BY_ID,
      exercisesInProgress: [],
    });
    expect(signal.recommend).toBe(true);
    expect(signal.reasons.some((r) => r.includes("Fatiga de"))).toBe(true);
  });

  it("un solo grupo grande muy fatigado ya recomienda descarga, aunque el resto de grupos grandes estén frescos (no se diluye promediando)", () => {
    // Split de tirón puro: solo lats/chest cargados a fondo, piernas
    // intactas. La media de los 4 grupos se quedaría corta; el máximo no.
    const pullOnlyLog: TrainingDay[] = Array.from({ length: 4 }, (_, i) => ({
      daysAgo: i,
      exercises: [
        { exerciseId: "pull_up", sets: 6, reps: 9, rir: 0 },
        { exerciseId: "straight_bar_dip", sets: 6, reps: 11, rir: 0 },
      ],
    }));
    const signal = shouldRecommendDeloadWeek({
      trainingLog: pullOnlyLog,
      exercisesById: EXERCISES_BY_ID,
      exercisesInProgress: [],
    });
    expect(signal.recommend).toBe(true);
    expect(signal.reasons.some((r) => r.includes("Pectoral") || r.includes("Dorsal ancho"))).toBe(true);
  });

  it("una semana normal y sostenible (RIR moderado, volumen moderado) NO recomienda descarga", () => {
    const normalWeek: TrainingDay[] = [
      { daysAgo: 0, exercises: [{ exerciseId: "pull_up", sets: 4, reps: 8, rir: 2 }] },
      { daysAgo: 1, exercises: [{ exerciseId: "bodyweight_squat", sets: 4, reps: 15, rir: 2 }] },
      { daysAgo: 2, exercises: [{ exerciseId: "straight_bar_dip", sets: 4, reps: 10, rir: 2 }] },
      { daysAgo: 3, exercises: [{ exerciseId: "bodyweight_squat", sets: 4, reps: 15, rir: 2 }] },
    ];
    const signal = shouldRecommendDeloadWeek({
      trainingLog: normalWeek,
      exercisesById: EXERCISES_BY_ID,
      exercisesInProgress: [],
    });
    expect(signal.recommend).toBe(false);
  });

  it("varios ejercicios en DELOAD_CANDIDATE a la vez recomienda descarga (señal global, no solo local)", () => {
    const decliningHistory: SessionLogEntry[] = [
      { reps: 8, rir: 0, techniqueOk: true },
      { reps: 7, rir: 0, techniqueOk: true },
      { reps: 6, rir: 0, techniqueOk: true },
    ];
    const signal = shouldRecommendDeloadWeek({
      trainingLog: [],
      exercisesById: EXERCISES_BY_ID,
      exercisesInProgress: [
        { exercise: EXERCISES_BY_ID["pull_up"]!, history: decliningHistory },
        { exercise: EXERCISES_BY_ID["straight_bar_dip"]!, history: decliningHistory },
      ],
    });
    expect(signal.recommend).toBe(true);
    expect(signal.reasons.some((r) => r.includes("rendimiento en caída"))).toBe(true);
  });

  it("sueño deficiente reportado repetidamente recomienda descarga", () => {
    const poorSleepCheckIns: CheckIn[] = [
      { feeling: "tired", sleepQuality: "poor", stress: "medium", motivation: "medium" },
      { feeling: "tired", sleepQuality: "poor", stress: "medium", motivation: "medium" },
    ];
    const signal = shouldRecommendDeloadWeek({
      trainingLog: [],
      exercisesById: EXERCISES_BY_ID,
      exercisesInProgress: [],
      recentCheckIns: poorSleepCheckIns,
    });
    expect(signal.recommend).toBe(true);
    expect(signal.reasons.some((r) => r.includes("Sueño"))).toBe(true);
  });
});

describe("applyDeloadWeek", () => {
  it("reduce las series de todos los bloques de todos los días sin cambiar los ejercicios elegidos", () => {
    const plan = generateWeeklyPlan(EXERCISES, ctx, EXERCISES_BY_ID, profile.sessionDurationMinutes, 4);
    const deloaded = applyDeloadWeek(plan);

    for (let d = 0; d < plan.days.length; d++) {
      for (let b = 0; b < plan.days[d]!.blocks.length; b++) {
        const original = plan.days[d]!.blocks[b]!;
        const reduced = deloaded.days[d]!.blocks[b]!;
        expect(reduced.exercise.id).toBe(original.exercise.id);
        expect(reduced.sets).toBeLessThanOrEqual(original.sets);
        expect(reduced.sets).toBeGreaterThanOrEqual(1);
      }
    }
  });
});
