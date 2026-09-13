import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server.js";
import { getLatestAssessment, getProfile } from "../../lib/repository.js";
import { computeCapabilityProfile } from "../../engine/capabilityProfile.js";
import { evaluateSkillGate, explainLimitation } from "../../engine/skillGate.js";
import { SKILLS } from "../../data/skills.js";
import { EXERCISES_BY_ID } from "../../data/exercises.js";

export default async function SkillsPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const profile = await getProfile(supabase, userData.user.id);
  if (!profile) redirect("/onboarding");

  const assessment = await getLatestAssessment(supabase, userData.user.id);
  const capabilityProfile = computeCapabilityProfile(assessment, EXERCISES_BY_ID);

  const skillsByDifficulty = [...SKILLS].sort((a, b) => a.difficultyTier - b.difficultyTier);

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <Link href="/dashboard" className="mb-4 inline-block text-sm text-[var(--muted)]">
        ← Volver
      </Link>
      <h1 className="mb-6 text-xl font-semibold">Árbol de skills</h1>

      <div className="flex flex-col gap-4">
        {skillsByDifficulty.map((skill) => {
          const gate = evaluateSkillGate(skill, assessment, capabilityProfile);
          const pct = Math.round(gate.overallReadiness * 100);
          const isTarget = profile.primarySkillTarget === skill.id;

          return (
            <div
              key={skill.id}
              id={skill.id}
              className={`rounded-xl border p-4 ${isTarget ? "border-[var(--accent)]" : "border-[var(--border)]"} bg-[var(--card)]`}
            >
              <div className="mb-1 flex items-center justify-between">
                <h2 className="font-medium">
                  {skill.name} {isTarget && <span className="text-xs text-[var(--accent)]">(tu objetivo)</span>}
                </h2>
                <span className="text-sm text-[var(--muted)]">Tier {skill.difficultyTier} · {pct}%</span>
              </div>
              <p className="mb-3 text-sm text-[var(--muted)]">{skill.description}</p>
              <div className="flex flex-col gap-1">
                {gate.requirementStatuses.map((status) => (
                  <p key={status.requirement.label} className="text-sm">
                    <span className={status.met ? "text-[var(--success)]" : "text-[var(--danger)]"}>{status.met ? "✔" : "✘"}</span>{" "}
                    {explainLimitation(status)}
                  </p>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
