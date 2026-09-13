import type { SupabaseClient } from "@supabase/supabase-js";
import { computeCapabilityProfile } from "../engine/capabilityProfile.js";
import { evaluateSkillGate } from "../engine/skillGate.js";
import type { SelectorContext } from "../engine/exerciseSelector.js";
import { generateWeeklyPlan, type DayPlan } from "../engine/weeklyPlan.js";
import { EXERCISES, EXERCISES_BY_ID } from "../data/exercises.js";
import { SKILLS_BY_ID } from "../data/skills.js";
import type { CapabilityProfile, CheckIn, SkillGateResult, UserProfile } from "../engine/types.js";
import { getHistoryByExercise, getLatestAssessment, getTodayCheckIn, getTrainingLog } from "./repository.js";

export interface TodayContext {
  profile: UserProfile;
  capabilityProfile: CapabilityProfile;
  gate: SkillGateResult | null;
  today: DayPlan;
  weekPreview: DayPlan[];
  todayCheckIn: CheckIn | null;
}

/**
 * "Hoy" es siempre `plan.days[0]` — una simplificación deliberada del MVP
 * (ver docs/architecture-v4-app.md §7): rotar de verdad por el índice de
 * día de la plantilla exigiría rastrear en qué punto del ciclo semanal está
 * el usuario, y el check-in de FASE 3 solo se aplica al día 0 del plan que
 * se genera. Como la fatiga real ya varía la sesión de un día a otro
 * (probado extensamente en FASE 3), tratar cada visita como "genera la
 * mejor prioridad de hoy dado lo que ha pasado de verdad" sigue dando
 * variedad día a día sin la complejidad de rastrear el ciclo.
 */
export async function computeTodayContext(supabase: SupabaseClient, userId: string, profile: UserProfile): Promise<TodayContext> {
  const [assessment, trainingLog, historyByExercise, todayCheckIn] = await Promise.all([
    getLatestAssessment(supabase, userId),
    getTrainingLog(supabase, userId),
    getHistoryByExercise(supabase, userId),
    getTodayCheckIn(supabase, userId),
  ]);

  const capabilityProfile = computeCapabilityProfile(assessment, EXERCISES_BY_ID);
  const targetSkill = profile.primaryGoal === "specific_skill" && profile.primarySkillTarget ? SKILLS_BY_ID[profile.primarySkillTarget] : undefined;
  const gate = targetSkill ? evaluateSkillGate(targetSkill, assessment, capabilityProfile) : null;

  const ctx: SelectorContext = {
    user: { profile, assessment, capabilityProfile },
    targetSkill,
    limitations: gate?.limitations ?? [],
  };

  const plan = generateWeeklyPlan(EXERCISES, ctx, EXERCISES_BY_ID, profile.sessionDurationMinutes, profile.daysPerWeek, {
    trainingLog,
    historyByExercise,
    todayCheckIn: todayCheckIn ?? undefined,
  });

  return { profile, capabilityProfile, gate, today: plan.days[0]!, weekPreview: plan.days, todayCheckIn };
}
