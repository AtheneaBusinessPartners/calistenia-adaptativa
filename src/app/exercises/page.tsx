import Link from "next/link";
import { EXERCISES } from "../../data/exercises.js";
import { ExerciseLibrary } from "../../components/ExerciseLibrary.js";

export default function ExerciseLibraryPage() {
  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <Link href="/dashboard" className="mb-4 inline-block text-sm text-[var(--muted)]">
        ← Volver
      </Link>
      <h1 className="mb-1 text-xl font-semibold">Biblioteca de ejercicios</h1>
      <p className="mb-6 text-sm text-[var(--muted)]">Consulta cómo hacer cada ejercicio del catálogo.</p>
      <ExerciseLibrary exercises={EXERCISES} />
    </main>
  );
}
