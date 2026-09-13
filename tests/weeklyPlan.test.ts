import { describe, expect, it } from "vitest";
import { applyTrainingHistory, generateWeeklyPlan } from "../src/engine/weeklyPlan.js";
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

  it("un daysPerWeek inválido (NaN) no rompe el generador: cae a un valor por defecto", () => {
    const plan = generateWeeklyPlan(ranked, EXERCISES_BY_ID, profile.sessionDurationMinutes, NaN);
    expect(plan.days.length).toBeGreaterThanOrEqual(2);
    expect(plan.days.length).toBeLessThanOrEqual(6);
  });
});

describe("integración historial <-> plan semanal (§13 dentro de §17-20)", () => {
  it("sin historial, el plan usa el volumen estático del ejercicio (recommendedSets)", () => {
    const plan = generateWeeklyPlan(ranked, EXERCISES_BY_ID, profile.sessionDurationMinutes, 4);
    const mainBlock = plan.days[0]!.blocks.find((b) => b.block === "Fuerza principal")!;
    expect(mainBlock.prescription).toBeUndefined();
  });

  it("con historial, el plan refleja la prescripción real de planNextSession, no el rango estático de la ficha", () => {
    const chestToBar = EXERCISES_BY_ID["chest_to_bar_pull_up"]!;
    const history: SessionLogEntry[] = [{ reps: 2, rir: 2, techniqueOk: true }];
    const historyByExercise = { [chestToBar.id]: history };

    const plan = generateWeeklyPlan(ranked, EXERCISES_BY_ID, profile.sessionDurationMinutes, 4, historyByExercise);
    const mainBlock = plan.days[0]!.blocks.find((b) => b.block === "Fuerza principal")!;

    expect(mainBlock.exercise.id).toBe(chestToBar.id); // sigue siendo la prioridad #1, la ranking no cambió
    expect(mainBlock.prescription).toBeDefined();
    expect(mainBlock.prescription!.targetReps).toBe(3); // 2 reps la última vez -> sube a 3, no el "3-5" estático de la ficha
  });

  it("applyTrainingHistory cambia de ejercicio en el bloque si el historial dice que toca avanzar de línea", () => {
    const pullUp = EXERCISES_BY_ID["pull_up"]!;
    const plan = generateWeeklyPlan(ranked, EXERCISES_BY_ID, profile.sessionDurationMinutes, 4);
    const accessoryBlock = plan.days[0]!.blocks.find((b) => b.exercise.id === pullUp.id);
    expect(accessoryBlock).toBeDefined();

    // Aislado del resto de bloques del día para no mezclar esta aserción
    // con la deduplicación por colisión (probada aparte, más abajo).
    const history: SessionLogEntry[] = [{ reps: 8, rir: 2, techniqueOk: true }]; // cumple el listón de pull_up (8)
    const updated = applyTrainingHistory([accessoryBlock!], { [pullUp.id]: history }, EXERCISES_BY_ID);

    expect(updated[0]!.exercise.id).toBe("chest_to_bar_pull_up"); // progressions[0] de pull_up
    expect(updated[0]!.exercise.id).not.toBe(pullUp.id);
  });

  it("si avanzar de línea hace converger dos bloques en el mismo ejercicio, no lo duplica: descarta el de menor prioridad", () => {
    const pullUp = EXERCISES_BY_ID["pull_up"]!;
    const plan = generateWeeklyPlan(ranked, EXERCISES_BY_ID, profile.sessionDurationMinutes, 4);
    const mainBlock = plan.days[0]!.blocks.find((b) => b.block === "Fuerza principal")!;
    expect(mainBlock.exercise.id).toBe("chest_to_bar_pull_up"); // ya es el foco principal de este usuario

    // Si el "Accesorio" (dominada) avanza de línea, su progressions[0] es
    // justo chest_to_bar_pull_up — el mismo ejercicio que ya es principal.
    const history: SessionLogEntry[] = [{ reps: 8, rir: 2, techniqueOk: true }];
    const updated = applyTrainingHistory(plan.days[0]!.blocks, { [pullUp.id]: history }, EXERCISES_BY_ID);

    const chestToBarBlocks = updated.filter((b) => b.exercise.id === "chest_to_bar_pull_up");
    expect(chestToBarBlocks).toHaveLength(1);
    expect(chestToBarBlocks[0]!.block).toBe("Fuerza principal"); // se queda el de mayor prioridad
    expect(updated.some((b) => b.block === "Accesorio")).toBe(false); // el duplicado se descarta, no se rellena con otra cosa
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
