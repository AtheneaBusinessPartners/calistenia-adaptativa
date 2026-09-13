import type { Exercise, TrainingDay } from "./types.js";
import { getRecoveryDays } from "../data/muscleRecovery.js";

const SECONDARY_MUSCLE_WEIGHT = 0.5;
const FATIGUE_PER_STIMULUS_UNIT = 12; // escala el estímulo a un 0-100 con sentido (ver docs §1)
const MAX_FATIGUE = 100;

/** Más cerca del fallo (RIR bajo) = más estímulo por serie. RIR ausente se
 * trata como esfuerzo moderado (RIR≈2), no como esfuerzo nulo. */
function intensityFactor(rir: number | undefined): number {
  const effectiveRir = rir ?? 2;
  return Math.max(0.3, 1 - effectiveRir * 0.15);
}

/** Fracción del estímulo original que queda tras `daysAgo` días, dado que a
 * `recoveryDays` queda ~10% (decaimiento exponencial, ver §1 del doc). */
function remainingFraction(daysAgo: number, recoveryDays: number): number {
  if (daysAgo <= 0) return 1;
  return Math.pow(0.1, daysAgo / recoveryDays);
}

/**
 * Fatiga actual por músculo (0-100) a partir del historial de
 * entrenamientos reales. Ver docs/architecture-v3-fatigue-engine.md §1.
 */
export function computeMuscleFatigue(
  trainingLog: TrainingDay[],
  exercisesById: Record<string, Exercise>,
): Record<string, number> {
  const fatigue: Record<string, number> = {};

  for (const day of trainingLog) {
    for (const performed of day.exercises) {
      const exercise = exercisesById[performed.exerciseId];
      if (!exercise) continue;

      const stimulus = performed.sets * intensityFactor(performed.rir);

      const addContribution = (muscleId: string, weight: number) => {
        const recoveryDays = getRecoveryDays(muscleId);
        const contribution = stimulus * weight * remainingFraction(day.daysAgo, recoveryDays) * FATIGUE_PER_STIMULUS_UNIT;
        fatigue[muscleId] = (fatigue[muscleId] ?? 0) + contribution;
      };

      for (const m of exercise.primaryMuscles) addContribution(m, 1);
      for (const m of exercise.secondaryMuscles ?? []) addContribution(m, SECONDARY_MUSCLE_WEIGHT);
    }
  }

  for (const muscleId of Object.keys(fatigue)) {
    fatigue[muscleId] = Math.min(MAX_FATIGUE, Math.round(fatigue[muscleId]!));
  }
  return fatigue;
}

/**
 * Fatiga (0-100) relevante para UN ejercicio concreto — es lo que
 * exerciseSelector.ts usa para amortiguar la puntuación (§3 del doc).
 *
 * Se toma el MÁXIMO entre los músculos primarios, no la media: si un
 * ejercicio implica varios músculos primarios y uno de ellos está agotado,
 * ese músculo es el cuello de botella real del movimiento, sin importar que
 * los otros estén frescos (promediar diluiría la señal y dejaría "colar"
 * ejercicios que en la práctica siguen exigiendo el músculo agotado —
 * mismo principio que el máximo, no la media, en capabilityProfile.ts §4).
 * Los músculos secundarios aportan un empujón menor (peso 0.5), sin llegar
 * a dominar sobre un primario fresco.
 */
export function exerciseFatigueLoad(exercise: Exercise, fatigueByMuscle: Partial<Record<string, number>> | undefined): number {
  if (!fatigueByMuscle) return 0;
  const primaryValues = exercise.primaryMuscles.map((m) => fatigueByMuscle[m] ?? 0);
  const secondaryValues = (exercise.secondaryMuscles ?? []).map((m) => fatigueByMuscle[m] ?? 0);

  const maxPrimary = primaryValues.length > 0 ? Math.max(...primaryValues) : 0;
  const avgSecondary = secondaryValues.length > 0 ? secondaryValues.reduce((a, b) => a + b, 0) / secondaryValues.length : 0;

  return Math.max(maxPrimary, avgSecondary * SECONDARY_MUSCLE_WEIGHT);
}
