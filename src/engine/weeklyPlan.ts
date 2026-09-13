import type { CheckIn, Exercise, TrainingDay } from "./types.js";
import { assembleWorkoutSketch, type WorkoutBlockItem } from "./workoutSketch.js";
import { getWeeklySplitTemplate, type DayArchetype } from "../data/weeklySplitTemplates.js";
import { planNextSession } from "./sessionPlanner.js";
import type { SessionLogEntry } from "./progression.js";
import { rankExercises, type SelectorContext } from "./exerciseSelector.js";
import { computeMuscleFatigue } from "./fatigueEngine.js";
import { applyCheckInToFatigue } from "./checkIn.js";
import { explainFatigueImpact, type FatigueExplanation } from "./fatigueExplanation.js";

export interface DayPlan {
  dayIndex: number; // 0-based dentro de la semana, no un día de calendario concreto
  archetype: DayArchetype;
  focusLabel: string;
  blocks: WorkoutBlockItem[];
  fatigueByMuscle: Record<string, number>; // fatiga con la que se generó este día, para depurar/explicar
  fatigueExplanation: FatigueExplanation; // §16: por qué cambió (o no) el bloque principal por fatiga
}

export interface WeeklyPlan {
  daysPerWeek: number;
  days: DayPlan[];
}

export interface GenerateWeeklyPlanOptions {
  historyByExercise?: Record<string, SessionLogEntry[]>;
  /** Entrenamientos ya realizados ANTES de esta semana (daysAgo relativo al
   * día 0 de la semana que se va a generar). Sin esto, la fatiga del día 0
   * parte de cero (usuario recién llegado o sin historial reciente) — el
   * resto de días de la semana igualmente acumulan fatiga real generada
   * por los propios días anteriores de esa semana. */
  trainingLog?: TrainingDay[];
  /** Check-in de HOY (§15), aplicado solo al primer día de la semana que se
   * genera — cada día siguiente necesitaría su propio check-in en el
   * momento, que todavía no existe al generar toda la semana de una vez. */
  todayCheckIn?: CheckIn;
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

function dayAsTrainingDay(blocks: WorkoutBlockItem[]): TrainingDay {
  return {
    daysAgo: 0,
    exercises: blocks.map((b) => ({
      exerciseId: b.exercise.id,
      sets: b.sets,
      reps: b.prescription?.targetReps,
      seconds: b.prescription?.targetSeconds,
      rir: 2, // intensidad prescrita típica; no hay dato real hasta que se registre la sesión
    })),
  };
}

/**
 * Genera un plan de varios días a partir de una plantilla de arquetipos
 * (§20 del brief), re-rankeando los ejercicios CADA DÍA con la fatiga
 * acumulada hasta ese punto — el entrenamiento del lunes fatiga el martes.
 * Esto sustituye por completo la heurística de FASE 2 ("evitar el patrón de
 * movimiento de ayer"): con las plantillas actuales el primer día siempre es
 * "priority_focus" y genera su propia fatiga, así que para cualquier día
 * posterior ya hay una señal real que usar — la heurística nunca llegaba a
 * activarse de verdad, así que se elimina en vez de mantenerla sin usar.
 *
 * `exercises`/`ctx` son los mismos que se le pasarían a `rankExercises` —
 * este generador vuelve a llamarlo internamente una vez por día porque la
 * fatiga (a diferencia de la capacidad o el gate de skill) cambia dentro de
 * la propia semana que se está generando.
 *
 * Ver docs/architecture-v2-workout-engine.md §2-3 y
 * docs/architecture-v3-fatigue-engine.md §3.
 */
export function generateWeeklyPlan(
  exercises: Exercise[],
  ctx: SelectorContext,
  exercisesById: Record<string, Exercise>,
  sessionDurationMinutes: number,
  daysPerWeek: number,
  options?: GenerateWeeklyPlanOptions,
): WeeklyPlan {
  const template = getWeeklySplitTemplate(daysPerWeek);
  const days: DayPlan[] = [];
  const runningLog: TrainingDay[] = (options?.trainingLog ?? []).map((d) => ({ ...d, exercises: [...d.exercises] }));

  template.forEach((archetype, dayIndex) => {
    if (dayIndex > 0) {
      for (const d of runningLog) d.daysAgo += 1;
    }

    let fatigueByMuscle = computeMuscleFatigue(runningLog, exercisesById);
    let painZones = ctx.user.painZones;
    if (dayIndex === 0 && options?.todayCheckIn) {
      fatigueByMuscle = applyCheckInToFatigue(fatigueByMuscle, options.todayCheckIn);
      // El dolor del check-in de hoy también debe bloquear ejercicios de
      // verdad (gate duro ya existente desde FASE 1), no quedarse solo en
      // un aviso de texto — se une al painZones que ya trajera el usuario.
      if (options.todayCheckIn.painZones && options.todayCheckIn.painZones.length > 0) {
        painZones = Array.from(new Set([...(painZones ?? []), ...options.todayCheckIn.painZones]));
      }
    }
    const dayCtx: SelectorContext = { ...ctx, user: { ...ctx.user, fatigueByMuscle, painZones } };
    const ranked = rankExercises(exercises, dayCtx);

    let blocks = assembleWorkoutSketch(ranked, exercisesById, sessionDurationMinutes);
    const fatigueExplanation = explainFatigueImpact(exercises, dayCtx, fatigueByMuscle, exercisesById, sessionDurationMinutes);

    if (options?.historyByExercise) {
      blocks = applyTrainingHistory(blocks, options.historyByExercise, exercisesById);
    }

    days.push({
      dayIndex,
      archetype,
      focusLabel: archetype === "priority_focus" ? "Prioridad (limitación principal)" : "Complementario",
      fatigueExplanation,
      blocks,
      fatigueByMuscle,
    });

    runningLog.push(dayAsTrainingDay(blocks));
  });

  return { daysPerWeek: template.length, days };
}
