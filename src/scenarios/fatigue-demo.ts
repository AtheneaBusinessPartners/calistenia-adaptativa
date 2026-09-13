import { computeCapabilityProfile } from "../engine/capabilityProfile.js";
import { evaluateSkillGate } from "../engine/skillGate.js";
import type { SelectorContext } from "../engine/exerciseSelector.js";
import { generateWeeklyPlan } from "../engine/weeklyPlan.js";
import { computeMuscleFatigue } from "../engine/fatigueEngine.js";
import { applyCheckInToFatigue, checkInSafetyMessage } from "../engine/checkIn.js";
import { explainFatigueImpact } from "../engine/fatigueExplanation.js";
import { applyDeloadWeek, shouldRecommendDeloadWeek } from "../engine/deloadWeek.js";
import { EXERCISES, EXERCISES_BY_ID } from "../data/exercises.js";
import { SKILLS_BY_ID } from "../data/skills.js";
import type { AssessmentEntry, CheckIn, TrainingDay, UserProfile } from "../engine/types.js";
import type { SessionLogEntry } from "../engine/progression.js";

const profile: UserProfile = {
  age: 25,
  sex: "other",
  heightCm: 180,
  weightKg: 75,
  trainingExperienceYears: 2,
  calisthenicsExperience: "intermediate",
  sleepHoursAvg: 6,
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

function section(title: string) {
  console.log(`\n${title.toUpperCase()}`);
  console.log("-".repeat(60));
}

const capabilityProfile = computeCapabilityProfile(assessment, EXERCISES_BY_ID);
const targetSkill = SKILLS_BY_ID["muscle_up"]!;
const gate = evaluateSkillGate(targetSkill, assessment, capabilityProfile);
const ctx: SelectorContext = { user: { profile, assessment, capabilityProfile }, targetSkill, limitations: gate.limitations };

// ==== §16 del brief: "Pull day" con fatiga alta de espalda/bíceps ====
section('Ejemplo del brief §16: "hemos reducido el trabajo de tirón..."');
const preFatiguedLog: TrainingDay[] = [
  { daysAgo: 0, exercises: [{ exerciseId: "pull_up", sets: 6, reps: 8, rir: 0 }] },
  { daysAgo: 1, exercises: [{ exerciseId: "chest_to_bar_pull_up", sets: 6, reps: 5, rir: 0 }] },
  { daysAgo: 2, exercises: [{ exerciseId: "explosive_pull_up", sets: 5, reps: 5, rir: 0 }] },
];
const objectiveFatigue = computeMuscleFatigue(preFatiguedLog, EXERCISES_BY_ID);
console.log("Fatiga objetiva (por historial real):", objectiveFatigue);

const explanation = explainFatigueImpact(EXERCISES, ctx, objectiveFatigue, EXERCISES_BY_ID, profile.sessionDurationMinutes);
console.log(explanation.changed ? explanation.message : "(la fatiga no fue suficiente para cambiar la sesión)");

const plan = generateWeeklyPlan(EXERCISES, ctx, EXERCISES_BY_ID, profile.sessionDurationMinutes, 4, { trainingLog: preFatiguedLog });
console.log(`\nDía 1 con esa fatiga: ${plan.days[0]!.blocks.map((b) => `[${b.block}] ${b.exercise.name}`).join(" | ")}`);

// ==== §15 del brief: check-in y diferencia fatiga vs dolor ====
section("Check-in antes de entrenar (§15): percepción subjetiva + dolor real");
const checkIn: CheckIn = {
  feeling: "tired",
  sleepQuality: "poor",
  stress: "medium",
  motivation: "medium",
  fatigueZones: ["lats"],
  painZones: ["lower_back"],
  painSeverity: "moderate",
};
const adjustedFatigue = applyCheckInToFatigue(objectiveFatigue, checkIn);
console.log("Fatiga ajustada por el check-in:", adjustedFatigue);
const safety = checkInSafetyMessage(checkIn);
console.log(`Aviso de seguridad: ${safety.shouldWarn ? safety.message : "(ninguno)"}`);
console.log("(El dolor en lower_back NO entra en la fatiga: va a painZones, gate duro en exerciseSelector.ts)");

// ==== §24 del brief: detección de semana de descarga ====
section("Semana de descarga (§24): señal agregada, no solo un ejercicio suelto");
const heavyWeekLog: TrainingDay[] = Array.from({ length: 4 }, (_, i) => ({
  daysAgo: i,
  exercises: [
    { exerciseId: "pull_up", sets: 8, reps: 8, rir: 0 },
    { exerciseId: "straight_bar_dip", sets: 8, reps: 10, rir: 0 },
    { exerciseId: "bodyweight_squat", sets: 8, reps: 15, rir: 0 },
    { exerciseId: "nordic_curl", sets: 8, reps: 5, rir: 0 },
  ],
}));
const decliningHistory: SessionLogEntry[] = [
  { reps: 8, rir: 0, techniqueOk: true },
  { reps: 7, rir: 0, techniqueOk: true },
  { reps: 6, rir: 0, techniqueOk: true },
];
const deloadSignal = shouldRecommendDeloadWeek({
  trainingLog: heavyWeekLog,
  exercisesById: EXERCISES_BY_ID,
  exercisesInProgress: [
    { exercise: EXERCISES_BY_ID["pull_up"]!, history: decliningHistory },
    { exercise: EXERCISES_BY_ID["straight_bar_dip"]!, history: decliningHistory },
  ],
  recentCheckIns: [checkIn, checkIn],
});
console.log(`¿Recomendar semana de descarga? ${deloadSignal.recommend ? "SÍ" : "no"}`);
deloadSignal.reasons.forEach((r) => console.log(`  - ${r}`));

if (deloadSignal.recommend) {
  const normalPlan = generateWeeklyPlan(EXERCISES, ctx, EXERCISES_BY_ID, profile.sessionDurationMinutes, 4);
  const deloadPlan = applyDeloadWeek(normalPlan);
  const normalMain = normalPlan.days[0]!.blocks.find((b) => b.block === "Fuerza principal")!;
  const deloadMain = deloadPlan.days[0]!.blocks.find((b) => b.block === "Fuerza principal")!;
  console.log(`\nSemana normal: ${normalMain.exercise.name} — ${normalMain.sets} series`);
  console.log(`Semana de descarga: ${deloadMain.exercise.name} — ${deloadMain.sets} series (mismo ejercicio, menos volumen)`);
}
