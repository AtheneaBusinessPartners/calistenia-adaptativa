import type { EquipmentId } from "../engine/types.js";

// Modos de entrenamiento (§6 del brief). No son un concepto nuevo para el
// motor — el motor solo entiende "lista de equipamiento disponible"
// (equipmentGate en exerciseSelector.ts) — son PRESETS de esa lista para que
// el onboarding pueda ofrecer una opción de un clic en vez de obligar a
// marcar cada material uno a uno. Añadir un modo nuevo es añadir una fila
// aquí, no tocar el motor.
export interface TrainingEnvironment {
  id: string;
  name: string;
  description: string;
  equipment: EquipmentId[];
}

export const TRAINING_ENVIRONMENTS: TrainingEnvironment[] = [
  {
    id: "pure_calisthenics",
    name: "Calistenia pura",
    description: "Solo el propio peso corporal, sin ningún material.",
    equipment: ["none"],
  },
  {
    id: "calisthenics_plus_gym",
    name: "Calistenia + gimnasio",
    description: "Calistenia como base, con acceso puntual a gimnasio para accesorios.",
    equipment: ["none", "pullup_bar", "parallettes", "rings", "bands", "dumbbells", "kettlebell", "barbell", "plates", "bench", "pulley_machine", "gym_machine"],
  },
  {
    id: "gym_for_calisthenics",
    name: "Gimnasio enfocado a calistenia",
    description: "Entrena principalmente en gimnasio pero con el objetivo puesto en skills de calistenia.",
    equipment: ["none", "pullup_bar", "parallettes", "bands", "dumbbells", "barbell", "plates", "bench", "pulley_machine", "gym_machine", "weight_vest"],
  },
  {
    id: "minimalist",
    name: "Entrenamiento minimalista",
    description: "Sin material o con lo mínimo transportable (bandas).",
    equipment: ["none", "bands"],
  },
  {
    id: "home",
    name: "Entrenamiento en casa",
    description: "Lo que suele haber en un piso: quizá barra de puerta y bandas.",
    equipment: ["none", "pullup_bar", "bands"],
  },
  {
    id: "park",
    name: "Entrenamiento en parque",
    description: "Barras y paralelas de calle, sin máquinas.",
    equipment: ["none", "pullup_bar", "parallettes", "rings", "bands"],
  },
];

export const TRAINING_ENVIRONMENTS_BY_ID: Record<string, TrainingEnvironment> = Object.fromEntries(
  TRAINING_ENVIRONMENTS.map((e) => [e.id, e]),
);

/**
 * Resuelve el equipamiento real de un usuario a partir de un modo elegido en
 * onboarding más cualquier material adicional que haya marcado a mano
 * (p. ej. "Entrenamiento en casa" + kettlebell suelta que sí tiene).
 */
export function resolveEquipment(environmentId: string, extra: EquipmentId[] = []): EquipmentId[] {
  const env = TRAINING_ENVIRONMENTS_BY_ID[environmentId];
  const base = env?.equipment ?? ["none"];
  return Array.from(new Set([...base, ...extra]));
}
