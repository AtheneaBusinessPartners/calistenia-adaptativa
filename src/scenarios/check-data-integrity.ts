import { EXERCISES, EXERCISES_BY_ID } from "../data/exercises.js";
import { SKILLS } from "../data/skills.js";
import { MOVEMENT_CHAINS } from "../data/chains.js";
import { MUSCLES } from "../data/muscles.js";
import { MUSCLE_RECOVERY_DAYS } from "../data/muscleRecovery.js";

// Chequeo de integridad referencial del catálogo. No es un test de
// comportamiento del motor (eso está en tests/) — es una validación de que
// los DATOS no tienen erratas: IDs que no existen, importances que no
// suman 1.0, pesos de capacidad fuera de rango, ejercicios huérfanos que el
// test adaptativo nunca alcanzaría. Cuanto más crezca el catálogo (el brief
// pide poder llegar a cientos de ejercicios), más falta hace correr esto.

let errors = 0;
function fail(msg: string) {
  console.log("FAIL:", msg);
  errors++;
}

// 0. IDs duplicados: Object.fromEntries se quedaría en silencio con el
// último y ocultaría el problema, así que hay que comprobarlo aparte.
function checkDuplicates(ids: string[], label: string) {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) fail(`${label}: id duplicado "${id}"`);
    seen.add(id);
  }
}
checkDuplicates(EXERCISES.map((e) => e.id), "exercises");
checkDuplicates(SKILLS.map((s) => s.id), "skills");

const skillIds = new Set(SKILLS.map((s) => s.id));
for (const ex of EXERCISES) {
  for (const id of ex.regressions ?? []) {
    if (!EXERCISES_BY_ID[id]) fail(`${ex.id}.regressions -> ${id} no existe`);
  }
  for (const id of ex.progressions ?? []) {
    if (!EXERCISES_BY_ID[id]) fail(`${ex.id}.progressions -> ${id} no existe`);
  }
  for (const id of ex.relatedSkills ?? []) {
    if (!skillIds.has(id)) fail(`${ex.id}.relatedSkills -> ${id} no existe`);
  }
}

for (const skill of SKILLS) {
  if (skill.finalExerciseId && !EXERCISES_BY_ID[skill.finalExerciseId]) {
    fail(`${skill.id}.finalExerciseId -> ${skill.finalExerciseId} no existe`);
  }
  for (const req of skill.requirements) {
    if (req.type === "exercise" && !EXERCISES_BY_ID[req.exerciseId]) {
      fail(`${skill.id} requirement -> exercise ${req.exerciseId} no existe`);
    }
  }
  const sumImportance = skill.requirements.reduce((s, r) => s + r.importance, 0);
  if (Math.abs(sumImportance - 1) > 0.001) {
    fail(`${skill.id}: suma de importances = ${sumImportance.toFixed(3)}, no es 1.0`);
  }
}

for (const [chainKey, chain] of Object.entries(MOVEMENT_CHAINS)) {
  for (const id of chain) {
    if (!EXERCISES_BY_ID[id]) fail(`chain ${chainKey} -> ${id} no existe`);
  }
}

const allChainedIds = new Set(Object.values(MOVEMENT_CHAINS).flat());
for (const ex of EXERCISES) {
  if (!allChainedIds.has(ex.id)) {
    fail(`${ex.id} no aparece en ninguna cadena de chains.ts (inalcanzable por el test adaptativo)`);
  }
}

for (const ex of EXERCISES) {
  for (const [cap, w] of Object.entries(ex.capabilitiesDeveloped)) {
    if (w !== undefined && (w <= 0 || w > 1)) fail(`${ex.id}.capabilitiesDeveloped.${cap} = ${w} fuera de (0,1]`);
  }
}

// `difficulty` es la fuente de verdad del "nivel" de un ejercicio dentro de
// su línea (ver docs/architecture-v1.md §3-4) — si una progresión tuviera
// una dificultad menor que su propia regresión, capabilityProfile.ts y
// exerciseSelector.ts (levelCompatibility, estimateMovementFrontier)
// razonarían al revés sin que ningún test lo detectase, porque ambos
// confían en que la cadena de datos es monótona.
for (const ex of EXERCISES) {
  for (const id of ex.progressions ?? []) {
    const next = EXERCISES_BY_ID[id];
    if (next && next.difficulty < ex.difficulty) {
      fail(`${ex.id}(difficulty=${ex.difficulty}).progressions -> ${id}(difficulty=${next.difficulty}) es más fácil, no más difícil`);
    }
  }
  for (const id of ex.regressions ?? []) {
    const prev = EXERCISES_BY_ID[id];
    if (prev && prev.difficulty > ex.difficulty) {
      fail(`${ex.id}(difficulty=${ex.difficulty}).regressions -> ${id}(difficulty=${prev.difficulty}) es más difícil, no más fácil`);
    }
  }
}

// FASE 3: todo músculo real debería tener un valor explícito de recuperación
// (si no, cae en silencio a DEFAULT_RECOVERY_DAYS sin que nadie lo note al
// añadir un músculo nuevo), y no debería haber entradas huérfanas que ya no
// correspondan a ningún músculo.
const muscleIds = new Set(MUSCLES.map((m) => m.id));
for (const m of MUSCLES) {
  if (!(m.id in MUSCLE_RECOVERY_DAYS)) fail(`muscleRecovery.ts no tiene entrada para "${m.id}" (cae al valor por defecto)`);
}
for (const id of Object.keys(MUSCLE_RECOVERY_DAYS)) {
  if (!muscleIds.has(id)) fail(`muscleRecovery.ts tiene "${id}" pero no existe ese músculo en muscles.ts`);
}

console.log(`${EXERCISES.length} ejercicios, ${SKILLS.length} skills, ${Object.keys(MOVEMENT_CHAINS).length} cadenas revisadas.`);
console.log(errors === 0 ? "OK: sin errores de integridad." : `${errors} error(es) encontrados.`);
process.exit(errors === 0 ? 0 : 1);
