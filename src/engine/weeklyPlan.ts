import type { Exercise, ExerciseScoreBreakdown } from "./types.js";
import { assembleWorkoutSketch, type WorkoutBlockItem } from "./workoutSketch.js";
import { getWeeklySplitTemplate, type DayArchetype } from "../data/weeklySplitTemplates.js";
import { planNextSession } from "./sessionPlanner.js";
import type { SessionLogEntry } from "./progression.js";

export interface DayPlan {
  dayIndex: number; // 0-based dentro de la semana, no un día de calendario concreto
  archetype: DayArchetype;
  focusLabel: string;
  blocks: WorkoutBlockItem[];
}

export interface WeeklyPlan {
  daysPerWeek: number;
  days: DayPlan[];
}

/**
 * Sustituye el volumen ESTÁTICO de un bloque (exercise.recommendedSets, el
 * mismo siempre) por la prescripción REAL que da `planNextSession` a partir
 * del historial de sesiones — esto es lo que conecta el plan semanal con la
 * progresión de §13 (3×5→3×6→3×7→3×8), en vez de mostrar cada semana el
 * mismo rango de la ficha del ejercicio como si nunca hubiera pasado nada.
 * Si `planNextSession` decide avanzar o regresar de línea, el bloque cambia
 * de ejercicio también — el `score` que queda es el del ranking previo
 * (informativo), no una re-puntuación del nuevo ejercicio.
 */
export function applyTrainingHistory(
  blocks: WorkoutBlockItem[],
  historyByExercise: Record<string, SessionLogEntry[]>,
  exercisesById: Record<string, Exercise>,
): WorkoutBlockItem[] {
  const seenExerciseIds = new Set<string>();
  const result: WorkoutBlockItem[] = [];

  for (const item of blocks) {
    const history = historyByExercise[item.exercise.id];
    const updated = history && history.length > 0 ? applyPrescription(item, history, exercisesById) : item;

    // Avanzar de línea puede hacer que un bloque de menor prioridad
    // (p.ej. "Accesorio") converja en el MISMO ejercicio que uno de mayor
    // prioridad ya presente ese día (p.ej. "Fuerza principal"). Los bloques
    // llegan en orden de prioridad, así que si ya se vio este ejercicio se
    // descarta el duplicado en vez de entrenarlo dos veces bajo dos
    // etiquetas distintas.
    if (seenExerciseIds.has(updated.exercise.id)) continue;
    seenExerciseIds.add(updated.exercise.id);
    result.push(updated);
  }

  return result;
}

function applyPrescription(
  item: WorkoutBlockItem,
  history: SessionLogEntry[],
  exercisesById: Record<string, Exercise>,
): WorkoutBlockItem {
  const prescription = planNextSession(item.exercise, history, exercisesById);
  const exercise = exercisesById[prescription.exerciseId] ?? item.exercise;
  return { ...item, exercise, sets: prescription.sets, prescription };
}

/**
 * Genera un plan de varios días a partir de una plantilla de arquetipos
 * (§20 del brief). Cada día se construye reutilizando
 * `assembleWorkoutSketch` de FASE 1 — un día "priority_focus" no restringe
 * nada (así el patrón de movimiento de la limitación principal gana solo,
 * por ranking); un día "complementary" evita, si puede, el patrón de
 * movimiento que fue "Fuerza principal" el día anterior. Si se pasa
 * `historyByExercise`, cada bloque se ajusta además con
 * `applyTrainingHistory` para reflejar la progresión real, no solo el
 * rango recomendado estático de la ficha del ejercicio.
 *
 * Ver docs/architecture-v2-workout-engine.md §2-3.
 */
export function generateWeeklyPlan(
  ranked: ExerciseScoreBreakdown[],
  exercisesById: Record<string, Exercise>,
  sessionDurationMinutes: number,
  daysPerWeek: number,
  historyByExercise?: Record<string, SessionLogEntry[]>,
): WeeklyPlan {
  const template = getWeeklySplitTemplate(daysPerWeek);
  const days: DayPlan[] = [];
  let avoidPatterns: Set<Exercise["movementPattern"]> | undefined;

  template.forEach((archetype, dayIndex) => {
    let blocks = assembleWorkoutSketch(
      ranked,
      exercisesById,
      sessionDurationMinutes,
      archetype === "complementary" ? avoidPatterns : undefined,
    );

    if (historyByExercise) {
      blocks = applyTrainingHistory(blocks, historyByExercise, exercisesById);
    }

    // El patrón a evitar el día siguiente se decide DESPUÉS de aplicar el
    // historial: si avanzar/regresar de línea cambió el ejercicio (y la
    // mayoría de progressions/regressions se quedan en el mismo
    // movementPattern, pero no todas — p.ej. handstand libre -> HSPU libre
    // cruza de balance_hold a vertical_push), lo que importa para espaciar
    // el estímulo del día siguiente es el patrón REALMENTE entrenado hoy.
    const mainBlock = blocks.find((b) => b.block === "Fuerza principal");
    avoidPatterns = mainBlock ? new Set([mainBlock.exercise.movementPattern]) : undefined;

    days.push({
      dayIndex,
      archetype,
      focusLabel: archetype === "priority_focus" ? "Prioridad (limitación principal)" : "Complementario",
      blocks,
    });
  });

  return { daysPerWeek: template.length, days };
}
