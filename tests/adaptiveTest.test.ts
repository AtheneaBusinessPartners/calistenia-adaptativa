import { describe, expect, it } from "vitest";
import { nextAssessmentStep, runAdaptiveChain, shouldStopChain } from "../src/engine/adaptiveTest.js";
import type { AssessmentEntry } from "../src/engine/types.js";

describe("adaptiveTest", () => {
  it("empieza por el ejercicio más fácil no respondido de la cadena", () => {
    const step = nextAssessmentStep("vertical_pull_main", []);
    expect(step?.exerciseId).toBe("dead_hang");
  });

  it("para de subir de nivel si el usuario no domina el escalón actual", () => {
    const answered: AssessmentEntry[] = [{ exerciseId: "dead_hang", seconds: 5 }]; // objetivo: 20s, no lo cumple
    expect(shouldStopChain("vertical_pull_main", answered)).toBe(true);
  });

  it("no pregunta por chest-to-bar si el usuario no domina la dominada básica (ejemplo del brief §7)", () => {
    const knownAnswers: AssessmentEntry[] = [
      { exerciseId: "pull_up", reps: 3 }, // por debajo del listón de 8
      { exerciseId: "chest_to_bar_pull_up", reps: 5 }, // dato "trampa": nunca debería preguntarse
    ];
    const asked = runAdaptiveChain("pull_up_to_muscle_up", knownAnswers);
    expect(asked.map((a) => a.exerciseId)).toEqual(["pull_up"]);
  });
});
