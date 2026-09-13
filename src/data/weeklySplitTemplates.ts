export type DayArchetype = "priority_focus" | "complementary";

// Plantillas de split semanal (§20 del brief: 2 a 6 días). "priority_focus"
// deja que el ranking normal decida (así la limitación principal del
// usuario gana esos días de forma natural); "complementary" pide evitar el
// patrón de movimiento que fue protagonista el día anterior. Se alternan, y
// cuando el número de días es impar el día extra es de prioridad — la
// limitación principal necesita más frecuencia, no solo una exposición a
// la semana (§13). Ver docs/architecture-v2-workout-engine.md §2.
export const WEEKLY_SPLIT_TEMPLATES: Record<number, DayArchetype[]> = {
  2: ["priority_focus", "complementary"],
  3: ["priority_focus", "complementary", "priority_focus"],
  4: ["priority_focus", "complementary", "priority_focus", "complementary"],
  5: ["priority_focus", "complementary", "priority_focus", "complementary", "priority_focus"],
  6: ["priority_focus", "complementary", "priority_focus", "complementary", "priority_focus", "complementary"],
};

const DEFAULT_DAYS_PER_WEEK = 4;

export function getWeeklySplitTemplate(daysPerWeek: number): DayArchetype[] {
  const safeInput = Number.isFinite(daysPerWeek) ? daysPerWeek : DEFAULT_DAYS_PER_WEEK;
  const clamped = Math.min(6, Math.max(2, Math.round(safeInput)));
  return WEEKLY_SPLIT_TEMPLATES[clamped]!;
}
