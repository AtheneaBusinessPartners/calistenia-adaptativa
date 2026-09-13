import type {
  Exercise,
  ExerciseScoreBreakdown,
  RequirementStatus,
  Skill,
  UserContext,
} from "./types.js";
import { estimateMovementFrontier, exerciseProgressRatio } from "./capabilityProfile.js";
import { GOAL_CAPABILITY_MAP, SCORING_WEIGHTS } from "./scoringWeights.js";
import { EXERCISES_BY_ID } from "../data/exercises.js";
import type { CapabilityId } from "./types.js";

export interface SelectorContext {
  user: UserContext;
  targetSkill?: Skill;
  limitations: RequirementStatus[]; // de evaluateSkillGate(targetSkill), no cumplidos
}

function equipmentGate(exercise: Exercise, userEquipment: string[]): boolean {
  const required = exercise.equipment.filter((e) => e !== "none");
  if (required.length === 0) return true;
  return required.every((e) => userEquipment.includes(e));
}

function painGate(exercise: Exercise, painZones: string[] | undefined): boolean {
  if (!painZones || painZones.length === 0) return true;
  const muscles = [...exercise.primaryMuscles, ...(exercise.secondaryMuscles ?? [])];
  return !muscles.some((m) => painZones.includes(m));
}

function skillRelevance(exercise: Exercise, targetSkill: Skill | undefined): number {
  if (!targetSkill) return 0;
  const isDirectRequirement = targetSkill.requirements.some(
    (r) => r.type === "exercise" && r.exerciseId === exercise.id,
  );
  if (isDirectRequirement || targetSkill.finalExerciseId === exercise.id) return 1;
  if (exercise.relatedSkills?.includes(targetSkill.id)) return 0.5;
  return 0;
}

function capabilityFit(exercise: Exercise, limitations: RequirementStatus[]): number {
  if (limitations.length === 0) return 0;
  let score = 0;
  for (const limitation of limitations) {
    // Qué capacidades hay que atacar para cerrar ESTE requisito concreto:
    // si el requisito es de capacidad, es esa capacidad; si es de ejercicio,
    // son las capacidades que desarrolla el ejercicio exigido por el
    // requisito (no las del candidato que estamos puntuando — comparamos
    // "¿esto entrena lo mismo que lo que le falta?", no "¿esto entrena algo?").
    const relevantCapabilities: CapabilityId[] =
      limitation.requirement.type === "capability"
        ? [limitation.requirement.capabilityId]
        : (Object.keys(EXERCISES_BY_ID[limitation.requirement.exerciseId]?.capabilitiesDeveloped ?? {}) as CapabilityId[]);
    const bestWeight = Math.max(0, ...relevantCapabilities.map((c) => exercise.capabilitiesDeveloped[c] ?? 0));
    score += limitation.requirement.importance * bestWeight;
  }
  return Math.min(score, 1);
}

function levelCompatibility(exercise: Exercise, user: UserContext): number {
  const frontier = estimateMovementFrontier(exercise.movementPattern, user.assessment, EXERCISES_BY_ID);
  const alreadyMastered = exerciseProgressRatio(exercise, user.assessment) >= 1;
  if (alreadyMastered) return 0.3; // sigue siendo válido para mantenimiento, pero no es prioridad
  const distanceFromNextStep = Math.abs(exercise.difficulty - (frontier + 1.5));
  return Math.max(0, 1 - distanceFromNextStep / 5);
}

/**
 * §31 del brief: si el usuario marcó varios objetivos, se priorizan en el
 * orden en que los puso (primaryGoal primero, luego el resto de `goals` en
 * su orden), con un peso que decae por rango (1, 1/2, 1/3...) — el objetivo
 * principal domina, pero los secundarios siguen empujando un poco el
 * ranking en vez de desaparecer. `specific_skill` no aporta nada aquí
 * (su relevancia ya se mide en `skillRelevance`, vía el requisito/target
 * concreto) — sumarlo también aquí sería contar la misma prioridad dos veces.
 */
function goalRelevance(exercise: Exercise, user: UserContext): number {
  const orderedGoals = [
    user.profile.primaryGoal,
    ...user.profile.goals.filter((g) => g !== user.profile.primaryGoal),
  ];

  let weightedScore = 0;
  let totalWeight = 0;
  orderedGoals.forEach((goal, rank) => {
    const weight = 1 / (rank + 1);
    const capabilities = GOAL_CAPABILITY_MAP[goal] ?? [];
    if (capabilities.length === 0) return; // p.ej. "specific_skill": no aplica aquí
    totalWeight += weight;
    weightedScore += weight * Math.max(0, ...capabilities.map((c) => exercise.capabilitiesDeveloped[c] ?? 0));
  });

  return totalWeight > 0 ? weightedScore / totalWeight : 0;
}

function progressionReadiness(exercise: Exercise, user: UserContext): number {
  const ratio = exerciseProgressRatio(exercise, user.assessment);
  if (ratio >= 1) return 0.2; // dominado: ya no es "el siguiente paso"
  const regressions = exercise.regressions ?? [];
  if (regressions.length === 0) return 0.7; // ejercicio base de la cadena, siempre accesible
  const regressionsMastered = regressions.every((rid) => {
    const regressionExercise = EXERCISES_BY_ID[rid];
    return regressionExercise ? exerciseProgressRatio(regressionExercise, user.assessment) >= 1 : false;
  });
  return regressionsMastered ? 1 : 0.3;
}

export function scoreExercise(exercise: Exercise, ctx: SelectorContext): ExerciseScoreBreakdown {
  if (!equipmentGate(exercise, ctx.user.profile.equipment)) {
    return zeroScore(exercise.id, "Falta material requerido");
  }
  if (!painGate(exercise, ctx.user.painZones)) {
    return zeroScore(exercise.id, "Afecta a una zona con dolor activo");
  }

  const sr = skillRelevance(exercise, ctx.targetSkill);
  const cf = capabilityFit(exercise, ctx.limitations);
  const lc = levelCompatibility(exercise, ctx.user);
  const gr = goalRelevance(exercise, ctx.user);
  const pr = progressionReadiness(exercise, ctx.user);
  const pref = 0.5; // stub: preferencia declarada/aprendida, no implementada en FASE1

  const total =
    SCORING_WEIGHTS.skillRelevance * sr +
    SCORING_WEIGHTS.capabilityFit * cf +
    SCORING_WEIGHTS.levelCompatibility * lc +
    SCORING_WEIGHTS.goalRelevance * gr +
    SCORING_WEIGHTS.progressionReadiness * pr +
    SCORING_WEIGHTS.preference * pref;

  return {
    exerciseId: exercise.id,
    total,
    skillRelevance: sr,
    capabilityFit: cf,
    levelCompatibility: lc,
    goalRelevance: gr,
    progressionReadiness: pr,
    preference: pref,
    gated: false,
  };
}

function zeroScore(exerciseId: string, reason: string): ExerciseScoreBreakdown {
  return {
    exerciseId,
    total: 0,
    skillRelevance: 0,
    capabilityFit: 0,
    levelCompatibility: 0,
    goalRelevance: 0,
    progressionReadiness: 0,
    preference: 0,
    gated: true,
    gateReason: reason,
  };
}

export function rankExercises(exercises: Exercise[], ctx: SelectorContext): ExerciseScoreBreakdown[] {
  return exercises
    .map((e) => scoreExercise(e, ctx))
    .filter((s) => !s.gated)
    .sort((a, b) => b.total - a.total);
}
