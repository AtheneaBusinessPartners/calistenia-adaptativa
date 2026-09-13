import type { AssessmentEntry, UserProfile } from "../engine/types.js";
import { computeCapabilityProfile } from "../engine/capabilityProfile.js";
import { evaluateSkillGate } from "../engine/skillGate.js";
import { rankExercises } from "../engine/exerciseSelector.js";
import { generateWeeklyPlan } from "../engine/weeklyPlan.js";
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

function printDay(label: string, blocks: ReturnType<typeof generateWeeklyPlan>["days"][number]["blocks"]) {
  console.log(`\n${label}:`);
  for (const item of blocks) {
    const target = item.prescription
      ? item.prescription.targetReps !== undefined
        ? `${item.sets}x${item.prescription.targetReps} reps`
        : `${item.sets}x${item.prescription.targetSeconds}s`
      : `${item.sets}x${item.exercise.recommendedReps ?? item.exercise.recommendedTime ?? "?"} (estático, sin historial)`;
    const note = item.prescription ? ` — ${item.prescription.note}` : "";
    console.log(`  [${item.block}] ${item.exercise.name}: ${target}${note}`);
  }
}

const capabilityProfile = computeCapabilityProfile(assessment, EXERCISES_BY_ID);
const targetSkill = SKILLS_BY_ID["muscle_up"]!;
const gate = evaluateSkillGate(targetSkill, assessment, capabilityProfile);
const ranked = rankExercises(EXERCISES, { user: { profile, assessment, capabilityProfile }, targetSkill, limitations: gate.limitations });

// ==== Semana 1: sin historial todavía ====
section("Semana 1 (sin historial): el plan usa el volumen estático de cada ficha");
const week1 = generateWeeklyPlan(ranked, EXERCISES_BY_ID, profile.sessionDurationMinutes, 4);
printDay(`Día 1 (${week1.days[0]!.focusLabel})`, week1.days[0]!.blocks);

// Simulamos que el usuario entrena esa "Fuerza principal" (chest-to-bar,
// empezando en 0) durante varias sesiones, registrando lo conseguido.
const history: Record<string, SessionLogEntry[]> = {};
let trackedExerciseId = week1.days[0]!.blocks.find((b) => b.block === "Fuerza principal")!.exercise.id;
history[trackedExerciseId] = [{ reps: 0, rir: 2, techniqueOk: true }];

// ==== Semanas 2-4: el plan ya usa la prescripción real, sesión a sesión ====
for (let week = 2; week <= 4; week++) {
  section(`Semana ${week}: el plan YA refleja el historial real, no el rango estático`);
  const plan = generateWeeklyPlan(ranked, EXERCISES_BY_ID, profile.sessionDurationMinutes, 4, history);
  const day0 = plan.days[0]!;
  printDay(`Día 1 (${day0.focusLabel})`, day0.blocks);

  // El usuario cumple lo prescrito esta semana; se registra para la siguiente.
  const mainBlock = day0.blocks.find((b) => b.block === "Fuerza principal")!;
  const achievedReps = mainBlock.prescription?.targetReps ?? 0;
  if (mainBlock.exercise.id !== trackedExerciseId) {
    // planNextSession decidió avanzar de línea: el historial es del ejercicio nuevo.
    trackedExerciseId = mainBlock.exercise.id;
    history[trackedExerciseId] = [];
  }
  history[trackedExerciseId]!.push({ reps: achievedReps, rir: 2, techniqueOk: true });
}

// ==== Reorganización por disponibilidad (§20) ====
section("Reorganización: de 4 a 3 días/semana a mitad de la progresión");
const planBefore = generateWeeklyPlan(ranked, EXERCISES_BY_ID, profile.sessionDurationMinutes, 4, history);
const planAfter = generateWeeklyPlan(ranked, EXERCISES_BY_ID, profile.sessionDurationMinutes, 3, history);
const mainBefore = planBefore.days[0]!.blocks.find((b) => b.block === "Fuerza principal")!;
const mainAfter = planAfter.days[0]!.blocks.find((b) => b.block === "Fuerza principal")!;
console.log(`Antes (4 días): ${mainBefore.exercise.name} — prescripción: ${JSON.stringify(mainBefore.prescription)}`);
console.log(`Después (3 días): ${mainAfter.exercise.name} — prescripción: ${JSON.stringify(mainAfter.prescription)}`);
console.log(
  mainBefore.exercise.id === mainAfter.exercise.id && JSON.stringify(mainBefore.prescription) === JSON.stringify(mainAfter.prescription)
    ? "-> Idéntico: reorganizar días no altera la progresión en curso."
    : "-> ATENCIÓN: la reorganización cambió la progresión (no debería).",
);
