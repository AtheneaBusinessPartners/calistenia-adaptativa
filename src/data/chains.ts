// Cadenas de progresión explícitas por línea de trabajo. Cada cadena es una
// lista ordenada (fácil -> difícil) de Exercise.id. Se usan para el test
// adaptativo (§7 del brief): al testear, si el usuario no domina un
// ejercicio, no tiene sentido preguntar por los siguientes de la cadena.
//
// Nota de diseño: el "nivel" de un ejercicio dentro del motor de capacidades
// (ver capabilityProfile.ts) usa el campo `difficulty` de cada Exercise, no
// la posición en estas listas — así un admin puede reordenar/ajustar la
// dificultad relativa sin tener que reescribir estas cadenas. Estas listas
// existen solo para la lógica de "qué preguntar/recomendar después".

export const MOVEMENT_CHAINS: Record<string, string[]> = {
  vertical_pull_main: [
    "dead_hang",
    "scapular_pull_up",
    "band_assisted_pull_up",
    "negative_pull_up",
    "pull_up",
  ],
  pull_up_to_muscle_up: [
    "pull_up",
    "chest_to_bar_pull_up",
    "explosive_pull_up",
    "muscle_up_transition_drill",
    "band_assisted_muscle_up",
    "muscle_up",
    "ring_muscle_up",
  ],
  chin_up_line: ["negative_pull_up", "chin_up"],
  weighted_pull_chain: ["pull_up", "weighted_pull_up"],
  horizontal_pull_chain: ["australian_row"],
  dip_chain: [
    "bench_dip",
    "band_assisted_dip",
    "negative_dip",
    "straight_bar_dip",
    "weighted_dip",
  ],
  pushup_chain: [
    "wall_push_up",
    "incline_push_up",
    "push_up",
    "diamond_push_up",
    "clap_push_up",
  ],
  hspu_chain: [
    "pike_push_up",
    "elevated_pike_push_up",
    "wall_hspu_negative",
    "wall_hspu",
    "freestanding_hspu",
  ],
  handstand_chain: [
    "wall_handstand_hold",
    "wall_handstand_hold_back_to_wall",
    "crow_pose",
    "freestanding_handstand_hold",
  ],
  core_anti_extension_chain: ["plank", "hollow_body_hold", "hollow_body_rock"],
  core_flexion_chain: [
    "hanging_knee_raise",
    "hanging_leg_raise",
    "l_sit_tuck",
    "l_sit",
    "v_sit",
  ],
  squat_chain: [
    "bodyweight_squat",
    "split_squat",
    "bulgarian_split_squat",
    "shrimp_squat",
    "pistol_squat",
  ],
  hinge_chain: [
    "glute_bridge",
    "single_leg_glute_bridge",
    "nordic_curl_negative",
    "nordic_curl",
  ],
  front_lever_chain: [
    "tuck_front_lever_hold",
    "advanced_tuck_front_lever_hold",
    "one_leg_front_lever_hold",
    "straddle_front_lever_hold",
    "front_lever_hold",
  ],
  back_lever_chain: [
    "tuck_back_lever_hold",
    "advanced_tuck_back_lever_hold",
    "straddle_back_lever_hold",
    "back_lever_hold",
  ],
  planche_chain: [
    "planche_lean",
    "tuck_planche_hold",
    "advanced_tuck_planche_hold",
    "straddle_planche_hold",
    "full_planche_hold",
  ],
};

export function findChainsContaining(exerciseId: string): { chainKey: string; index: number; length: number }[] {
  const results: { chainKey: string; index: number; length: number }[] = [];
  for (const [chainKey, chain] of Object.entries(MOVEMENT_CHAINS)) {
    const index = chain.indexOf(exerciseId);
    if (index !== -1) results.push({ chainKey, index, length: chain.length });
  }
  return results;
}
