import type { Muscle } from "../engine/types.js";

export const MUSCLES: Muscle[] = [
  { id: "lats", name: "Dorsal ancho", group: "back" },
  { id: "rhomboids", name: "Romboides", group: "back" },
  { id: "traps", name: "Trapecio", group: "back" },
  { id: "lower_back", name: "Lumbar", group: "back" },
  { id: "rear_delts", name: "Deltoides posterior", group: "shoulders" },
  { id: "front_delts", name: "Deltoides anterior", group: "shoulders" },
  { id: "side_delts", name: "Deltoides lateral", group: "shoulders" },
  { id: "serratus_anterior", name: "Serrato anterior", group: "shoulders" },
  { id: "chest", name: "Pectoral", group: "chest" },
  { id: "biceps", name: "Bíceps", group: "arms" },
  { id: "triceps", name: "Tríceps", group: "arms" },
  { id: "forearms", name: "Antebrazos / agarre", group: "arms" },
  { id: "rectus_abdominis", name: "Recto abdominal", group: "core" },
  { id: "obliques", name: "Oblicuos", group: "core" },
  { id: "hip_flexors", name: "Flexores de cadera", group: "core" },
  { id: "quads", name: "Cuádriceps", group: "legs" },
  { id: "hamstrings", name: "Isquiosurales", group: "legs" },
  { id: "glutes", name: "Glúteos", group: "legs" },
  { id: "calves", name: "Gemelos", group: "legs" },
];

export const MUSCLES_BY_ID: Record<string, Muscle> = Object.fromEntries(MUSCLES.map((m) => [m.id, m]));

/** Nombre en español de un músculo por su id — con fallback al propio id
 * por si alguna vez apareciera uno no catalogado, en vez de reventar. */
export function muscleName(id: string): string {
  return MUSCLES_BY_ID[id]?.name ?? id;
}
