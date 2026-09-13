import { describe, expect, it } from "vitest";
import { computeCapabilityProfile } from "../src/engine/capabilityProfile.js";
import { evaluateSkillGate } from "../src/engine/skillGate.js";
import { EXERCISES_BY_ID } from "../src/data/exercises.js";
import { SKILLS_BY_ID } from "../src/data/skills.js";
import type { AssessmentEntry } from "../src/engine/types.js";

// Mismos datos que src/scenarios/muscleup-user.ts (§40 del brief). Si estos
// números cambian al tocar el motor, es una señal para revisar a propósito,
// no un accidente silencioso.
const assessment: AssessmentEntry[] = [
  { exerciseId: "pull_up", reps: 7 },
  { exerciseId: "push_up", reps: 12 },
  { exerciseId: "straight_bar_dip", reps: 10 },
  { exerciseId: "hollow_body_hold", seconds: 30 },
  { exerciseId: "freestanding_handstand_hold", seconds: 60 },
  { exerciseId: "chest_to_bar_pull_up", reps: 0 },
];

describe("computeCapabilityProfile", () => {
  it("no promedia cadenas independientes: balance alto y legs en cero conviven", () => {
    const profile = computeCapabilityProfile(assessment, EXERCISES_BY_ID);
    expect(profile.balance).toBeGreaterThan(50);
    expect(profile.legs).toBe(0);
    expect(profile.explosiveness).toBe(0); // no se ha evaluado nada explosivo
  });
});

describe("evaluateSkillGate — muscle_up", () => {
  const profile = computeCapabilityProfile(assessment, EXERCISES_BY_ID);
  const gate = evaluateSkillGate(SKILLS_BY_ID["muscle_up"]!, assessment, profile);

  it("straight_bar_dip ya cumplido (10 >= 8)", () => {
    const dip = gate.requirementStatuses.find(
      (s) => s.requirement.type === "exercise" && s.requirement.exerciseId === "straight_bar_dip",
    );
    expect(dip?.met).toBe(true);
  });

  it("chest-to-bar es la limitación de mayor prioridad", () => {
    expect(gate.limitations[0]?.requirement.type === "exercise" && gate.limitations[0]?.requirement.exerciseId).toBe(
      "chest_to_bar_pull_up",
    );
  });

  it("readiness global está entre 25% y 40%", () => {
    expect(gate.overallReadiness).toBeGreaterThan(0.25);
    expect(gate.overallReadiness).toBeLessThan(0.4);
  });
});
