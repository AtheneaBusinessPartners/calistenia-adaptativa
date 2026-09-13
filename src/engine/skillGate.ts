import type {
  AssessmentEntry,
  CapabilityProfile,
  RequirementStatus,
  Skill,
  SkillGateResult,
} from "./types.js";

function statusForRequirement(
  requirement: Skill["requirements"][number],
  assessment: AssessmentEntry[],
  capabilityProfile: CapabilityProfile,
): RequirementStatus {
  let currentValue = 0;
  const targetValue = requirement.minValue;

  if (requirement.type === "exercise") {
    const entry = assessment.find((a) => a.exerciseId === requirement.exerciseId);
    currentValue = requirement.metric === "seconds" ? entry?.seconds ?? 0 : entry?.reps ?? 0;
  } else {
    currentValue = capabilityProfile[requirement.capabilityId] ?? 0;
  }

  const progressRatio = targetValue > 0 ? Math.min(currentValue / targetValue, 1) : 1;
  const met = currentValue >= targetValue;
  const gap = Math.max(targetValue - currentValue, 0);

  return { requirement, met, currentValue, targetValue, gap, progressRatio };
}

/**
 * Evalúa una skill contra el estado actual del usuario (§11, §32 del brief).
 * `overallReadiness` es una media ponderada por `importance` de
 * `progressRatio` — como las importances de una skill suman 1.0, es
 * directamente interpretable como "% de camino recorrido".
 *
 * `limitations` son los requisitos no cumplidos, ordenados por
 * `importance × (1 - progressRatio)` descendente: prioriza lo que más pesa
 * Y lo que más falta, no simplemente el primero de la lista (§11).
 */
export function evaluateSkillGate(
  skill: Skill,
  assessment: AssessmentEntry[],
  capabilityProfile: CapabilityProfile,
): SkillGateResult {
  const requirementStatuses = skill.requirements.map((r) => statusForRequirement(r, assessment, capabilityProfile));

  const overallReadiness = requirementStatuses.reduce(
    (sum, s) => sum + s.progressRatio * s.requirement.importance,
    0,
  );

  const limitations = requirementStatuses
    .filter((s) => !s.met)
    .sort((a, b) => {
      const priorityA = a.requirement.importance * (1 - a.progressRatio);
      const priorityB = b.requirement.importance * (1 - b.progressRatio);
      return priorityB - priorityA;
    });

  return {
    skill,
    requirementStatuses,
    overallReadiness,
    metCount: requirementStatuses.filter((s) => s.met).length,
    totalCount: requirementStatuses.length,
    limitations,
  };
}

export function explainLimitation(status: RequirementStatus): string {
  const pct = Math.round(status.progressRatio * 100);
  return `${status.requirement.label}: ${pct}% del objetivo (${status.currentValue}/${status.targetValue})`;
}
