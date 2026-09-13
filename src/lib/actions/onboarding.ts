"use server";

import { redirect } from "next/navigation";
import { createClient } from "../supabase/server.js";
import { upsertProfile, insertAssessmentEntries } from "../repository.js";
import type { AssessmentEntry, UserProfile } from "../../engine/types.js";

export interface OnboardingPayload {
  profile: UserProfile;
  assessment: AssessmentEntry[];
}

export async function completeOnboarding(payload: OnboardingPayload) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) redirect("/login");

  await upsertProfile(supabase, userData.user.id, payload.profile);
  await insertAssessmentEntries(supabase, userData.user.id, payload.assessment);

  redirect("/dashboard");
}
