// Tipos del dominio — FASE 1 (el cerebro). Ver docs/architecture-v1.md.

export type CapabilityId =
  | "pull"
  | "push"
  | "core"
  | "legs"
  | "balance"
  | "mobility"
  | "explosiveness";

export interface Capability {
  id: CapabilityId;
  name: string;
  description: string;
}

export type MuscleGroup =
  | "back"
  | "arms"
  | "shoulders"
  | "chest"
  | "core"
  | "legs";

export interface Muscle {
  id: string;
  name: string;
  group: MuscleGroup;
}

export type MovementPatternId =
  | "vertical_pull"
  | "horizontal_pull"
  | "vertical_push"
  | "horizontal_push"
  | "squat"
  | "hinge"
  | "core_flexion"
  | "core_anti_extension"
  | "isometric_support"
  | "balance_hold";

export interface MovementPattern {
  id: MovementPatternId;
  name: string;
  description: string;
}

export type EquipmentId =
  | "none"
  | "pullup_bar"
  | "parallettes"
  | "rings"
  | "bands"
  | "dumbbells"
  | "kettlebell"
  | "barbell"
  | "plates"
  | "bench"
  | "pulley_machine"
  | "gym_machine"
  | "weight_vest";

export interface Equipment {
  id: EquipmentId;
  name: string;
}

export type ExerciseCategory = "push" | "pull" | "legs" | "core" | "skill";

export type MasteryCriteria =
  | { type: "sets_x_reps"; sets: number; reps: number }
  | { type: "time"; seconds: number };

export interface Exercise {
  id: string;
  name: string;
  altNames?: string[];
  category: ExerciseCategory;
  movementPattern: MovementPatternId;
  difficulty: number; // 1-10, relativo a la cadena a la que pertenece
  primaryMuscles: string[]; // Muscle.id[]
  secondaryMuscles?: string[]; // Muscle.id[]
  equipment: EquipmentId[]; // material imprescindible (vacío o ["none"] = calistenia pura)
  capabilitiesDeveloped: Partial<Record<CapabilityId, number>>; // peso 0-1
  relatedSkills?: string[]; // Skill.id[]
  regressions?: string[]; // Exercise.id[] más fáciles
  progressions?: string[]; // Exercise.id[] más difíciles
  masteryCriteria: MasteryCriteria;
  recommendedSets: number;
  recommendedReps?: string; // rango en texto, p.ej. "6-8"
  recommendedTime?: string; // p.ej. "20-30s"
  restSeconds: number;
  rpeTarget?: string; // p.ej. "RPE 7-8" o "RIR 2-3"
  tempo?: string;
  technicalCues: string[];
  commonErrors: string[];
  risks?: string[];
  tags?: string[];
  imageUrl?: string;
  videoUrl?: string;
}

export type SkillRequirement =
  | {
      type: "exercise";
      exerciseId: string;
      metric: "reps" | "seconds";
      minValue: number;
      label: string;
      importance: number; // 0-1
    }
  | {
      type: "capability";
      capabilityId: CapabilityId;
      minValue: number; // 0-100
      label: string;
      importance: number; // 0-1
    };

export interface Skill {
  id: string;
  name: string;
  category: ExerciseCategory;
  description: string;
  difficultyTier: 1 | 2 | 3 | 4 | 5;
  requirements: SkillRequirement[];
  finalExerciseId?: string; // ejercicio que "es" la skill, si existe (p.ej. muscle_up)
}

export type ExperienceLevel = "none" | "beginner" | "intermediate" | "advanced";

export type ActivityLevel = "sedentary" | "light" | "moderate" | "active";

export type GoalId =
  | "strength"
  | "muscle_mass"
  | "fat_loss"
  | "conditioning"
  | "learn_skills"
  | "mobility"
  | "explosiveness"
  | "endurance"
  | "competition"
  | "specific_skill";

export interface UserProfile {
  age: number;
  sex: "male" | "female" | "other";
  heightCm: number;
  weightKg: number;
  trainingExperienceYears: number;
  calisthenicsExperience: ExperienceLevel;
  sleepHoursAvg: number;
  activityLevel: ActivityLevel;
  goals: GoalId[];
  primaryGoal: GoalId;
  primarySkillTarget?: string; // Skill.id, si primaryGoal === "specific_skill" o similar
  daysPerWeek: number;
  /** Días de la semana en los que prefiere entrenar — 0=domingo..6=sábado
   * (mismo criterio que `Date#getUTCDay()`), para que el calendario
   * (FASE 4) pueda marcar qué días concretos tocan sin que el motor tenga
   * que saber nada de fechas reales. Opcional: no afecta a
   * generateWeeklyPlan (que solo genera `daysPerWeek` días de plantilla,
   * sin atarlos a un día de calendario — ver planForToday.ts), solo a la
   * UI del calendario. */
  trainingDays?: number[];
  sessionDurationMinutes: number;
  minSessionDurationMinutes: number;
  equipment: EquipmentId[];
}

export interface AssessmentEntry {
  exerciseId: string;
  reps?: number;
  sets?: number;
  seconds?: number;
}

export type CapabilityProfile = Record<CapabilityId, number>; // 0-100 cada una

export interface ChainMasteryResult {
  movementPattern: MovementPatternId;
  masteredExerciseId: string | null; // el más avanzado dominado
  masteredExercise: Exercise | null;
  chainRank: number; // 0-1, posición en la cadena
  nextExerciseId: string | null; // siguiente paso no dominado
}

export interface RequirementStatus {
  requirement: SkillRequirement;
  met: boolean;
  currentValue: number;
  targetValue: number;
  gap: number; // targetValue - currentValue, 0 si met
  progressRatio: number; // currentValue/targetValue clamp 0-1
}

export interface SkillGateResult {
  skill: Skill;
  requirementStatuses: RequirementStatus[];
  overallReadiness: number; // 0-1, media ponderada por importance
  metCount: number;
  totalCount: number;
  limitations: RequirementStatus[]; // no cumplidos, ordenados por prioridad desc
}

export interface UserContext {
  profile: UserProfile;
  assessment: AssessmentEntry[];
  capabilityProfile: CapabilityProfile;
  fatigueByMuscle?: Partial<Record<string, number>>; // 0-100, hook para FASE 3
  painZones?: string[]; // Muscle.id[] con dolor activo, no solo fatiga
}

export interface ExerciseScoreBreakdown {
  exerciseId: string;
  total: number;
  skillRelevance: number;
  capabilityFit: number;
  levelCompatibility: number;
  goalRelevance: number;
  progressionReadiness: number;
  preference: number;
  fatigueDamping: number; // 0.1-1, cuánto se ha reducido `total` por fatiga muscular (1 = sin reducir)
  gated: boolean; // true si equipmentGate/painGate lo anuló (la fatiga amortigua, no anula — ver §3 de architecture-v3)
  gateReason?: string;
}

export type ProgressionDecision =
  | "MAINTAIN"
  | "INCREASE_REPS"
  | "INCREASE_TIME"
  | "ADVANCE_PROGRESSION"
  | "REGRESS"
  | "DELOAD_CANDIDATE";

export interface ProgressionResult {
  exerciseId: string;
  decision: ProgressionDecision;
  reasons: string[];
  nextCriteriaToWatch: string[];
}

// ---- FASE 3: motor de fatiga ----

export interface PerformedExercise {
  exerciseId: string;
  sets: number;
  reps?: number;
  seconds?: number;
  rir?: number; // reps in reserve reportadas; ausente = asumir esfuerzo moderado
}

/** Un día de entrenamiento ya realizado. `daysAgo` es relativo a "hoy" (0),
 * no una fecha real — evita atar el motor a un reloj hasta que exista
 * persistencia real en FASE 4. */
export interface TrainingDay {
  daysAgo: number;
  exercises: PerformedExercise[];
}

export type FeelingLevel = "very_tired" | "tired" | "normal" | "good" | "excellent";
export type SleepQuality = "poor" | "fair" | "good";
export type LevelRating = "low" | "medium" | "high";
export type PainSeverity = "mild" | "moderate" | "severe";

/** Check-in antes de entrenar (§15 del brief). `fatigueZones` y `painZones`
 * se mantienen deliberadamente separados: la fatiga se amortigua, el dolor
 * bloquea (ver docs/architecture-v3-fatigue-engine.md §2). */
export interface CheckIn {
  feeling: FeelingLevel;
  sleepQuality: SleepQuality;
  stress: LevelRating;
  motivation: LevelRating;
  fatigueZones?: string[]; // Muscle.id[]
  painZones?: string[]; // Muscle.id[]
  painSeverity?: PainSeverity;
}
