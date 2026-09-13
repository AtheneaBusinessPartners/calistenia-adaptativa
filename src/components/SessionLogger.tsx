"use client";

import { useState, useTransition } from "react";
import { logSession } from "../lib/actions/session.js";
import { parseAverage } from "../engine/rangeText.js";
import type { WorkoutBlockItem } from "../engine/workoutSketch.js";
import type { LoggedSet } from "../lib/repository.js";

interface Props {
  blocks: WorkoutBlockItem[];
  archetype: string;
}

interface RowState {
  achieved: string;
  rir: string;
  techniqueOk: boolean;
}

// Sin historial todavía (ejercicio recién visto por primera vez), no hay
// `prescription` — sin este fallback el campo quedaba vacío y, si el
// usuario no lo tocaba, se registraba como "0 hecho" (bug real detectado
// probando la app: eso disparaba INCREASE_REPS desde 0 la próxima vez,
// mostrando objetivos como "×1"). Se usa la media del rango recomendado de
// la propia ficha como punto de partida razonable, no cero.
function defaultAchieved(block: WorkoutBlockItem): string {
  if (block.prescription?.targetReps !== undefined) return String(block.prescription.targetReps);
  if (block.prescription?.targetSeconds !== undefined) return String(block.prescription.targetSeconds);
  const isTime = block.exercise.masteryCriteria.type === "time";
  const fallback = parseAverage(isTime ? block.exercise.recommendedTime : block.exercise.recommendedReps);
  return fallback !== null ? String(Math.round(fallback)) : "";
}

export function SessionLogger({ blocks, archetype }: Props) {
  const [rows, setRows] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(blocks.map((b) => [b.exercise.id, { achieved: defaultAchieved(b), rir: "2", techniqueOk: true }])),
  );
  const [pending, startTransition] = useTransition();

  function updateRow(exerciseId: string, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [exerciseId]: { ...prev[exerciseId]!, ...patch } }));
  }

  function handleSubmit() {
    const loggedSets: LoggedSet[] = blocks.map((b) => {
      const row = rows[b.exercise.id]!;
      const isTime = b.exercise.masteryCriteria.type === "time";
      const achieved = Number(row.achieved) || 0;
      return {
        exerciseId: b.exercise.id,
        sets: b.sets,
        reps: isTime ? undefined : achieved,
        seconds: isTime ? achieved : undefined,
        rir: Number(row.rir) || undefined,
        techniqueOk: row.techniqueOk,
      };
    });
    startTransition(async () => {
      await logSession(archetype, loggedSets);
    });
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold">Registra lo que has hecho</h1>

      <div className="flex flex-col gap-4">
        {blocks.map((b) => {
          const isTime = b.exercise.masteryCriteria.type === "time";
          const row = rows[b.exercise.id]!;
          return (
            <div key={b.block} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
              <p className="mb-1 text-xs text-[var(--muted)]">{b.block}</p>
              <p className="mb-3 font-medium">{b.exercise.name}</p>
              <p className="mb-3 text-sm text-[var(--muted)]">
                Objetivo: {b.sets}×{b.prescription?.targetReps ?? b.prescription?.targetSeconds ?? b.exercise.recommendedReps ?? b.exercise.recommendedTime}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-sm">
                  {isTime ? "Segundos conseguidos" : "Reps conseguidas"}
                  <input
                    type="number"
                    value={row.achieved}
                    onChange={(e) => updateRow(b.exercise.id, { achieved: e.target.value })}
                    className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 outline-none focus:border-[var(--accent)]"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  RIR (0 = al fallo)
                  <input
                    type="number"
                    min={0}
                    max={5}
                    value={row.rir}
                    onChange={(e) => updateRow(b.exercise.id, { rir: e.target.value })}
                    className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 outline-none focus:border-[var(--accent)]"
                  />
                </label>
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={row.techniqueOk}
                  onChange={(e) => updateRow(b.exercise.id, { techniqueOk: e.target.checked })}
                />
                Técnica limpia en todas las repeticiones
              </label>
            </div>
          );
        })}
      </div>

      <button
        onClick={handleSubmit}
        disabled={pending}
        className="mt-6 w-full rounded-lg bg-[var(--accent)] px-3 py-2 font-medium text-black disabled:opacity-50"
      >
        {pending ? "Guardando…" : "Terminar sesión"}
      </button>
    </div>
  );
}
