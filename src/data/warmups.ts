import type { ExerciseCategory } from "../engine/types.js";

export type WarmupCategory = "general" | ExerciseCategory;

export interface WarmupMove {
  id: string;
  name: string;
  category: WarmupCategory;
  reps?: string; // p.ej. "10-15" o "10 por lado"
  seconds?: number;
  cue: string;
}

// Calentamiento general (movilidad articular, siempre) + activación
// específica según qué categorías toque la sesión de hoy (§ petición del
// usuario: sugerir calentamiento antes de la sesión). Movimientos sin
// material, calistenia pura — no dependen del equipo real del usuario.
export const WARMUP_MOVES: WarmupMove[] = [
  {
    id: "joint_circles",
    name: "Círculos articulares (cuello, hombros, muñecas, cadera, tobillos)",
    category: "general",
    seconds: 60,
    cue: "De arriba a abajo, movimientos amplios y controlados.",
  },
  {
    id: "cat_cow",
    name: "Cat-cow",
    category: "general",
    reps: "8-10",
    cue: "Moviliza la columna completa, sincroniza con la respiración.",
  },
  {
    id: "arm_circles",
    name: "Círculos de brazos",
    category: "push",
    reps: "15 por sentido",
    cue: "Activa el hombro antes de cualquier empuje.",
  },
  {
    id: "scapular_activation",
    name: "Retracciones escapulares (de pie o en barra)",
    category: "pull",
    reps: "10-12",
    cue: "Activa la espalda alta antes de tirar.",
  },
  {
    id: "leg_swings",
    name: "Balanceos de pierna (adelante-atrás y laterales)",
    category: "legs",
    reps: "10 por pierna",
    cue: "Suelta la cadera antes de sentadillas o zancadas.",
  },
  {
    id: "dead_bug",
    name: "Dead bug",
    category: "core",
    reps: "8 por lado",
    cue: "Activa el core a baja intensidad, sin cargarlo todavía.",
  },
  {
    id: "wrist_prep",
    name: "Movilidad de muñeca (flexión, extensión, apoyo progresivo)",
    category: "skill",
    seconds: 45,
    cue: "Importante antes de handstands o cualquier apoyo de manos.",
  },
];
