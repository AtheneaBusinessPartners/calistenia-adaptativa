import type { Exercise } from "./types.js";
import { WARMUP_MOVES, type WarmupMove } from "../data/warmups.js";

/**
 * Calentamiento antes de la sesión: siempre incluye la movilidad general, y
 * añade activación específica solo de las categorías que de verdad
 * aparecen en el plan de hoy — no tiene sentido sugerir movilidad de
 * muñeca si hoy no hay nada de skill/apoyo de manos.
 */
export function suggestWarmup(todaysExercises: Exercise[]): WarmupMove[] {
  const categoriesToday = new Set(todaysExercises.map((e) => e.category));
  return WARMUP_MOVES.filter((move) => move.category === "general" || categoriesToday.has(move.category as Exercise["category"]));
}
