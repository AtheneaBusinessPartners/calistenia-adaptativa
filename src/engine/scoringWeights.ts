// Pesos de la fórmula de scoring (§29 del brief). Separados del código para
// poder ajustarlos con datos reales sin tocar exerciseSelector.ts. Deben
// sumar 1.0 entre los factores "blandos" (no los gates, que son
// multiplicadores 0/1, no pesos).
export const SCORING_WEIGHTS = {
  skillRelevance: 0.3,
  capabilityFit: 0.25,
  levelCompatibility: 0.2,
  goalRelevance: 0.1,
  progressionReadiness: 0.1,
  preference: 0.05,
};

// Capacidades relevantes por objetivo general (§4 del brief), usadas cuando
// el objetivo no es una skill concreta.
export const GOAL_CAPABILITY_MAP: Record<string, import("./types.js").CapabilityId[]> = {
  strength: ["pull", "push", "legs"],
  muscle_mass: ["pull", "push", "legs"],
  fat_loss: ["pull", "push", "legs", "core"],
  conditioning: ["pull", "push", "legs", "core"],
  learn_skills: ["balance", "explosiveness", "mobility"],
  mobility: ["mobility"],
  explosiveness: ["explosiveness"],
  endurance: ["legs", "core"],
  competition: ["pull", "push", "legs", "core", "explosiveness"],
  specific_skill: [],
};
