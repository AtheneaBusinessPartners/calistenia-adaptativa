import { describe, expect, it } from "vitest";
import { applyCheckInToFatigue, checkInSafetyMessage } from "../src/engine/checkIn.js";
import type { CheckIn } from "../src/engine/types.js";

const baseCheckIn: CheckIn = {
  feeling: "normal",
  sleepQuality: "good",
  stress: "low",
  motivation: "high",
};

describe("applyCheckInToFatigue (§14-15 del brief)", () => {
  it("un check-in neutro no sube la fatiga objetiva", () => {
    const base = { lats: 30, quads: 10 };
    const result = applyCheckInToFatigue(base, baseCheckIn);
    expect(result).toEqual(base);
  });

  it('"muy cansado" sube la fatiga de TODOS los músculos con datos, no solo uno', () => {
    const base = { lats: 30, quads: 10 };
    const result = applyCheckInToFatigue(base, { ...baseCheckIn, feeling: "very_tired" });
    expect(result["lats"]!).toBeGreaterThan(base.lats);
    expect(result["quads"]!).toBeGreaterThan(base.quads);
  });

  it("marcar una zona concreta como fatigada la sube más que el resto", () => {
    const base = { lats: 30, quads: 30 };
    const result = applyCheckInToFatigue(base, { ...baseCheckIn, fatigueZones: ["lats"] });
    expect(result["lats"]!).toBeGreaterThan(result["quads"]!);
  });

  it("nunca supera 100 ni baja de 0", () => {
    const base = { lats: 95 };
    const result = applyCheckInToFatigue(base, {
      feeling: "very_tired",
      sleepQuality: "poor",
      stress: "high",
      motivation: "low",
      fatigueZones: ["lats"],
    });
    expect(result["lats"]!).toBeLessThanOrEqual(100);
  });
});

describe("checkInSafetyMessage (§15: el dolor no se trata como fatiga)", () => {
  it("sin zonas de dolor, no hay aviso", () => {
    expect(checkInSafetyMessage(baseCheckIn).shouldWarn).toBe(false);
  });

  it("dolor severo genera un aviso que recomienda precaución/consulta profesional", () => {
    const advice = checkInSafetyMessage({ ...baseCheckIn, painZones: ["lower_back"], painSeverity: "severe" });
    expect(advice.shouldWarn).toBe(true);
    expect(advice.message).toMatch(/profesional/i);
  });

  it("dolor leve avisa pero sin la misma urgencia que severo", () => {
    const mild = checkInSafetyMessage({ ...baseCheckIn, painZones: ["forearms"], painSeverity: "mild" });
    const severe = checkInSafetyMessage({ ...baseCheckIn, painZones: ["forearms"], painSeverity: "severe" });
    expect(mild.shouldWarn).toBe(true);
    expect(mild.message).not.toBe(severe.message);
  });
});
