import type { AssessmentEntry, CapabilityId, CapabilityProfile, Exercise } from "./types.js";
import { CAPABILITY_IDS } from "../data/capabilities.js";

function targetAndCurrent(exercise: Exercise, entry: AssessmentEntry): { target: number; current: number } {
  if (exercise.masteryCriteria.type === "time") {
    return { target: exercise.masteryCriteria.seconds, current: entry.seconds ?? 0 };
  }
  return { target: exercise.masteryCriteria.reps, current: entry.reps ?? 0 };
}

/**
 * Perfil de capacidades 0-100. Por cada ejercicio evaluado se calcula un
 * "levelScore" (0-1) = qué tan cerca está del listón de dominio de ese
 * ejercicio (progressRatio) × qué tan avanzado es ese ejercicio dentro de su
 * cadena (difficulty/10). La contribución a cada capacidad es ese levelScore
 * por el peso que el ejercicio aporta a esa capacidad.
 *
 * Se toma el MÁXIMO entre todos los ejercicios evaluados para cada
 * capacidad, no la media — dos cadenas independientes (p.ej. pull vertical
 * y balance/handstand) no deben diluirse entre sí (ver docs/architecture-v1.md §4).
 */
export function computeCapabilityProfile(
  assessment: AssessmentEntry[],
  exercisesById: Record<string, Exercise>,
): CapabilityProfile {
  const profile = Object.fromEntries(CAPABILITY_IDS.map((id) => [id, 0])) as CapabilityProfile;

  for (const entry of assessment) {
    const exercise = exercisesById[entry.exerciseId];
    if (!exercise) continue;
    const { target, current } = targetAndCurrent(exercise, entry);
    const progressRatio = target > 0 ? Math.min(current / target, 1) : 0;
    const levelScore = progressRatio * (exercise.difficulty / 10);

    for (const [capId, weight] of Object.entries(exercise.capabilitiesDeveloped)) {
      const contribution = levelScore * (weight ?? 0) * 100;
      const id = capId as CapabilityId;
      if (contribution > profile[id]) profile[id] = contribution;
    }
  }

  for (const id of CAPABILITY_IDS) {
    profile[id] = Math.round(profile[id]);
  }
  return profile;
}

/** Progreso (0-1) del usuario en un ejercicio concreto, a partir del assessment. */
export function exerciseProgressRatio(exercise: Exercise, assessment: AssessmentEntry[]): number {
  const entry = assessment.find((a) => a.exerciseId === exercise.id);
  if (!entry) return 0;
  const { target, current } = targetAndCurrent(exercise, entry);
  return target > 0 ? Math.min(current / target, 1) : 0;
}

/**
 * Estimación de "hasta dónde ha llegado" el usuario dentro de un patrón de
 * movimiento, en la misma escala 0-10 que `difficulty`. Se usa en
 * exerciseSelector para decidir si un ejercicio es el siguiente paso lógico,
 * ya está superado, o queda demasiado lejos.
 */
export function estimateMovementFrontier(
  movementPattern: Exercise["movementPattern"],
  assessment: AssessmentEntry[],
  exercisesById: Record<string, Exercise>,
): number {
  let frontier = 0;
  for (const entry of assessment) {
    const exercise = exercisesById[entry.exerciseId];
    if (!exercise || exercise.movementPattern !== movementPattern) continue;
    const ratio = exerciseProgressRatio(exercise, assessment);
    const effectiveDifficulty = ratio >= 1 ? exercise.difficulty : exercise.difficulty * ratio;
    if (effectiveDifficulty > frontier) frontier = effectiveDifficulty;
  }
  return frontier;
}
