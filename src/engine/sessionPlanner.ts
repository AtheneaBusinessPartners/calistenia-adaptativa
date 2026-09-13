import type { Exercise } from "./types.js";
import { decideProgression, type SessionLogEntry } from "./progression.js";
import { parseLowEnd } from "./rangeText.js";

export interface NextSessionPrescription {
  exerciseId: string;
  sets: number;
  targetReps?: number;
  targetSeconds?: number;
  note: string;
}

const REP_INCREMENT = 1;
const TIME_INCREMENT_SECONDS = 3;
const DELOAD_SET_FACTOR = 0.6;

function baselineTarget(exercise: Exercise): Pick<NextSessionPrescription, "targetReps" | "targetSeconds"> {
  if (exercise.masteryCriteria.type === "time") {
    return { targetSeconds: parseLowEnd(exercise.recommendedTime) ?? Math.round(exercise.masteryCriteria.seconds * 0.6) };
  }
  return { targetReps: parseLowEnd(exercise.recommendedReps) ?? Math.max(1, exercise.masteryCriteria.reps - 3) };
}

function lastTarget(exercise: Exercise, history: SessionLogEntry[]): Pick<NextSessionPrescription, "targetReps" | "targetSeconds"> {
  const last = history[history.length - 1];
  if (!last) return baselineTarget(exercise);
  if (exercise.masteryCriteria.type === "time") {
    return { targetSeconds: last.seconds ?? baselineTarget(exercise).targetSeconds };
  }
  return { targetReps: last.reps ?? baselineTarget(exercise).targetReps };
}

/**
 * Traduce la decisión cualitativa de `decideProgression` (FASE 1) en una
 * prescripción numérica concreta para la PRÓXIMA sesión (§13 del brief: el
 * 3×5→3×6→3×7→3×8 real, sesión a sesión, no una tabla fija por semanas).
 * `exercisesById` se necesita para resolver el ejercicio de destino cuando
 * la decisión es avanzar o regresar de línea.
 */
export function planNextSession(
  exercise: Exercise,
  history: SessionLogEntry[],
  exercisesById: Record<string, Exercise>,
): NextSessionPrescription {
  const decision = decideProgression(exercise, history);
  const last = lastTarget(exercise, history);

  switch (decision.decision) {
    case "INCREASE_REPS":
      return {
        exerciseId: exercise.id,
        sets: exercise.recommendedSets,
        targetReps: (last.targetReps ?? 0) + REP_INCREMENT,
        note: `Sube a ${(last.targetReps ?? 0) + REP_INCREMENT} reps manteniendo la técnica.`,
      };

    case "INCREASE_TIME":
      return {
        exerciseId: exercise.id,
        sets: exercise.recommendedSets,
        targetSeconds: (last.targetSeconds ?? 0) + TIME_INCREMENT_SECONDS,
        note: `Sube a ${(last.targetSeconds ?? 0) + TIME_INCREMENT_SECONDS}s manteniendo la forma.`,
      };

    case "ADVANCE_PROGRESSION": {
      const nextId = exercise.progressions?.[0];
      const next = nextId ? exercisesById[nextId] : undefined;
      if (!next) {
        return { exerciseId: exercise.id, sets: exercise.recommendedSets, ...last, note: "Sin progresión definida: mantener." };
      }
      return {
        exerciseId: next.id,
        sets: next.recommendedSets,
        ...baselineTarget(next),
        note: `Listo para avanzar a "${next.name}" — empezar en el extremo bajo de su rango.`,
      };
    }

    case "REGRESS": {
      const prevId = exercise.regressions?.[0];
      const prev = prevId ? exercisesById[prevId] : undefined;
      if (!prev) {
        return { exerciseId: exercise.id, sets: exercise.recommendedSets, ...last, note: "Sin regresión definida: mantener con foco en técnica." };
      }
      return {
        exerciseId: prev.id,
        sets: prev.recommendedSets,
        ...baselineTarget(prev),
        note: `Bajar a "${prev.name}" para consolidar la técnica antes de reintentar.`,
      };
    }

    case "DELOAD_CANDIDATE":
      return {
        exerciseId: exercise.id,
        sets: Math.max(1, Math.round(exercise.recommendedSets * DELOAD_SET_FACTOR)),
        ...last,
        note: "Sesión de descarga: mismo objetivo, series reducidas para permitir recuperar.",
      };

    case "MAINTAIN":
    default:
      return {
        exerciseId: exercise.id,
        sets: exercise.recommendedSets,
        ...last,
        note: "Mantener la misma prescripción que la última sesión.",
      };
  }
}
