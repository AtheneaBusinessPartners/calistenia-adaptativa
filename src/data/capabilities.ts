import type { Capability } from "../engine/types.js";

export const CAPABILITIES: Capability[] = [
  { id: "pull", name: "Pull strength", description: "Fuerza de tracción vertical y horizontal (dorsales, bíceps, espalda alta)." },
  { id: "push", name: "Push strength", description: "Fuerza de empuje horizontal y vertical (pecho, hombros, tríceps)." },
  { id: "core", name: "Core", description: "Control y fuerza del core: anti-extensión, flexión, transferencia de fuerza." },
  { id: "legs", name: "Legs", description: "Fuerza de piernas: sentadilla, unilateral, cadena posterior." },
  { id: "balance", name: "Balance", description: "Equilibrio invertido y control propioceptivo (handstand, crow, etc.)." },
  { id: "mobility", name: "Mobility", description: "Rango de movimiento en hombro, cadera y muñeca relevante para calistenia." },
  { id: "explosiveness", name: "Explosiveness", description: "Capacidad de generar fuerza rápida (pull-up explosivo, salto, clap push-up)." },
];

export const CAPABILITY_IDS = CAPABILITIES.map((c) => c.id);
