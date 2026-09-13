import type { Exercise, MovementPatternId } from "./types.js";
import { rankExercises, type SelectorContext } from "./exerciseSelector.js";
import { assembleWorkoutSketch } from "./workoutSketch.js";

const FATIGUE_MENTION_THRESHOLD = 40; // a partir de aquí se nombra el músculo en la explicación

const PATTERN_LABEL: Record<MovementPatternId, string> = {
  vertical_pull: "tirón",
  horizontal_pull: "tirón",
  vertical_push: "empuje",
  horizontal_push: "empuje",
  squat: "pierna",
  hinge: "pierna",
  core_flexion: "core",
  core_anti_extension: "core",
  isometric_support: "sujeción isométrica",
  balance_hold: "equilibrio",
};

export interface FatigueExplanation {
  changed: boolean;
  message?: string;
}

/**
 * §16 del brief: si la fatiga real cambió qué ejercicio ganó "Fuerza
 * principal" (comparado con lo que habría salido sin fatiga), genera una
 * frase breve nombrando los músculos que motivaron el cambio — no una
 * plantilla genérica, los músculos concretos que estaban por encima del
 * umbral en el ejercicio que se evitó.
 */
export function explainFatigueImpact(
  exercises: Exercise[],
  ctx: SelectorContext,
  fatigueByMuscle: Record<string, number>,
  exercisesById: Record<string, Exercise>,
  sessionDurationMinutes: number,
): FatigueExplanation {
  const rankedWith = rankExercises(exercises, { ...ctx, user: { ...ctx.user, fatigueByMuscle } });
  const rankedWithout = rankExercises(exercises, { ...ctx, user: { ...ctx.user, fatigueByMuscle: {} } });

  const mainWith = assembleWorkoutSketch(rankedWith, exercisesById, sessionDurationMinutes).find((b) => b.block === "Fuerza principal");
  const mainWithout = assembleWorkoutSketch(rankedWithout, exercisesById, sessionDurationMinutes).find(
    (b) => b.block === "Fuerza principal",
  );

  if (!mainWith || !mainWithout || mainWith.exercise.id === mainWithout.exercise.id) {
    return { changed: false };
  }

  const fatiguedMuscles = mainWithout.exercise.primaryMuscles.filter((m) => (fatigueByMuscle[m] ?? 0) >= FATIGUE_MENTION_THRESHOLD);
  const muscleNames = (fatiguedMuscles.length > 0 ? fatiguedMuscles : mainWithout.exercise.primaryMuscles).join(" y ");
  const patternLabel = PATTERN_LABEL[mainWithout.exercise.movementPattern];

  return {
    changed: true,
    message: `Hemos reducido el trabajo de ${patternLabel} porque tu nivel de fatiga de ${muscleNames} todavía es elevado.`,
  };
}
