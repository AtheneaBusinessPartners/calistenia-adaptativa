import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server.js";
import { getProfile, getSessionDates } from "../../lib/repository.js";
import { buildCalendarMonth, computeMonthlyStats, computeWeeklyStats } from "../../engine/trainingStats.js";

const WEEKDAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];
const MONTH_LABELS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export default async function HistoryPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const profile = await getProfile(supabase, userData.user.id);
  if (!profile) redirect("/onboarding");

  const sessionDates = await getSessionDates(supabase, userData.user.id);
  const today = new Date();

  const weekly = computeWeeklyStats(sessionDates, profile.daysPerWeek, today);
  const monthly = computeMonthlyStats(sessionDates, today);
  const calendarDays = buildCalendarMonth(sessionDates, today.getUTCFullYear(), today.getUTCMonth(), today);

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <Link href="/dashboard" className="mb-4 inline-block text-sm text-[var(--muted)]">
        ← Volver
      </Link>
      <h1 className="mb-6 text-xl font-semibold">Tu historial</h1>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <StatCard
          label="Esta semana"
          value={`${weekly.sessionsThisWeek}/${weekly.targetPerWeek}`}
          detail={`${weekly.adherencePct}% de tu objetivo`}
        />
        <StatCard
          label="Racha actual"
          value={`${monthly.currentStreakDays} día${monthly.currentStreakDays === 1 ? "" : "s"}`}
          detail={`${monthly.sessionsThisMonth} sesiones este mes`}
        />
      </div>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="mb-3 text-sm font-medium text-[var(--muted)]">
          {MONTH_LABELS[today.getUTCMonth()]} {today.getUTCFullYear()}
        </h2>
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAY_LABELS.map((w) => (
            <div key={w} className="text-center text-xs text-[var(--muted)]">
              {w}
            </div>
          ))}
          {calendarDays.map((d) => (
            <div
              key={d.date}
              className={`flex aspect-square items-center justify-center rounded-lg text-xs ${
                !d.inMonth
                  ? "text-[var(--border)]"
                  : d.trained
                    ? "bg-[var(--accent)] font-medium text-black"
                    : d.isToday
                      ? "border border-[var(--accent)] text-[var(--foreground)]"
                      : "text-[var(--muted)]"
              }`}
            >
              {d.day}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <p className="mb-1 text-xs text-[var(--muted)]">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-[var(--muted)]">{detail}</p>
    </div>
  );
}
