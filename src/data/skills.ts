import type { Skill } from "../engine/types.js";

// Árboles de skills iniciales (§12 del brief). Cada requisito lleva
// `importance` (0-1) y la suma de importances de una skill es 1.0 — así
// `overallReadiness` en skillGate.ts es directamente una media ponderada
// interpretable como "% de camino recorrido hacia la skill".

export const SKILLS: Skill[] = [
  {
    id: "pull_up_skill",
    name: "Primera dominada",
    category: "pull",
    description: "Conseguir una dominada estricta completa.",
    difficultyTier: 1,
    finalExerciseId: "pull_up",
    requirements: [
      { type: "exercise", exerciseId: "dead_hang", metric: "seconds", minValue: 20, label: "Dead hang 20s", importance: 0.2 },
      { type: "exercise", exerciseId: "scapular_pull_up", metric: "reps", minValue: 8, label: "Scapular pull-up ×8", importance: 0.2 },
      { type: "exercise", exerciseId: "negative_pull_up", metric: "reps", minValue: 5, label: "Negativas de dominada ×5", importance: 0.3 },
      { type: "capability", capabilityId: "pull", minValue: 40, label: "Fuerza de tracción base", importance: 0.3 },
    ],
  },
  {
    id: "chin_up_skill",
    name: "Primer chin-up",
    category: "pull",
    description: "Conseguir un chin-up (agarre supino) estricto.",
    difficultyTier: 1,
    finalExerciseId: "chin_up",
    requirements: [
      { type: "exercise", exerciseId: "negative_pull_up", metric: "reps", minValue: 5, label: "Negativas ×5", importance: 0.4 },
      { type: "capability", capabilityId: "pull", minValue: 40, label: "Fuerza de tracción base", importance: 0.6 },
    ],
  },
  {
    id: "muscle_up",
    name: "Muscle-up",
    category: "skill",
    description: "Transición de dominada a dip por encima de la barra sin apoyo externo.",
    difficultyTier: 4,
    finalExerciseId: "muscle_up",
    requirements: [
      { type: "exercise", exerciseId: "pull_up", metric: "reps", minValue: 8, label: "Dominadas ×8", importance: 0.15 },
      { type: "exercise", exerciseId: "chest_to_bar_pull_up", metric: "reps", minValue: 3, label: "Chest-to-bar ×3", importance: 0.25 },
      { type: "exercise", exerciseId: "straight_bar_dip", metric: "reps", minValue: 8, label: "Dips en paralelas ×8", importance: 0.15 },
      { type: "exercise", exerciseId: "explosive_pull_up", metric: "reps", minValue: 3, label: "Dominada explosiva ×3", importance: 0.2 },
      { type: "capability", capabilityId: "explosiveness", minValue: 55, label: "Explosividad de tracción", importance: 0.15 },
      { type: "capability", capabilityId: "core", minValue: 50, label: "Control de core en la transición", importance: 0.1 },
    ],
  },
  {
    id: "handstand",
    name: "Handstand",
    category: "skill",
    description: "Equilibrio invertido libre, sin apoyo en pared.",
    difficultyTier: 3,
    finalExerciseId: "freestanding_handstand_hold",
    requirements: [
      { type: "exercise", exerciseId: "wall_handstand_hold_back_to_wall", metric: "seconds", minValue: 45, label: "Handstand en pared 45s", importance: 0.25 },
      { type: "exercise", exerciseId: "crow_pose", metric: "seconds", minValue: 20, label: "Crow pose 20s", importance: 0.25 },
      { type: "capability", capabilityId: "balance", minValue: 70, label: "Equilibrio invertido", importance: 0.35 },
      { type: "capability", capabilityId: "core", minValue: 40, label: "Control de core en vertical", importance: 0.15 },
    ],
  },
  {
    id: "handstand_push_up",
    name: "Handstand push-up",
    category: "skill",
    description: "Flexión completa en equilibrio invertido libre.",
    difficultyTier: 4,
    finalExerciseId: "freestanding_hspu",
    requirements: [
      { type: "exercise", exerciseId: "freestanding_handstand_hold", metric: "seconds", minValue: 30, label: "Handstand libre 30s", importance: 0.3 },
      { type: "exercise", exerciseId: "wall_hspu", metric: "reps", minValue: 5, label: "HSPU en pared ×5", importance: 0.3 },
      { type: "capability", capabilityId: "push", minValue: 65, label: "Fuerza de empuje vertical", importance: 0.25 },
      { type: "capability", capabilityId: "balance", minValue: 70, label: "Equilibrio invertido", importance: 0.15 },
    ],
  },
  {
    id: "l_sit_skill",
    name: "L-sit",
    category: "skill",
    description: "Mantener las piernas rectas y paralelas al suelo en apoyo de brazos.",
    difficultyTier: 2,
    finalExerciseId: "l_sit",
    requirements: [
      { type: "exercise", exerciseId: "hanging_leg_raise", metric: "reps", minValue: 10, label: "Elevación de piernas ×10", importance: 0.25 },
      { type: "exercise", exerciseId: "l_sit_tuck", metric: "seconds", minValue: 20, label: "L-sit tuck 20s", importance: 0.35 },
      { type: "capability", capabilityId: "core", minValue: 55, label: "Fuerza de core en flexión", importance: 0.4 },
    ],
  },
  {
    id: "v_sit_skill",
    name: "V-sit",
    category: "skill",
    description: "L-sit con las piernas elevadas por encima de la horizontal.",
    difficultyTier: 3,
    finalExerciseId: "v_sit",
    requirements: [
      { type: "exercise", exerciseId: "l_sit", metric: "seconds", minValue: 20, label: "L-sit 20s", importance: 0.4 },
      { type: "capability", capabilityId: "core", minValue: 80, label: "Fuerza de core avanzada", importance: 0.35 },
      { type: "capability", capabilityId: "mobility", minValue: 50, label: "Movilidad de isquiotibiales", importance: 0.25 },
    ],
  },
  {
    id: "front_lever",
    name: "Front lever",
    category: "skill",
    description: "Cuerpo horizontal en suspensión, palmas hacia abajo.",
    difficultyTier: 4,
    finalExerciseId: "front_lever_hold",
    requirements: [
      { type: "exercise", exerciseId: "pull_up", metric: "reps", minValue: 8, label: "Dominadas ×8", importance: 0.15 },
      { type: "exercise", exerciseId: "australian_row", metric: "reps", minValue: 12, label: "Australian row ×12", importance: 0.1 },
      { type: "exercise", exerciseId: "tuck_front_lever_hold", metric: "seconds", minValue: 15, label: "Front lever tuck 15s", importance: 0.25 },
      { type: "capability", capabilityId: "pull", minValue: 60, label: "Fuerza de tracción horizontal", importance: 0.25 },
      { type: "capability", capabilityId: "core", minValue: 55, label: "Control de core isométrico", importance: 0.25 },
    ],
  },
  {
    id: "back_lever",
    name: "Back lever",
    category: "skill",
    description: "Cuerpo horizontal en suspensión, palmas hacia atrás.",
    difficultyTier: 3,
    finalExerciseId: "back_lever_hold",
    requirements: [
      { type: "exercise", exerciseId: "pull_up", metric: "reps", minValue: 5, label: "Dominadas ×5", importance: 0.15 },
      { type: "exercise", exerciseId: "tuck_back_lever_hold", metric: "seconds", minValue: 15, label: "Back lever tuck 15s", importance: 0.35 },
      { type: "capability", capabilityId: "pull", minValue: 45, label: "Fuerza de tracción", importance: 0.2 },
      { type: "capability", capabilityId: "mobility", minValue: 40, label: "Movilidad de hombro (rotación externa)", importance: 0.15 },
      { type: "capability", capabilityId: "core", minValue: 45, label: "Control de core isométrico", importance: 0.15 },
    ],
  },
  {
    id: "planche",
    name: "Planche",
    category: "skill",
    description: "Cuerpo horizontal en apoyo de manos, sin apoyo de pies.",
    difficultyTier: 5,
    finalExerciseId: "full_planche_hold",
    requirements: [
      { type: "exercise", exerciseId: "straight_bar_dip", metric: "reps", minValue: 8, label: "Dips en paralelas ×8", importance: 0.1 },
      { type: "exercise", exerciseId: "planche_lean", metric: "seconds", minValue: 20, label: "Planche lean 20s", importance: 0.2 },
      { type: "exercise", exerciseId: "tuck_planche_hold", metric: "seconds", minValue: 10, label: "Planche tuck 10s", importance: 0.25 },
      { type: "capability", capabilityId: "push", minValue: 70, label: "Fuerza de empuje horizontal", importance: 0.25 },
      { type: "capability", capabilityId: "core", minValue: 55, label: "Control de core isométrico", importance: 0.2 },
    ],
  },
  {
    id: "pistol_squat_skill",
    name: "Pistol squat",
    category: "skill",
    description: "Sentadilla a una pierna con rango completo.",
    difficultyTier: 2,
    finalExerciseId: "pistol_squat",
    requirements: [
      { type: "exercise", exerciseId: "bulgarian_split_squat", metric: "reps", minValue: 10, label: "Bulgarian split squat ×10", importance: 0.25 },
      { type: "exercise", exerciseId: "shrimp_squat", metric: "reps", minValue: 6, label: "Shrimp squat ×6", importance: 0.35 },
      { type: "capability", capabilityId: "legs", minValue: 70, label: "Fuerza unilateral de piernas", importance: 0.25 },
      { type: "capability", capabilityId: "balance", minValue: 40, label: "Equilibrio unilateral", importance: 0.15 },
    ],
  },
  {
    id: "nordic_curl_skill",
    name: "Nordic curl",
    category: "skill",
    description: "Curl nórdico completo con control excéntrico y concéntrico.",
    difficultyTier: 3,
    finalExerciseId: "nordic_curl",
    requirements: [
      { type: "exercise", exerciseId: "nordic_curl_negative", metric: "reps", minValue: 6, label: "Negativas de nordic curl ×6", importance: 0.45 },
      { type: "capability", capabilityId: "legs", minValue: 75, label: "Fuerza de isquiotibiales", importance: 0.55 },
    ],
  },
];

export const SKILLS_BY_ID: Record<string, Skill> = Object.fromEntries(SKILLS.map((s) => [s.id, s]));
