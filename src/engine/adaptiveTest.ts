import { MOVEMENT_CHAINS } from "../data/chains.js";
import { EXERCISES_BY_ID } from "../data/exercises.js";
import { exerciseProgressRatio } from "./capabilityProfile.js";
import type { AssessmentEntry } from "./types.js";

export interface AdaptiveTestStep {
  chainKey: string;
  exerciseId: string;
  index: number;
  length: number;
}

/**
 * Test adaptativo (§7 del brief): dado lo que el usuario ya ha respondido en
 * una cadena, decide cuál es el siguiente ejercicio a testear. Recorre la
 * cadena de más fácil a más difícil y ofrece el primero sin responder — la
 * cadena de datos ES el árbol de decisión, no hace falta escribirlo aparte
 * (ver docs/architecture-v1.md §5).
 */
export function nextAssessmentStep(chainKey: string, answeredSoFar: AssessmentEntry[]): AdaptiveTestStep | null {
  const chain = MOVEMENT_CHAINS[chainKey];
  if (!chain) return null;
  for (let i = 0; i < chain.length; i++) {
    const exerciseId = chain[i]!;
    if (answeredSoFar.some((a) => a.exerciseId === exerciseId)) continue;
    return { chainKey, exerciseId, index: i, length: chain.length };
  }
  return null; // cadena agotada
}

/**
 * Tras registrar una respuesta, decide si merece la pena seguir preguntando
 * por ejercicios más difíciles de esta cadena. Si el usuario no domina el
 * ejercicio que se le acaba de preguntar, no tiene sentido subir de nivel
 * (ejemplo del brief: si no hace una dominada, no preguntar por chest-to-bar).
 */
export function shouldStopChain(chainKey: string, answeredSoFar: AssessmentEntry[]): boolean {
  const chain = MOVEMENT_CHAINS[chainKey];
  if (!chain) return true;
  const lastAnswered = [...answeredSoFar].reverse().find((a) => chain.includes(a.exerciseId));
  if (!lastAnswered) return false;
  const exercise = EXERCISES_BY_ID[lastAnswered.exerciseId];
  if (!exercise) return false;
  return exerciseProgressRatio(exercise, answeredSoFar) < 1;
}

/**
 * Recorre una cadena completa simulando el test adaptativo contra un set de
 * respuestas ya conocido (útil para tests y para pre-rellenar cuando el
 * usuario ya aportó datos directamente, como en el escenario de §40).
 */
export function runAdaptiveChain(chainKey: string, knownAnswers: AssessmentEntry[]): AssessmentEntry[] {
  const asked: AssessmentEntry[] = [];
  let step = nextAssessmentStep(chainKey, asked);
  while (step) {
    const known = knownAnswers.find((a) => a.exerciseId === step!.exerciseId);
    if (!known) break; // no tenemos dato real para simular esta pregunta
    asked.push(known);
    if (shouldStopChain(chainKey, asked)) break;
    step = nextAssessmentStep(chainKey, asked);
  }
  return asked;
}
