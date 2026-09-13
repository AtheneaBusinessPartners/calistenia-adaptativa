import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server.js";
import { getProfile, hasTrainingSessionToday } from "../../lib/repository.js";
import { computeTodayContext } from "../../lib/planForToday.js";
import { CheckInForm } from "../../components/CheckInForm.js";
import { SessionLogger } from "../../components/SessionLogger.js";

export default async function SessionPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const profile = await getProfile(supabase, userData.user.id);
  if (!profile) redirect("/onboarding");

  if (await hasTrainingSessionToday(supabase, userData.user.id)) {
    return (
      <main className="mx-auto flex min-h-[80vh] max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-xl font-semibold">Ya has registrado tu sesión de hoy</h1>
        <p className="text-sm text-[var(--muted)]">Vuelve mañana para la siguiente. Puedes revisar tu progreso mientras tanto.</p>
        <Link href="/dashboard" className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black">
          Volver al panel
        </Link>
      </main>
    );
  }

  const { today, todayCheckIn } = await computeTodayContext(supabase, userData.user.id, profile);

  if (!todayCheckIn) return <CheckInForm />;
  return <SessionLogger blocks={today.blocks} archetype={today.archetype} />;
}
