import type { Exercise, ExerciseScoreBreakdown } from "./types.js";
import { assembleWorkoutSketch, type WorkoutBlockItem } from "./workoutSketch.js";
import { getWeeklySplitTemplate, type DayArchetype } from "../data/weeklySplitTemplates.js";

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
 * Genera un plan de varios días a partir de una plantilla de arquetipos
 * (§20 del brief). Cada día se construye reutilizando
 * `assembleWorkoutSketch` de FASE 1 — un día "priority_focus" no restringe
 * nada (así el patrón de movimiento de la limitación principal gana solo,
 * por ranking); un día "complementary" evita, si puede, el patrón de
 * movimiento que fue "Fuerza principal" el día anterior.
 *
 * Ver docs/architecture-v2-workout-engine.md §2.
 */
export function generateWeeklyPlan(
  ranked: ExerciseScoreBreakdown[],
  exercisesById: Record<string, Exercise>,
  sessionDurationMinutes: number,
  daysPerWeek: number,
): WeeklyPlan {
  const template = getWeeklySplitTemplate(daysPerWeek);
  const days: DayPlan[] = [];
  let avoidPatterns: Set<Exercise["movementPattern"]> | undefined;

  template.forEach((archetype, dayIndex) => {
    const blocks = assembleWorkoutSketch(
      ranked,
      exercisesById,
      sessionDurationMinutes,
      archetype === "complementary" ? avoidPatterns : undefined,
    );

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
