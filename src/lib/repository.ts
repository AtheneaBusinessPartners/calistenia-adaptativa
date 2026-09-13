import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssessmentEntry, CheckIn, TrainingDay, UserProfile } from "../engine/types.js";
import type { SessionLogEntry } from "../engine/progression.js";

// Capa de mapeo filas <-> tipos del motor (ver docs/architecture-v4-app.md
// §4). Solo SELECT/INSERT y transformación de forma — ninguna decisión de
// negocio vive aquí, todas siguen en src/engine.

export async function getProfile(supabase: SupabaseClient, userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return {
    age: data.age,
    sex: data.sex,
    heightCm: data.height_cm,
    weightKg: data.weight_kg,
    trainingExperienceYears: data.training_experience_years,
    calisthenicsExperience: data.calisthenics_experience,
    sleepHoursAvg: data.sleep_hours_avg,
    activityLevel: data.activity_level,
    daysPerWeek: data.days_per_week,
    sessionDurationMinutes: data.session_duration_minutes,
    minSessionDurationMinutes: data.min_session_duration_minutes,
    equipment: data.equipment,
    goals: data.goals,
    primaryGoal: data.primary_goal,
    primarySkillTarget: data.primary_skill_target ?? undefined,
  };
}

export async function upsertProfile(supabase: SupabaseClient, userId: string, profile: UserProfile): Promise<void> {
  const { error } = await supabase.from("profiles").upsert({
    id: userId,
    age: profile.age,
    sex: profile.sex,
    height_cm: profile.heightCm,
    weight_kg: profile.weightKg,
    training_experience_years: profile.trainingExperienceYears,
    calisthenics_experience: profile.calisthenicsExperience,
    sleep_hours_avg: profile.sleepHoursAvg,
    activity_level: profile.activityLevel,
    days_per_week: profile.daysPerWeek,
    session_duration_minutes: profile.sessionDurationMinutes,
    min_session_duration_minutes: profile.minSessionDurationMinutes,
    equipment: profile.equipment,
    goals: profile.goals,
    primary_goal: profile.primaryGoal,
    primary_skill_target: profile.primarySkillTarget ?? null,
  });
  if (error) throw error;
}

/** La evaluación "actual" de cada ejercicio es su fila más reciente. */
export async function getLatestAssessment(supabase: SupabaseClient, userId: string): Promise<AssessmentEntry[]> {
  const { data, error } = await supabase
    .from("assessment_entries")
    .select("exercise_id, reps, seconds, assessed_at")
    .eq("user_id", userId)
    .order("assessed_at", { ascending: false });
  if (error) throw error;

  const latestByExercise = new Map<string, AssessmentEntry>();
  for (const row of data ?? []) {
    if (!latestByExercise.has(row.exercise_id)) {
      latestByExercise.set(row.exercise_id, {
        exerciseId: row.exercise_id,
        reps: row.reps ?? undefined,
        seconds: row.seconds ?? undefined,
      });
    }
  }
  return Array.from(latestByExercise.values());
}

export async function insertAssessmentEntries(supabase: SupabaseClient, userId: string, entries: AssessmentEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const { error } = await supabase.from("assessment_entries").insert(
    entries.map((e) => ({ user_id: userId, exercise_id: e.exerciseId, reps: e.reps ?? null, seconds: e.seconds ?? null })),
  );
  if (error) throw error;
}

/**
 * `TrainingDay[]` real (§4 del doc): agrupa `training_session_sets` por
 * sesión y calcula `daysAgo` contra la fecha de hoy — el mismo contrato que
 * `computeMuscleFatigue` ya esperaba desde FASE 3, ahora con fechas reales
 * en vez de tener que envejecerlo a mano entre llamadas.
 */
export async function getTrainingLog(supabase: SupabaseClient, userId: string, sinceDays = 21): Promise<TrainingDay[]> {
  const since = new Date();
  since.setDate(since.getDate() - sinceDays);

  const { data, error } = await supabase
    .from("training_sessions")
    .select("id, performed_at, training_session_sets(exercise_id, sets, reps, seconds, rir)")
    .eq("user_id", userId)
    .gte("performed_at", since.toISOString().slice(0, 10));
  if (error) throw error;

  const today = startOfDay(new Date());

  return (data ?? []).map((session) => ({
    daysAgo: Math.max(0, daysBetween(startOfDay(new Date(session.performed_at)), today)),
    exercises: (session.training_session_sets ?? []).map((s: { exercise_id: string; sets: number; reps: number | null; seconds: number | null; rir: number | null }) => ({
      exerciseId: s.exercise_id,
      sets: s.sets,
      reps: s.reps ?? undefined,
      seconds: s.seconds ?? undefined,
      rir: s.rir ?? undefined,
    })),
  }));
}

/** `Record<exerciseId, SessionLogEntry[]>` en orden cronológico — lo que
 * `sessionPlanner.planNextSession`/`decideProgression` esperan como historial. */
export async function getHistoryByExercise(
  supabase: SupabaseClient,
  userId: string,
  sinceDays = 90,
): Promise<Record<string, SessionLogEntry[]>> {
  const since = new Date();
  since.setDate(since.getDate() - sinceDays);

  const { data, error } = await supabase
    .from("training_sessions")
    .select("performed_at, training_session_sets(exercise_id, reps, seconds, rir, technique_ok)")
    .eq("user_id", userId)
    .gte("performed_at", since.toISOString().slice(0, 10))
    .order("performed_at", { ascending: true });
  if (error) throw error;

  const history: Record<string, SessionLogEntry[]> = {};
  for (const session of data ?? []) {
    for (const s of session.training_session_sets ?? []) {
      (history[s.exercise_id] ??= []).push({
        reps: s.reps ?? undefined,
        seconds: s.seconds ?? undefined,
        rir: s.rir ?? undefined,
        techniqueOk: s.technique_ok,
      });
    }
  }
  return history;
}

/**
 * Fechas (YYYY-MM-DD, tal cual las guarda `performed_at`) de las sesiones
 * de los últimos `sinceDays` días — para el calendario y las estadísticas
 * semanales/mensuales del dashboard (src/engine/trainingStats.ts). Puede
 * haber más de una fila el mismo día (antes de que existiera el guard de
 * `hasTrainingSessionToday`), de ahí el `Set` para no contar el día dos
 * veces.
 */
export async function getSessionDates(supabase: SupabaseClient, userId: string, sinceDays = 60): Promise<string[]> {
  const since = new Date();
  since.setDate(since.getDate() - sinceDays);

  const { data, error } = await supabase
    .from("training_sessions")
    .select("performed_at")
    .eq("user_id", userId)
    .gte("performed_at", since.toISOString().slice(0, 10));
  if (error) throw error;

  return Array.from(new Set((data ?? []).map((row) => row.performed_at as string)));
}

export async function countTrainingSessions(supabase: SupabaseClient, userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("training_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) throw error;
  return count ?? 0;
}

/**
 * Sin esto, revisitar /session tras haber entrenado hoy (botón atrás,
 * pestaña vieja) vuelve a mostrar el logger y permite registrar una segunda
 * sesión el mismo día — duplica la fatiga del día y ensucia el historial
 * que usa `sessionPlanner.planNextSession` para decidir la progresión.
 */
export async function hasTrainingSessionToday(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  const { count, error } = await supabase
    .from("training_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("performed_at", today);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function getTodayCheckIn(supabase: SupabaseClient, userId: string): Promise<CheckIn | null> {
  const todayStart = startOfDay(new Date()).toISOString();
  const { data, error } = await supabase
    .from("check_ins")
    .select("*")
    .eq("user_id", userId)
    .gte("created_at", todayStart)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return {
    feeling: data.feeling,
    sleepQuality: data.sleep_quality,
    stress: data.stress,
    motivation: data.motivation,
    fatigueZones: data.fatigue_zones ?? [],
    painZones: data.pain_zones ?? [],
    painSeverity: data.pain_severity ?? undefined,
  };
}

/**
 * `shouldRecommendDeloadWeek` (motor FASE 3) espera `recentCheckIns` con el
 * más reciente AL FINAL, para poder mirar solo los últimos N con `.slice(-N)`.
 */
export async function getRecentCheckIns(supabase: SupabaseClient, userId: string, limit = 5): Promise<CheckIn[]> {
  const { data, error } = await supabase
    .from("check_ins")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (data ?? []).reverse().map((row) => ({
    feeling: row.feeling,
    sleepQuality: row.sleep_quality,
    stress: row.stress,
    motivation: row.motivation,
    fatigueZones: row.fatigue_zones ?? [],
    painZones: row.pain_zones ?? [],
    painSeverity: row.pain_severity ?? undefined,
  }));
}

export async function insertCheckIn(supabase: SupabaseClient, userId: string, checkIn: CheckIn): Promise<void> {
  const { error } = await supabase.from("check_ins").insert({
    user_id: userId,
    feeling: checkIn.feeling,
    sleep_quality: checkIn.sleepQuality,
    stress: checkIn.stress,
    motivation: checkIn.motivation,
    fatigue_zones: checkIn.fatigueZones ?? [],
    pain_zones: checkIn.painZones ?? [],
    pain_severity: checkIn.painSeverity ?? null,
  });
  if (error) throw error;
}

export interface LoggedSet {
  exerciseId: string;
  sets: number;
  reps?: number;
  seconds?: number;
  rir?: number;
  techniqueOk: boolean;
}

export async function insertTrainingSession(
  supabase: SupabaseClient,
  userId: string,
  archetype: string | undefined,
  loggedSets: LoggedSet[],
): Promise<void> {
  const { data: session, error: sessionError } = await supabase
    .from("training_sessions")
    .insert({ user_id: userId, archetype: archetype ?? null })
    .select("id")
    .single();
  if (sessionError) throw sessionError;

  if (loggedSets.length === 0) return;
  const { error: setsError } = await supabase.from("training_session_sets").insert(
    loggedSets.map((s) => ({
      session_id: session.id,
      exercise_id: s.exerciseId,
      sets: s.sets,
      reps: s.reps ?? null,
      seconds: s.seconds ?? null,
      rir: s.rir ?? null,
      technique_ok: s.techniqueOk,
    })),
  );
  if (setsError) throw setsError;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}
