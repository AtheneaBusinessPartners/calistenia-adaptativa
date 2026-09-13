import { describe, expect, it } from "vitest";
import { resolveEquipment, TRAINING_ENVIRONMENTS } from "../src/data/trainingEnvironments.js";

describe("trainingEnvironments (§6)", () => {
  it("expone los 6 modos de entrenamiento del brief", () => {
    expect(TRAINING_ENVIRONMENTS).toHaveLength(6);
  });

  it("calistenia pura no incluye ningún material real", () => {
    const equipment = resolveEquipment("pure_calisthenics");
    expect(equipment).toEqual(["none"]);
  });

  it("permite añadir material extra sobre el preset del modo", () => {
    const equipment = resolveEquipment("home", ["kettlebell"]);
    expect(equipment).toContain("pullup_bar");
    expect(equipment).toContain("kettlebell");
  });

  it("un modo desconocido cae en calistenia pura por defecto", () => {
    expect(resolveEquipment("no_existe")).toEqual(["none"]);
  });
});
