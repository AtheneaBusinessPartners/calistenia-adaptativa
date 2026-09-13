import type { AssessmentEntry, UserProfile } from "../engine/types.js";
import { computeCapabilityProfile } from "../engine/capabilityProfile.js";
import { evaluateSkillGate } from "../engine/skillGate.js";
import { rankExercises } from "../engine/exerciseSelector.js";
import { generateWeeklyPlan } from "../engine/weeklyPlan.js";
import { planNextSession } from "../engine/sessionPlanner.js";
import type { SessionLogEntry } from "../engine/progression.js";
import { EXERCISES, EXERCISES_BY_ID } from "../data/exercises.js";
import { SKILLS_BY_ID } from "../data/skills.js";

// Mismo usuario ficticio que src/scenarios/muscleup-user.ts (§40 del brief).
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

function section(title: string) {
  console.log(`\n${title.toUpperCase()}`);
  console.log("-".repeat(60));
}

const capabilityProfile = computeCapabilityProfile(assessment, EXERCISES_BY_ID);
const targetSkill = SKILLS_BY_ID["muscle_up"]!;
const gate = evaluateSkillGate(targetSkill, assessment, capabilityProfile);
const ranked = rankExercises(EXERCISES, { user: { profile, assessment, capabilityProfile }, targetSkill, limitations: gate.limitations });

// ==== 1. Plan semanal de 4 días ====
section("Plan semanal — 4 días/semana");
const plan4 = generateWeeklyPlan(ranked, EXERCISES_BY_ID, profile.sessionDurationMinutes, 4);
for (const day of plan4.days) {
  console.log(`\nDía ${day.dayIndex + 1} (${day.focusLabel}):`);
  for (const item of day.blocks) {
    console.log(`  [${item.block}] ${item.exercise.name} (${item.exercise.movementPattern})`);
  }
}

// ==== 2. Progresión sesión a sesión del ejercicio limitante ====
section("Progresión sesión a sesión — Chest-to-bar (limitación #1)");
const chestToBar = EXERCISES_BY_ID["chest_to_bar_pull_up"]!;
const history: SessionLogEntry[] = [];
let currentExerciseId = chestToBar.id;
let reps = 0; // empieza en 0, tal como el assessment inicial
for (let session = 1; session <= 6; session++) {
  const exercise = EXERCISES_BY_ID[currentExerciseId]!;
  history.push({ reps, rir: 2, techniqueOk: true });
  const prescription = planNextSession(exercise, history, EXERCISES_BY_ID);
  console.log(`Sesión ${session}: ${exercise.name} hizo ${reps} reps -> siguiente: ${prescription.note}`);
  if (prescription.exerciseId !== currentExerciseId) {
    currentExerciseId = prescription.exerciseId;
    history.length = 0; // nuevo ejercicio, historial propio
  }
  reps = prescription.targetReps ?? reps;
}

// ==== 3. Reorganización por disponibilidad ====
section("Reorganización: de 4 a 3 días/semana (§20)");
const plan3 = generateWeeklyPlan(ranked, EXERCISES_BY_ID, profile.sessionDurationMinutes, 3);
console.log(`Plan de 4 días tenía ${plan4.days.length} sesiones; el reorganizado tiene ${plan3.days.length}.`);
const pullUpHistory: SessionLogEntry[] = [{ reps: 6, rir: 2, techniqueOk: true }];
const before = planNextSession(EXERCISES_BY_ID["pull_up"]!, pullUpHistory, EXERCISES_BY_ID);
console.log(
  `Prescripción para "Dominada" es idéntica antes y después de reorganizar (no depende del nº de días): ${before.note}`,
);
