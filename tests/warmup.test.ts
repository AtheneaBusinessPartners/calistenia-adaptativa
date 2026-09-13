import { describe, expect, it } from "vitest";
import { suggestWarmup } from "../src/engine/warmup.js";
import { EXERCISES_BY_ID } from "../src/data/exercises.js";

describe("suggestWarmup", () => {
  it("sin ejercicios hoy, devuelve solo la movilidad general", () => {
    const warmup = suggestWarmup([]);
    expect(warmup.length).toBeGreaterThan(0);
    expect(warmup.every((m) => m.category === "general")).toBe(true);
  });

  it("incluye activación de tirón cuando hoy hay un ejercicio de esa categoría", () => {
    const pullUp = EXERCISES_BY_ID["pull_up"]!;
    const warmup = suggestWarmup([pullUp]);
    expect(warmup.some((m) => m.category === "pull")).toBe(true);
    expect(warmup.some((m) => m.category === "legs")).toBe(false);
  });

  it("no repite categorías ni incluye una categoría que no aparece hoy", () => {
    const squat = EXERCISES_BY_ID["bodyweight_squat"]!;
    const plank = EXERCISES_BY_ID["plank"]!;
    const warmup = suggestWarmup([squat, plank]);
    expect(warmup.some((m) => m.category === "legs")).toBe(true);
    expect(warmup.some((m) => m.category === "core")).toBe(true);
    expect(warmup.some((m) => m.category === "push")).toBe(false);
    expect(warmup.some((m) => m.category === "skill")).toBe(false);
  });

  it("la movilidad general siempre está presente, sin duplicados", () => {
    const pullUp = EXERCISES_BY_ID["pull_up"]!;
    const warmup = suggestWarmup([pullUp, pullUp]);
    const ids = warmup.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
