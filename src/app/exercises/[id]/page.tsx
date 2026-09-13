import Link from "next/link";
import { notFound } from "next/navigation";
import { EXERCISES_BY_ID } from "../../../data/exercises.js";
import { muscleName } from "../../../data/muscles.js";

export default async function ExercisePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const exercise = EXERCISES_BY_ID[id];
  if (!exercise) notFound();

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <Link href="/dashboard" className="mb-4 inline-block text-sm text-[var(--muted)]">
        ← Volver
      </Link>
      {exercise.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={exercise.imageUrl} alt={exercise.name} className="mb-4 w-full rounded-xl border border-[var(--border)]" />
      )}
      <h1 className="mb-1 text-xl font-semibold">{exercise.name}</h1>
      <p className="mb-4 text-sm text-[var(--muted)]">
        {exercise.category} · {exercise.movementPattern} · dificultad {exercise.difficulty}/10 · descansa{" "}
        {exercise.restSeconds}s entre series
      </p>

      <Section title="Cómo hacerlo">
        <ul className="list-inside list-disc text-sm">
          {exercise.technicalCues.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </Section>

      <Section title="Errores frecuentes">
        <ul className="list-inside list-disc text-sm">
          {exercise.commonErrors.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </Section>

      {exercise.risks && exercise.risks.length > 0 && (
        <Section title="Precauciones">
          <ul className="list-inside list-disc text-sm text-[var(--danger)]">
            {exercise.risks.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Músculos">
        <p className="text-sm">
          <span className="text-[var(--muted)]">Principales:</span> {exercise.primaryMuscles.map(muscleName).join(", ")}
        </p>
        {exercise.secondaryMuscles && (
          <p className="text-sm">
            <span className="text-[var(--muted)]">Secundarios:</span> {exercise.secondaryMuscles.map(muscleName).join(", ")}
          </p>
        )}
      </Section>

      {exercise.regressions && exercise.regressions.length > 0 && (
        <Section title="Si es demasiado difícil">
          <ExerciseLinks ids={exercise.regressions} />
        </Section>
      )}
      {exercise.progressions && exercise.progressions.length > 0 && (
        <Section title="Siguiente paso">
          <ExerciseLinks ids={exercise.progressions} />
        </Section>
      )}
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h2 className="mb-2 text-sm font-medium text-[var(--muted)]">{title}</h2>
      {children}
    </div>
  );
}

function ExerciseLinks({ ids }: { ids: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {ids.map((id) => {
        const ex = EXERCISES_BY_ID[id];
        if (!ex) return null;
        return (
          <Link key={id} href={`/exercises/${id}`} className="rounded-full border border-[var(--border)] px-3 py-1 text-sm text-[var(--accent)]">
            {ex.name}
          </Link>
        );
      })}
    </div>
  );
}
