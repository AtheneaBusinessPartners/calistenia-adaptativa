import type { AssessmentEntry, TrainingDay, UserProfile } from "../engine/types.js";
import { computeCapabilityProfile } from "../engine/capabilityProfile.js";
import { evaluateSkillGate } from "../engine/skillGate.js";
import type { SelectorContext } from "../engine/exerciseSelector.js";
import { generateWeeklyPlan, type DayPlan } from "../engine/weeklyPlan.js";
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

function printDay(label: string, blocks: DayPlan["blocks"]) {
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
const ctx: SelectorContext = { user: { profile, assessment, capabilityProfile }, targetSkill, limitations: gate.limitations };

// ==== Semana 1: sin historial todavía ====
section("Semana 1 (sin historial): el plan usa el volumen estático de cada ficha");
const week1 = generateWeeklyPlan(EXERCISES, ctx, EXERCISES_BY_ID, profile.sessionDurationMinutes, 4);
printDay(`Día 1 (${week1.days[0]!.focusLabel})`, week1.days[0]!.blocks);

// Simulamos que el usuario entrena esa "Fuerza principal" (chest-to-bar,
// empezando en 0) durante varias sesiones, registrando lo conseguido.
const history: Record<string, SessionLogEntry[]> = {};
let trackedExerciseId = week1.days[0]!.blocks.find((b) => b.block === "Fuerza principal")!.exercise.id;
history[trackedExerciseId] = [{ reps: 0, rir: 2, techniqueOk: true }];

// ==== Semanas 2-4: el plan ya usa la prescripción real, sesión a sesión ====
for (let week = 2; week <= 4; week++) {
  section(`Semana ${week}: el plan YA refleja el historial real, no el rango estático`);
  const plan = generateWeeklyPlan(EXERCISES, ctx, EXERCISES_BY_ID, profile.sessionDurationMinutes, 4, { historyByExercise: history });
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
const planBefore = generateWeeklyPlan(EXERCISES, ctx, EXERCISES_BY_ID, profile.sessionDurationMinutes, 4, { historyByExercise: history });
const planAfter = generateWeeklyPlan(EXERCISES, ctx, EXERCISES_BY_ID, profile.sessionDurationMinutes, 3, { historyByExercise: history });
const mainBefore = planBefore.days[0]!.blocks.find((b) => b.block === "Fuerza principal")!;
const mainAfter = planAfter.days[0]!.blocks.find((b) => b.block === "Fuerza principal")!;
console.log(`Antes (4 días): ${mainBefore.exercise.name} — prescripción: ${JSON.stringify(mainBefore.prescription)}`);
console.log(`Después (3 días): ${mainAfter.exercise.name} — prescripción: ${JSON.stringify(mainAfter.prescription)}`);
console.log(
  mainBefore.exercise.id === mainAfter.exercise.id && JSON.stringify(mainBefore.prescription) === JSON.stringify(mainAfter.prescription)
    ? "-> Idéntico: reorganizar días no altera la progresión en curso."
    : "-> ATENCIÓN: la reorganización cambió la progresión (no debería).",
);

// ==== FASE 3: fatiga real evolucionando dentro de la semana (§14-16) ====
section("FASE 3: la fatiga real de esta semana redirige los días, sin reglas de 'evitar patrón'");
const freshPlan = generateWeeklyPlan(EXERCISES, ctx, EXERCISES_BY_ID, profile.sessionDurationMinutes, 4);
for (const day of freshPlan.days) {
  const topFatigue = Object.entries(day.fatigueByMuscle)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([m, v]) => `${m}=${v}`)
    .join(", ");
  console.log(`\nDía ${day.dayIndex + 1} (${day.focusLabel}) — fatiga al empezar: ${topFatigue || "(ninguna)"}`);
  for (const item of day.blocks) {
    console.log(`  [${item.block}] ${item.exercise.name} (${item.exercise.movementPattern})`);
  }
}

// ==== Caso del brief (§16): fatiga alta de espalda/bíceps ya ANTES de empezar la semana ====
section('Caso del brief §16: "reducimos el trabajo de tirón porque tu fatiga de espalda y bíceps es alta"');
const preFatiguedLog: TrainingDay[] = [
  { daysAgo: 0, exercises: [{ exerciseId: "pull_up", sets: 5, reps: 8, rir: 0 }] },
  { daysAgo: 1, exercises: [{ exerciseId: "chest_to_bar_pull_up", sets: 5, reps: 5, rir: 0 }] },
];
const fatiguedPlan = generateWeeklyPlan(EXERCISES, ctx, EXERCISES_BY_ID, profile.sessionDurationMinutes, 4, { trainingLog: preFatiguedLog });
const day0 = fatiguedPlan.days[0]!;
console.log(`Fatiga con la que arranca la semana: lats=${day0.fatigueByMuscle["lats"] ?? 0}, biceps=${day0.fatigueByMuscle["biceps"] ?? 0}`);
printDay(`Día 1 (${day0.focusLabel})`, day0.blocks);
