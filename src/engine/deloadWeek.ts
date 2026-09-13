import type { CheckIn, Exercise, TrainingDay } from "./types.js";
import { computeMuscleFatigue } from "./fatigueEngine.js";
import { decideProgression, type SessionLogEntry } from "./progression.js";
import type { WeeklyPlan } from "./weeklyPlan.js";

// Grupos musculares "grandes" (§24 del brief): su fatiga sostenida es la
// señal más fiable de acumulación real, más que cualquier músculo pequeño
// aislado que se recupera rápido de todos modos.
const LARGE_MUSCLE_GROUPS = ["lats", "chest", "quads", "hamstrings"];
const LARGE_MUSCLE_FATIGUE_THRESHOLD = 65;
const DELOAD_CANDIDATE_COUNT_THRESHOLD = 2;
const CHECK_IN_WINDOW = 3;
const POOR_SLEEP_STREAK_THRESHOLD = 2;
const LOW_MOTIVATION_STREAK_THRESHOLD = 2;

export interface DeloadWeekSignal {
  recommend: boolean;
  reasons: string[];
}

export interface DeloadWeekInputs {
  trainingLog: TrainingDay[];
  exercisesById: Record<string, Exercise>;
  exercisesInProgress: { exercise: Exercise; history: SessionLogEntry[] }[];
  recentCheckIns?: CheckIn[]; // más reciente al final
}

/**
 * Semana de descarga (§24 del brief) — señal AGREGADA de toda la semana,
 * distinta del `DELOAD_CANDIDATE` de `progression.ts` (que es por ejercicio
 * y por sesión). Varias señales locales coincidiendo, o fatiga sostenida en
 * los grupos grandes, o sueño/motivación deficientes de forma repetida, son
 * la evidencia de que hace falta descargar toda la semana, no solo bajar el
 * volumen de un ejercicio concreto.
 */
export function shouldRecommendDeloadWeek(inputs: DeloadWeekInputs): DeloadWeekSignal {
  const reasons: string[] = [];

  // MÁXIMO entre los grupos grandes, no la media: un split que carga mucho
  // tirón y poco pierna (o viceversa) no debe diluir una fatiga real y alta
  // en un solo grupo con grupos que ese día simplemente no tocaba (mismo
  // principio que exerciseFatigueLoad — ver el hallazgo en el repaso de
  // esta fase). Un solo grupo grande sostenido por encima del umbral ya es
  // motivo suficiente de descarga.
  const fatigue = computeMuscleFatigue(inputs.trainingLog, inputs.exercisesById);
  const largeMuscleFatigues = LARGE_MUSCLE_GROUPS.map((m) => fatigue[m] ?? 0);
  const maxLargeMuscleFatigue = Math.max(...largeMuscleFatigues);
  if (maxLargeMuscleFatigue >= LARGE_MUSCLE_FATIGUE_THRESHOLD) {
    const worstMuscle = LARGE_MUSCLE_GROUPS[largeMuscleFatigues.indexOf(maxLargeMuscleFatigue)];
    reasons.push(
      `Fatiga de "${worstMuscle}" en ${Math.round(maxLargeMuscleFatigue)}/100, por encima del umbral de descarga.`,
    );
  }

  const deloadCandidateCount = inputs.exercisesInProgress.filter(
    ({ exercise, history }) => decideProgression(exercise, history).decision === "DELOAD_CANDIDATE",
  ).length;
  if (deloadCandidateCount >= DELOAD_CANDIDATE_COUNT_THRESHOLD) {
    reasons.push(`${deloadCandidateCount} ejercicios en curso muestran rendimiento en caída con esfuerzo alto sostenido a la vez.`);
  }

  const recentCheckIns = (inputs.recentCheckIns ?? []).slice(-CHECK_IN_WINDOW);
  const poorSleepStreak = recentCheckIns.filter((c) => c.sleepQuality === "poor").length;
  if (poorSleepStreak >= POOR_SLEEP_STREAK_THRESHOLD) {
    reasons.push("Sueño deficiente reportado en varios check-ins recientes.");
  }
  const lowMotivationStreak = recentCheckIns.filter((c) => c.motivation === "low").length;
  if (lowMotivationStreak >= LOW_MOTIVATION_STREAK_THRESHOLD) {
    reasons.push("Motivación baja reportada de forma sostenida en varios check-ins.");
  }

  return { recommend: reasons.length > 0, reasons };
}

const DELOAD_WEEK_SET_FACTOR = 0.6;

/**
 * Transforma un plan semanal YA generado reduciendo las series de todos sus
 * bloques — no genera un plan nuevo desde cero, para no duplicar la lógica
 * de selección de ejercicios que ya vive en `weeklyPlan.ts`.
 */
export function applyDeloadWeek(plan: WeeklyPlan): WeeklyPlan {
  return {
    ...plan,
    days: plan.days.map((day) => ({
      ...day,
      blocks: day.blocks.map((block) => ({
        ...block,
        sets: Math.max(1, Math.round(block.sets * DELOAD_WEEK_SET_FACTOR)),
      })),
    })),
  };
}
