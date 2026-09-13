import type { Exercise, ExerciseScoreBreakdown } from "./types.js";

export interface WorkoutBlockItem {
  block: string;
  exercise: Exercise;
  score: ExerciseScoreBreakdown;
}

/**
 * Ensamblado MÍNIMO de una sesión de ejemplo (§17-18 del brief) a partir de
 * ejercicios ya puntuados por exerciseSelector. Esto NO es el generador de
 * entrenamiento completo de FASE 2 (no gestiona periodización semanal ni
 * ciclos de volumen) — es solo la prueba de que el ranking produce una
 * sesión con sentido estructural para el usuario ficticio de §40.
 */
export function assembleWorkoutSketch(
  ranked: ExerciseScoreBreakdown[],
  exercisesById: Record<string, Exercise>,
  sessionDurationMinutes: number,
): WorkoutBlockItem[] {
  const used = new Set<string>();
  const pick = (predicate: (e: Exercise) => boolean) => {
    const found = ranked.find((s) => !used.has(s.exerciseId) && predicate(exercisesById[s.exerciseId]!));
    if (found) used.add(found.exerciseId);
    return found;
  };

  const maxBlocks = sessionDurationMinutes <= 25 ? 3 : sessionDurationMinutes <= 45 ? 4 : sessionDurationMinutes <= 70 ? 5 : 6;
  const blocks: WorkoutBlockItem[] = [];
  const isMainCategory = (e: Exercise) => e.category === "pull" || e.category === "push" || e.category === "legs";

  const addBlock = (label: string, score: ExerciseScoreBreakdown | undefined) => {
    if (!score || blocks.length >= maxBlocks) return;
    blocks.push({ block: label, exercise: exercisesById[score.exerciseId]!, score });
  };

  // El bloque de "Skill / técnica" solo se reserva para un ejercicio de
  // categoría "skill" cuya progressionReadiness sea alta (sus regresiones ya
  // están dominadas) — es decir, que el usuario esté realmente en
  // condiciones de intentarlo. Puntuar alto en relevancia no basta: no tiene
  // sentido meter "Muscle-up" en la sesión de alguien con 0 chest-to-bar y 0
  // dominadas explosivas solo porque es el ejercicio final de su objetivo
  // (§30/§33 del brief — el motor no debe recomendar el movimiento que el
  // usuario aún no puede hacer, debe recomendar lo que le falta para
  // llegar a él). Si no hay un candidato listo, el hueco se rellena con más
  // trabajo de fuerza principal/secundaria, que es donde está la prioridad real.
  const skillCandidate = ranked.find(
    (s) =>
      !used.has(s.exerciseId) &&
      exercisesById[s.exerciseId]!.category === "skill" &&
      s.progressionReadiness >= 0.7 &&
      s.skillRelevance > 0,
  );
  if (skillCandidate) {
    used.add(skillCandidate.exerciseId);
    addBlock("Skill / técnica", skillCandidate);
  }

  for (const label of ["Fuerza principal", "Fuerza secundaria", "Accesorio"]) {
    if (blocks.length >= maxBlocks) break;
    addBlock(label, pick(isMainCategory));
  }

  addBlock("Core", pick((e) => e.category === "core"));
  addBlock("Movilidad", pick((e) => e.movementPattern === "balance_hold" || e.category === "core"));

  return blocks;
}
