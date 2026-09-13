import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server.js";
import { getProfile, hasTrainingSessionToday } from "../../lib/repository.js";
import { computeTodayContext } from "../../lib/planForToday.js";
import { CAPABILITIES } from "../../data/capabilities.js";
import { signOut } from "../../lib/actions/auth.js";
import { suggestWarmup } from "../../engine/warmup.js";
import { MAX_WARMUP_MINUTES } from "../../engine/workoutSketch.js";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const profile = await getProfile(supabase, userData.user.id);
  if (!profile) redirect("/onboarding");

  const { capabilityProfile, gate, today, weekPreview, deloadWeek } = await computeTodayContext(supabase, userData.user.id, profile);
  const alreadyTrainedToday = await hasTrainingSessionToday(supabase, userData.user.id);
  const warmup = suggestWarmup(today.blocks.map((b) => b.exercise));

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Tu plan de hoy</h1>
        <form action={signOut}>
          <button className="text-sm text-[var(--muted)] underline">Salir</button>
        </form>
      </div>

      <section className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="mb-3 text-sm font-medium text-[var(--muted)]">Perfil de capacidades</h2>
        <div className="flex flex-col gap-2">
          {CAPABILITIES.map((cap) => (
            <CapabilityBar key={cap.id} label={cap.name} value={capabilityProfile[cap.id]} />
          ))}
        </div>
      </section>

      {deloadWeek.recommend && (
        <section className="mb-6 rounded-xl border border-[var(--danger)] bg-[var(--card)] p-4">
          <h2 className="mb-2 text-sm font-medium text-[var(--danger)]">Semana de descarga recomendada</h2>
          <p className="mb-2 text-sm text-[var(--muted)]">
            Hemos reducido el volumen de toda la semana para dejarte recuperar de verdad.
          </p>
          <ul className="flex flex-col gap-1 text-sm text-[var(--muted)]">
            {deloadWeek.reasons.map((reason) => (
              <li key={reason}>• {reason}</li>
            ))}
          </ul>
        </section>
      )}

      {gate && (
        <section className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <h2 className="mb-2 text-sm font-medium text-[var(--muted)]">
            Objetivo: {gate.skill.name} — {Math.round(gate.overallReadiness * 100)}%
          </h2>
          {gate.limitations.slice(0, 3).map((l) => (
            <p key={l.requirement.label} className="text-sm">
              <span className="text-[var(--danger)]">✘</span> {l.requirement.label} ({Math.round(l.progressRatio * 100)}%)
            </p>
          ))}
        </section>
      )}

      {!alreadyTrainedToday && (
        <section className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <h2 className="mb-3 text-sm font-medium text-[var(--muted)]">Calentamiento sugerido (~{MAX_WARMUP_MINUTES} min)</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {warmup.map((move) => (
              <li key={move.id} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0">{move.name}</span>
                <span className="flex-shrink-0 whitespace-nowrap text-[var(--muted)]">{move.reps ?? `${move.seconds}s`}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-6 rounded-xl border border-[var(--accent-dim)] bg-[var(--card)] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium">{today.focusLabel}</h2>
          {alreadyTrainedToday ? (
            <span className="whitespace-nowrap rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)]">
              Sesión de hoy ✓
            </span>
          ) : (
            <Link
              href="/session"
              className="whitespace-nowrap rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-black"
            >
              Empezar sesión
            </Link>
          )}
        </div>
        {today.fatigueExplanation.changed && (
          <p className="mb-3 text-sm text-[var(--muted)]">{today.fatigueExplanation.message}</p>
        )}
        <ul className="flex flex-col gap-1.5 text-sm">
          {today.blocks.map((b) => (
            <li key={b.block} className="flex items-baseline justify-between gap-3">
              <Link href={`/exercises/${b.exercise.id}`} className="min-w-0 hover:text-[var(--accent)]">
                [{b.block}] {b.exercise.name}
              </Link>
              <span className="flex-shrink-0 whitespace-nowrap text-[var(--muted)]">
                {b.sets}×{b.prescription?.targetReps ?? b.prescription?.targetSeconds ?? b.exercise.recommendedReps ?? b.exercise.recommendedTime}
                {" · "}
                {b.exercise.restSeconds}s descanso
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-medium text-[var(--muted)]">Resto de la semana</h2>
        <div className="flex flex-col gap-1">
          {weekPreview.slice(1).map((day) => (
            <p key={day.dayIndex} className="text-sm text-[var(--muted)]">
              Día {day.dayIndex + 1}: {day.focusLabel}
            </p>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap gap-4 text-sm">
        <Link href="/history" className="text-[var(--accent)]">
          Historial
        </Link>
        <Link href="/progress" className="text-[var(--accent)]">
          Progreso
        </Link>
        <Link href="/skills" className="text-[var(--accent)]">
          Árbol de skills
        </Link>
        <Link href="/exercises" className="text-[var(--accent)]">
          Biblioteca de ejercicios
        </Link>
      </div>
    </main>
  );
}

function CapabilityBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-[var(--muted)]">
        <span>{label}</span>
        <span>{value}/100</span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--border)]">
        <div className="h-1.5 rounded-full bg-[var(--accent)]" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
