"use server";

import { redirect } from "next/navigation";
import { createClient } from "../supabase/server.js";
import { insertCheckIn, insertTrainingSession, type LoggedSet } from "../repository.js";
import type { CheckIn } from "../../engine/types.js";

export async function submitCheckIn(checkIn: CheckIn) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  await insertCheckIn(supabase, data.user.id, checkIn);
  redirect("/session");
}

export async function logSession(archetype: string | undefined, loggedSets: LoggedSet[]) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  await insertTrainingSession(supabase, data.user.id, archetype, loggedSets);
  redirect("/dashboard");
}
