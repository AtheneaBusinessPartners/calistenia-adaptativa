import type { CheckIn } from "./types.js";
import { MUSCLES } from "../data/muscles.js";

const FEELING_BUMP: Record<CheckIn["feeling"], number> = {
  very_tired: 20,
  tired: 10,
  normal: 0,
  good: -5,
  excellent: -10,
};

const SLEEP_BUMP: Record<CheckIn["sleepQuality"], number> = {
  poor: 10,
  fair: 3,
  good: 0,
};

const STRESS_BUMP: Record<CheckIn["stress"], number> = {
  low: 0,
  medium: 3,
  high: 8,
};

const SPECIFIC_ZONE_BUMP = 20;

/**
 * Ajusta la fatiga objetiva (computeMuscleFatigue) con la percepción
 * subjetiva del check-in (§14-15 del brief: la fatiga no es solo lo que
 * dicen los datos de entrenamiento). Es una suma acotada a 100, no una
 * sustitución: un check-in no puede hacer bajar la fatiga objetiva por
 * debajo de lo que el historial real ya indica, solo subirla.
 */
export function applyCheckInToFatigue(
  baseFatigue: Record<string, number>,
  checkIn: CheckIn,
): Record<string, number> {
  const globalBump = FEELING_BUMP[checkIn.feeling] + SLEEP_BUMP[checkIn.sleepQuality] + STRESS_BUMP[checkIn.stress];
  const result: Record<string, number> = { ...baseFatigue };

  // El bump global representa cansancio sistémico (mal sueño, estrés) que
  // no es específico de un músculo ya entrenado — recorre TODOS los
  // músculos conocidos, no solo los que ya tenían fatiga objetiva. Si solo
  // tocara `Object.keys(result)`, un usuario recién llegado sin ningún
  // historial ("muy cansado" pero fatigue={}) no vería ningún efecto en
  // absoluto, aunque su percepción subjetiva debería igualmente atenuar la
  // sesión de hoy.
  if (globalBump !== 0) {
    for (const muscle of MUSCLES) {
      result[muscle.id] = clamp((result[muscle.id] ?? 0) + globalBump);
    }
  }
  for (const muscleId of checkIn.fatigueZones ?? []) {
    result[muscleId] = clamp((result[muscleId] ?? 0) + SPECIFIC_ZONE_BUMP);
  }

  return result;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export interface SafetyAdvice {
  shouldWarn: boolean;
  message?: string;
}

/**
 * El dolor no se trata como fatiga (§15): si el check-in reporta dolor
 * moderado o severo, se devuelve una recomendación de precaución explícita
 * para mostrar en la UI (FASE 4) — el motor no decide "es solo un tirón,
 * sigue entrenando". Las zonas de dolor se gestionan aparte, vía
 * `UserContext.painZones` (gate duro en exerciseSelector.ts), no aquí.
 */
export function checkInSafetyMessage(checkIn: CheckIn): SafetyAdvice {
  if (!checkIn.painZones || checkIn.painZones.length === 0) {
    return { shouldWarn: false };
  }
  if (checkIn.painSeverity === "moderate" || checkIn.painSeverity === "severe") {
    return {
      shouldWarn: true,
      message:
        "Has indicado dolor (no solo fatiga) de intensidad " +
        (checkIn.painSeverity === "severe" ? "severa" : "moderada") +
        ". No se recomienda entrenar esa zona hoy; si persiste o empeora, consulta con un profesional sanitario.",
    };
  }
  return {
    shouldWarn: true,
    message: "Has indicado una molestia leve. Se evitarán ejercicios que carguen esa zona; vigila si aumenta durante la sesión.",
  };
}
