import type { MovementPattern } from "../engine/types.js";

export const MOVEMENT_PATTERNS: MovementPattern[] = [
  { id: "vertical_pull", name: "Tracción vertical", description: "Tirar del cuerpo hacia arriba contra la gravedad (dead hang → pull-up → muscle-up)." },
  { id: "horizontal_pull", name: "Tracción horizontal", description: "Remo horizontal con el cuerpo (australian row, front lever)." },
  { id: "vertical_push", name: "Empuje vertical", description: "Empujar el cuerpo hacia arriba en línea vertical (pike push-up → HSPU)." },
  { id: "horizontal_push", name: "Empuje horizontal", description: "Empuje del cuerpo en el plano horizontal (push-up → planche)." },
  { id: "squat", name: "Sentadilla", description: "Flexo-extensión de rodilla y cadera bilateral o unilateral." },
  { id: "hinge", name: "Bisagra de cadera", description: "Flexo-extensión dominante de cadera (nordic curl, cadena posterior)." },
  { id: "core_flexion", name: "Flexión de core", description: "Flexión de tronco/cadera controlada (leg raise, L-sit, V-sit)." },
  { id: "core_anti_extension", name: "Anti-extensión de core", description: "Resistir la extensión lumbar bajo tensión (hollow body, plank)." },
  { id: "isometric_support", name: "Soporte isométrico en brazos", description: "Mantener el cuerpo en tensión estática apoyado en brazos (front/back lever, planche)." },
  { id: "balance_hold", name: "Equilibrio invertido", description: "Mantener el equilibrio en posición invertida o inestable (crow, handstand)." },
];
