import { describe, expect, it } from "vitest";
import { buildCalendarMonth, computeMonthlyStats, computeWeeklyStats } from "../src/engine/trainingStats.js";

// "Hoy" fijo para que los tests no dependan del día real: miércoles
// 2026-09-16T12:00:00Z.
const TODAY = new Date("2026-09-16T12:00:00.000Z");

describe("computeWeeklyStats", () => {
  it("cuenta solo las sesiones de la semana ISO actual (lunes-domingo)", () => {
    const stats = computeWeeklyStats(["2026-09-14", "2026-09-15", "2026-09-08"], 4, TODAY);
    // 2026-09-14 (lunes) y 2026-09-15 (martes) caen en la semana actual;
    // 2026-09-08 es de la semana anterior.
    expect(stats.sessionsThisWeek).toBe(2);
  });

  it("el porcentaje de adherencia se calcula sobre el objetivo y se limita a 100", () => {
    const stats = computeWeeklyStats(["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18"], 3, TODAY);
    expect(stats.sessionsThisWeek).toBe(5);
    expect(stats.adherencePct).toBe(100);
  });

  it("sin sesiones esta semana, adherencia 0", () => {
    const stats = computeWeeklyStats([], 4, TODAY);
    expect(stats.sessionsThisWeek).toBe(0);
    expect(stats.adherencePct).toBe(0);
  });
});

describe("computeMonthlyStats", () => {
  it("cuenta las sesiones del mes en curso, no de otros meses", () => {
    const stats = computeMonthlyStats(["2026-09-01", "2026-09-16", "2026-08-30"], TODAY);
    expect(stats.sessionsThisMonth).toBe(2);
  });

  it("la racha cuenta días consecutivos hacia atrás terminando hoy", () => {
    const stats = computeMonthlyStats(["2026-09-14", "2026-09-15", "2026-09-16"], TODAY);
    expect(stats.currentStreakDays).toBe(3);
  });

  it("si hoy todavía no se ha entrenado, la racha se cuenta desde ayer sin romperse", () => {
    const stats = computeMonthlyStats(["2026-09-14", "2026-09-15"], TODAY);
    expect(stats.currentStreakDays).toBe(2);
  });

  it("un día sin entrenar corta la racha", () => {
    const stats = computeMonthlyStats(["2026-09-10", "2026-09-16"], TODAY);
    expect(stats.currentStreakDays).toBe(1);
  });
});

describe("buildCalendarMonth", () => {
  it("cubre el mes completo en semanas de lunes a domingo, sin huecos", () => {
    const days = buildCalendarMonth([], 2026, 8, TODAY); // septiembre 2026 (0-indexado)
    expect(days.length % 7).toBe(0);
    expect(days[0]!.date <= "2026-09-01").toBe(true);
    const inMonthDays = days.filter((d) => d.inMonth);
    expect(inMonthDays.length).toBe(30); // septiembre tiene 30 días
  });

  it("marca correctamente los días entrenados y el día de hoy", () => {
    const days = buildCalendarMonth(["2026-09-16"], 2026, 8, TODAY);
    const today = days.find((d) => d.date === "2026-09-16")!;
    expect(today.trained).toBe(true);
    expect(today.isToday).toBe(true);
    const untrained = days.find((d) => d.date === "2026-09-01")!;
    expect(untrained.trained).toBe(false);
  });
});
