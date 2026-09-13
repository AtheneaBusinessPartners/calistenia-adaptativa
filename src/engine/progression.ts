import type { Exercise, ProgressionDecision, ProgressionResult } from "./types.js";

export interface SessionLogEntry {
  reps?: number;
  seconds?: number;
  rir?: number; // reps in reserve reportadas
  techniqueOk: boolean;
}

/**
 * Motor de progresión (§13 del brief). No decide solo por repeticiones:
 * exige también técnica consistente y un RIR que indique que el rendimiento
 * es sostenible, no un máximo aislado. `history` son las últimas sesiones
 * con este ejercicio, de más antigua a más reciente.
 */
export function decideProgression(exercise: Exercise, history: SessionLogEntry[]): ProgressionResult {
  if (history.length === 0) {
    return {
      exerciseId: exercise.id,
      decision: "MAINTAIN",
      reasons: ["Sin historial todavía: primera sesión con este ejercicio."],
      nextCriteriaToWatch: [criteriaDescription(exercise)],
    };
  }

  const last = history[history.length - 1]!;
  const target = exercise.masteryCriteria.type === "time" ? exercise.masteryCriteria.seconds : exercise.masteryCriteria.reps;
  const currentValue = exercise.masteryCriteria.type === "time" ? last.seconds ?? 0 : last.reps ?? 0;
  const meetsTarget = currentValue >= target;

  const recentValues = history.slice(-3).map((h) => (exercise.masteryCriteria.type === "time" ? h.seconds ?? 0 : h.reps ?? 0));
  const isDeclining = recentValues.length >= 2 && recentValues[recentValues.length - 1]! < recentValues[0]! * 0.85;
  const highEffortConsistently = history.slice(-3).every((h) => (h.rir ?? 2) <= 1);

  if (isDeclining && highEffortConsistently) {
    return {
      exerciseId: exercise.id,
      decision: "DELOAD_CANDIDATE",
      reasons: [
        "El rendimiento ha bajado en las últimas sesiones pese a esfuerzo alto sostenido.",
        "Esto es indicio de fatiga acumulada, no de falta de capacidad.",
      ],
      nextCriteriaToWatch: ["Repetir esta carga tras una semana de descarga antes de decidir si se mantiene o se regresa."],
    };
  }

  if (!last.techniqueOk) {
    return {
      exerciseId: exercise.id,
      decision: meetsTarget ? "MAINTAIN" : "REGRESS",
      reasons: [
        meetsTarget
          ? "Cumple el objetivo numérico pero la técnica no es consistente: no se desbloquea la progresión con mala forma."
          : "No cumple el objetivo numérico y además la técnica falla: conviene bajar a la regresión para consolidar la forma.",
      ],
      nextCriteriaToWatch: ["Técnica limpia en todas las repeticiones antes de volver a evaluar progresión."],
    };
  }

  if (!meetsTarget) {
    const decision: ProgressionDecision = exercise.masteryCriteria.type === "time" ? "INCREASE_TIME" : "INCREASE_REPS";
    return {
      exerciseId: exercise.id,
      decision,
      reasons: ["Técnica correcta pero todavía por debajo del listón de dominio: sigue en este ejercicio."],
      nextCriteriaToWatch: [criteriaDescription(exercise)],
    };
  }

  const hasNextProgression = (exercise.progressions?.length ?? 0) > 0;
  if (hasNextProgression) {
    return {
      exerciseId: exercise.id,
      decision: "ADVANCE_PROGRESSION",
      reasons: [
        "Cumple el listón de dominio con técnica consistente y sin ir al fallo total: listo para la siguiente progresión.",
      ],
      nextCriteriaToWatch: exercise.progressions!.map((p) => `Empezar a introducir ${p}`),
    };
  }

  return {
    exerciseId: exercise.id,
    decision: "MAINTAIN",
    reasons: ["Ya es el ejercicio más avanzado de su línea (o la skill objetivo): mantener y buscar más calidad/volumen."],
    nextCriteriaToWatch: ["Aumentar series o añadir lastre si sigue siendo demasiado fácil."],
  };
}

function criteriaDescription(exercise: Exercise): string {
  return exercise.masteryCriteria.type === "time"
    ? `Mantener ${exercise.masteryCriteria.seconds}s con técnica correcta`
    : `Completar ${exercise.masteryCriteria.sets}×${exercise.masteryCriteria.reps} con técnica correcta y RIR ≥ 2`;
}
