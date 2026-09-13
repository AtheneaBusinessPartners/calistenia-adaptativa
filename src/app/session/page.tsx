import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server.js";
import { getProfile } from "../../lib/repository.js";
import { computeTodayContext } from "../../lib/planForToday.js";
import { CheckInForm } from "../../components/CheckInForm.js";
import { SessionLogger } from "../../components/SessionLogger.js";

export default async function SessionPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const profile = await getProfile(supabase, userData.user.id);
  if (!profile) redirect("/onboarding");

  const { today, todayCheckIn } = await computeTodayContext(supabase, userData.user.id, profile);

  if (!todayCheckIn) return <CheckInForm />;
  return <SessionLogger blocks={today.blocks} archetype={today.archetype} />;
}
