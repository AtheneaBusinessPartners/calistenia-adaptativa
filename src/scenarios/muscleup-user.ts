import type { AssessmentEntry, UserProfile } from "../engine/types.js";
import { computeCapabilityProfile } from "../engine/capabilityProfile.js";
import { evaluateSkillGate, explainLimitation } from "../engine/skillGate.js";
import { rankExercises } from "../engine/exerciseSelector.js";
import { assembleWorkoutSketch } from "../engine/workoutSketch.js";
import { decideProgression } from "../engine/progression.js";
import { EXERCISES, EXERCISES_BY_ID } from "../data/exercises.js";
import { SKILLS, SKILLS_BY_ID } from "../data/skills.js";
import { CAPABILITIES } from "../data/capabilities.js";

// Usuario ficticio del brief (§40). age/sex/height/weight/sleep/activity no
// influyen todavía en ningún cálculo del motor de FASE 1 (perfil de
// capacidades, gate de skills, selector de ejercicios): son datos de
// onboarding (§3) que se reservan para módulos futuros (estándares de
// fuerza relativa, nutrición en FASE 5). sessionDurationMinutes no lo fija
// el brief para este usuario; se asume 45 min como sesión "normal" de 4
// días/semana.
const profile: UserProfile = {
  age: 25,
  sex: "other",
  heightCm: 180,
  weightKg: 75,
  trainingExperienceYears: 2,
  calisthenicsExperience: "intermediate",
  sleepHoursAvg: 7,
  activityLevel: "moderate",
  // Ejemplo de §31 del brief: varios objetivos con prioridad (1. muscle-up,
  // 2. ganar fuerza, 3. ganar masa muscular), no un único objetivo aislado.
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

function section(n: number, title: string) {
  console.log(`\n${n}. ${title.toUpperCase()}`);
  console.log("-".repeat(60));
}

// ---- Pipeline ----
const capabilityProfile = computeCapabilityProfile(assessment, EXERCISES_BY_ID);
const targetSkill = SKILLS_BY_ID["muscle_up"]!;
const gate = evaluateSkillGate(targetSkill, assessment, capabilityProfile);
const ranked = rankExercises(EXERCISES, { user: { profile, assessment, capabilityProfile }, targetSkill, limitations: gate.limitations });

// ==== 1. Perfil de capacidades ====
section(1, "Perfil de capacidades");
for (const cap of CAPABILITIES) {
  console.log(`${cap.name.padEnd(16)} ${String(capabilityProfile[cap.id]).padStart(3)}/100`);
}

// ==== 2. Skills actuales ====
section(2, "Skills actuales");
for (const skill of SKILLS) {
  const g = evaluateSkillGate(skill, assessment, capabilityProfile);
  const pct = Math.round(g.overallReadiness * 100);
  const status = pct >= 95 ? "MASTERED" : pct <= 2 ? "LOCKED (0%)" : `IN PROGRESS (${pct}%)`;
  console.log(`${skill.name.padEnd(24)} ${status}`);
}

// ==== 3. Objetivo ====
section(3, "Objetivo");
console.log(`Objetivo principal: ${targetSkill.name} (${targetSkill.description})`);

// ==== 4. Requisitos del objetivo ====
section(4, "Requisitos del objetivo (muscle-up)");
for (const status of gate.requirementStatuses) {
  console.log(`- ${status.requirement.label} (importancia ${status.requirement.importance})`);
}

// ==== 5. Requisitos cumplidos ====
section(5, "Requisitos cumplidos");
const met = gate.requirementStatuses.filter((s) => s.met);
if (met.length === 0) console.log("(ninguno todavía)");
for (const s of met) console.log(`✔ ${explainLimitation(s)}`);

// ==== 6. Requisitos pendientes ====
section(6, "Requisitos pendientes");
for (const s of gate.limitations) console.log(`✘ ${explainLimitation(s)}`);

// ==== 7. Limitaciones principales ====
section(7, "Limitaciones principales");
const topLimitations = gate.limitations.slice(0, 2);
console.log(
  `Tu principal limitación actualmente es: ${topLimitations.map((l) => l.requirement.label).join(" y ")}.`,
);
console.log(`Progreso total hacia muscle-up: ${Math.round(gate.overallReadiness * 100)}%.`);

// ==== 8. Prioridades ====
section(8, "Prioridades de entrenamiento");
gate.limitations.forEach((l, i) => console.log(`${i + 1}. ${l.requirement.label}`));

// ==== 9. Ejercicios recomendados ====
section(9, "Ejercicios recomendados (top 8, ya filtrados por material disponible)");
for (const s of ranked.slice(0, 8)) {
  const ex = EXERCISES_BY_ID[s.exerciseId]!;
  console.log(`${ex.name.padEnd(28)} score=${s.total.toFixed(2)}`);
}

// ==== 10. Progresiones ====
section(10, "Progresiones (siguiente paso de los ejercicios clave)");
for (const id of ["chest_to_bar_pull_up", "explosive_pull_up", "straight_bar_dip"]) {
  const ex = EXERCISES_BY_ID[id]!;
  const next = ex.progressions?.map((p) => EXERCISES_BY_ID[p]?.name).join(", ") || "(es el tope de su línea)";
  console.log(`${ex.name} -> ${next}`);
}

// ==== 11. Regresiones ====
section(11, "Regresiones disponibles si hace falta bajar intensidad");
for (const id of ["chest_to_bar_pull_up", "explosive_pull_up", "straight_bar_dip"]) {
  const ex = EXERCISES_BY_ID[id]!;
  const prev = ex.regressions?.map((p) => EXERCISES_BY_ID[p]?.name).join(", ") || "(es la base de su línea)";
  console.log(`${ex.name} -> ${prev}`);
}

// ==== 12. Primer entrenamiento recomendado ====
function printWorkout(minutes: number) {
  const w = assembleWorkoutSketch(ranked, EXERCISES_BY_ID, minutes);
  for (const item of w) {
    const ex = item.exercise;
    const volume = ex.recommendedTime ? ex.recommendedTime : `x${ex.recommendedReps ?? "?"}`;
    console.log(`[${item.block}] ${ex.name} — ${item.sets}${volume}, descanso ${ex.restSeconds}s`);
  }
}

section(12, `Primer entrenamiento recomendado (${profile.sessionDurationMinutes} min)`);
printWorkout(profile.sessionDurationMinutes);

console.log(`\n-- Misma prioridad, sesión de 20 min ("hoy tengo poco tiempo", §19) --`);
printWorkout(20);
console.log(`\n-- Misma prioridad, sesión de 90 min ("hoy tengo mucho tiempo", §19) --`);
printWorkout(90);

// ==== 13 y 14. Criterios para progresar / retroceder ====
section(13, "Criterios para progresar / 14. criterios para retroceder");
for (const id of ["pull_up", "chest_to_bar_pull_up"]) {
  const ex = EXERCISES_BY_ID[id]!;
  const entry = assessment.find((a) => a.exerciseId === id);
  const result = decideProgression(ex, [
    { reps: entry?.reps, seconds: entry?.seconds, rir: 2, techniqueOk: true },
  ]);
  console.log(`${ex.name}: decisión = ${result.decision}`);
  result.reasons.forEach((r) => console.log(`  - ${r}`));
  result.nextCriteriaToWatch.forEach((c) => console.log(`  · vigilar: ${c}`));
}

// ==== 15. Qué evaluar en la siguiente sesión ====
section(15, "Qué debería evaluar en la siguiente sesión");
console.log("- Reps de chest-to-bar (0 actualmente): primer indicio real de progreso hacia el requisito más limitante.");
console.log("- Reps de dominada explosiva / altura alcanzada sobre la barra (proxy de explosividad de tracción).");
console.log("- Técnica y RIR en dip en paralelas (ya cumple el umbral: vigilar que no se estanque en calidad).");
console.log("- Sensación de hombro/muñeca en cualquier drill de transición de muscle-up (riesgo de golpe si se introduce demasiado pronto).");
