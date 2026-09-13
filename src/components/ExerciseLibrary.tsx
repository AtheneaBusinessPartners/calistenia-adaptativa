"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Exercise, ExerciseCategory } from "../engine/types.js";

const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  pull: "Tirón",
  push: "Empuje",
  legs: "Pierna",
  core: "Core",
  skill: "Skill",
};

const CATEGORY_EMOJI: Record<ExerciseCategory, string> = {
  pull: "💪",
  push: "🙌",
  legs: "🦵",
  core: "🧘",
  skill: "🤸",
};

export function ExerciseLibrary({ exercises }: { exercises: Exercise[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q.length === 0 ? exercises : exercises.filter((e) => e.name.toLowerCase().includes(q));
  }, [exercises, query]);

  const byCategory = useMemo(() => {
    const groups = {} as Record<ExerciseCategory, Exercise[]>;
    for (const e of filtered) {
      (groups[e.category] ??= []).push(e);
    }
    return groups;
  }, [filtered]);

  const categories = (Object.keys(CATEGORY_LABELS) as ExerciseCategory[]).filter((c) => (byCategory[c]?.length ?? 0) > 0);

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar ejercicio…"
        className="mb-6 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 outline-none focus:border-[var(--accent)]"
      />
      {categories.length === 0 && <p className="text-sm text-[var(--muted)]">Sin resultados para "{query}".</p>}
      {categories.map((cat) => (
        <div key={cat} className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-[var(--muted)]">
            {CATEGORY_EMOJI[cat]} {CATEGORY_LABELS[cat]}
          </h2>
          <div className="flex flex-col gap-2">
            {byCategory[cat]!.map((e) => (
              <Link
                key={e.id}
                href={`/exercises/${e.id}`}
                className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 hover:border-[var(--accent)]"
              >
                {e.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.imageUrl} alt="" className="h-12 w-12 flex-shrink-0 rounded-md object-cover" />
                ) : (
                  <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md bg-[var(--background)] text-xl">
                    {CATEGORY_EMOJI[cat]}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="font-medium">{e.name}</p>
                  <p className="text-xs text-[var(--muted)]">Dificultad {e.difficulty}/10</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
