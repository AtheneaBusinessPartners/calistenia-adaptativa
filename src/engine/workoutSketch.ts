import type { Exercise, ExerciseScoreBreakdown, MovementPatternId } from "./types.js";
import { parseAverage } from "./rangeText.js";
import type { NextSessionPrescription } from "./sessionPlanner.js";

export interface WorkoutBlockItem {
  block: string;
  exercise: Exercise;
  score: ExerciseScoreBreakdown; // ranking previo a aplicar historial — ver applyTrainingHistory
  sets: number; // series prescritas para ESTA sesión (puede diferir de exercise.recommendedSets)
  prescription?: NextSessionPrescription; // presente solo si applyTrainingHistory encontró historial real para este ejercicio
}

const MIN_SETS = 2;
const MAX_BONUS_SETS = 2;
const SECONDS_PER_REP = 3; // asunción de tempo controlado en calistenia; ver docs/architecture-v1.md
const WARMUP_FRACTION = 0.15;
const MAX_WARMUP_MINUTES = 5;

/** Segundos de trabajo activo estimados para UNA serie (sin el descanso). */
function estimateWorkSeconds(exercise: Exercise): number {
  if (exercise.masteryCriteria.type === "time") {
    return parseAverage(exercise.recommendedTime) ?? exercise.masteryCriteria.seconds;
  }
  const reps = parseAverage(exercise.recommendedReps) ?? exercise.masteryCriteria.reps;
  return reps * SECONDS_PER_REP;
}

/** Segundos totales de UNA serie completa, incluyendo su descanso posterior. */
function estimateSetSeconds(exercise: Exercise): number {
  return estimateWorkSeconds(exercise) + exercise.restSeconds;
}

/**
 * Ensamblado de una sesión de ejemplo (§17-19 del brief) a partir de
 * ejercicios ya puntuados por exerciseSelector, ajustando las series al
 * tiempo real disponible — no solo el número de ejercicios. Con poco tiempo
 * se recortan primero los bloques de menor prioridad (§19: "convertir la
 * sesión en una versión de 20 minutos manteniendo las prioridades"); con
 * tiempo de sobra se amplía el trabajo secundario/accesorio en vez de
 * añadir bloques sin relación con el objetivo ("con 90 minutos puede
 * ampliar el trabajo secundario").
 *
 * Esto NO es el generador de entrenamiento completo de FASE 2 (no gestiona
 * periodización semanal ni progresión de carga entre sesiones) — es la
 * prueba de que el ranking produce una sesión con sentido estructural Y
 * ajustada al tiempo real del usuario.
 */
export function assembleWorkoutSketch(
  ranked: ExerciseScoreBreakdown[],
  exercisesById: Record<string, Exercise>,
  sessionDurationMinutes: number,
  avoidMovementPatterns?: Set<MovementPatternId>,
): WorkoutBlockItem[] {
  const used = new Set<string>();
  // Preferencia BLANDA (§2 de architecture-v2): si hay un candidato que no
  // repite el patrón de movimiento de ayer, se prefiere; si no hay ninguno,
  // se cae al ranking normal en vez de dejar el bloque vacío. No es un gate
  // duro como equipmentGate/painGate — evitar dos días seguidos del mismo
  // patrón es una buena práctica, no una regla de seguridad.
  const pick = (predicate: (e: Exercise) => boolean) => {
    if (avoidMovementPatterns && avoidMovementPatterns.size > 0) {
      const avoided = ranked.find(
        (s) =>
          !used.has(s.exerciseId) &&
          predicate(exercisesById[s.exerciseId]!) &&
          !avoidMovementPatterns.has(exercisesById[s.exerciseId]!.movementPattern),
      );
      if (avoided) {
        used.add(avoided.exerciseId);
        return avoided;
      }
    }
    const found = ranked.find((s) => !used.has(s.exerciseId) && predicate(exercisesById[s.exerciseId]!));
    if (found) used.add(found.exerciseId);
    return found;
  };

  const warmupMinutes = Math.min(MAX_WARMUP_MINUTES, sessionDurationMinutes * WARMUP_FRACTION);
  let budgetSeconds = Math.max(0, Math.round((sessionDurationMinutes - warmupMinutes) * 60));

  const blocks: WorkoutBlockItem[] = [];
  const isMainCategory = (e: Exercise) => e.category === "pull" || e.category === "push" || e.category === "legs";

  const tryAddBlock = (label: string, score: ExerciseScoreBreakdown | undefined): boolean => {
    if (!score) return false;
    const exercise = exercisesById[score.exerciseId]!;
    const setSeconds = estimateSetSeconds(exercise);
    const idealSets = exercise.recommendedSets;
    const affordableSets = Math.floor(budgetSeconds / setSeconds);

    let sets: number;
    if (blocks.length === 0) {
      // El primer bloque de la sesión siempre entra, aunque el presupuesto
      // sea muy ajustado: una sesión con algo dentro es mejor que una vacía
      // por un redondeo de la estimación de tiempo.
      sets = Math.min(idealSets, Math.max(affordableSets, MIN_SETS));
    } else {
      if (affordableSets < MIN_SETS) return false; // no cabe: aquí se recorta, respetando el orden de prioridad
      sets = Math.min(idealSets, affordableSets);
    }

    budgetSeconds -= sets * setSeconds;
    blocks.push({ block: label, exercise, score, sets });
    return true;
  };

  // El bloque de "Skill / técnica" solo se reserva para un ejercicio de
  // categoría "skill" cuya progressionReadiness sea alta (sus regresiones ya
  // están dominadas) Y que sea relevante para el objetivo — no tiene
  // sentido meter "Muscle-up" en la sesión de alguien con 0 chest-to-bar y 0
  // dominadas explosivas solo porque es el ejercicio final de su objetivo
  // (§30/§33 del brief). Si no hay un candidato listo, el hueco se rellena
  // con más trabajo de fuerza principal/secundaria, que es donde está la
  // prioridad real.
  const skillCandidate = ranked.find(
    (s) =>
      !used.has(s.exerciseId) &&
      exercisesById[s.exerciseId]!.category === "skill" &&
      s.progressionReadiness >= 0.7 &&
      s.skillRelevance > 0,
  );
  if (skillCandidate) {
    used.add(skillCandidate.exerciseId);
    tryAddBlock("Skill / técnica", skillCandidate);
  }

  for (const label of ["Fuerza principal", "Fuerza secundaria", "Accesorio"]) {
    tryAddBlock(label, pick(isMainCategory));
  }
  tryAddBlock("Core", pick((e) => e.category === "core"));
  tryAddBlock("Movilidad", pick((e) => e.movementPattern === "balance_hold" || e.category === "core"));

  // Si queda presupuesto de sobra tras cubrir los bloques base, se amplía el
  // trabajo secundario/accesorio en vez de inventar bloques nuevos sin
  // relación con la sesión (§19, ejemplo de los 90 minutos).
  for (const item of blocks) {
    if (item.block !== "Fuerza secundaria" && item.block !== "Accesorio") continue;
    const setSeconds = estimateSetSeconds(item.exercise);
    const cap = item.exercise.recommendedSets + MAX_BONUS_SETS;
    while (item.sets < cap && budgetSeconds >= setSeconds) {
      item.sets += 1;
      budgetSeconds -= setSeconds;
    }
  }

  return blocks;
}
