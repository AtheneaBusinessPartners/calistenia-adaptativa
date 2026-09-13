// Días de recuperación heurísticos por músculo — cuántos días hacen falta
// para que el estímulo de una sesión dura quede en ~10% (ver
// docs/architecture-v3-fatigue-engine.md §1). Son valores de partida
// razonables (grupos grandes recuperan más despacio que los pequeños),
// no medidos; ajustables aquí sin tocar fatigueEngine.ts.
export const MUSCLE_RECOVERY_DAYS: Record<string, number> = {
  lats: 3,
  rhomboids: 2.5,
  traps: 2.5,
  lower_back: 3,
  rear_delts: 2,
  front_delts: 2,
  side_delts: 2,
  serratus_anterior: 2,
  chest: 3,
  biceps: 2,
  triceps: 2,
  forearms: 1.5,
  rectus_abdominis: 2,
  obliques: 2,
  hip_flexors: 2,
  quads: 3,
  hamstrings: 3,
  glutes: 2.5,
  calves: 1.5,
};

export const DEFAULT_RECOVERY_DAYS = 2.5;

export function getRecoveryDays(muscleId: string): number {
  return MUSCLE_RECOVERY_DAYS[muscleId] ?? DEFAULT_RECOVERY_DAYS;
}
