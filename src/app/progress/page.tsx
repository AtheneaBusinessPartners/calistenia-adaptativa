import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server.js";
import { getLatestAssessment, getProfile } from "../../lib/repository.js";
import { computeCapabilityProfile } from "../../engine/capabilityProfile.js";
import { evaluateSkillGate } from "../../engine/skillGate.js";
import { CAPABILITIES } from "../../data/capabilities.js";
import { SKILLS } from "../../data/skills.js";
import { EXERCISES_BY_ID } from "../../data/exercises.js";

export default async function ProgressPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const profile = await getProfile(supabase, userData.user.id);
  if (!profile) redirect("/onboarding");

  const assessment = await getLatestAssessment(supabase, userData.user.id);
  const capabilityProfile = computeCapabilityProfile(assessment, EXERCISES_BY_ID);

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <Link href="/dashboard" className="mb-4 inline-block text-sm text-[var(--muted)]">
        ← Volver
      </Link>
      <h1 className="mb-6 text-xl font-semibold">Tu progreso</h1>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-[var(--muted)]">Perfil de capacidades</h2>
        <div className="flex flex-col gap-3">
          {CAPABILITIES.map((cap) => (
            <div key={cap.id}>
              <div className="flex justify-between text-sm">
                <span>{cap.name}</span>
                <span className="text-[var(--muted)]">{capabilityProfile[cap.id]}/100</span>
              </div>
              <div className="h-2 rounded-full bg-[var(--border)]">
                <div className="h-2 rounded-full bg-[var(--accent)]" style={{ width: `${capabilityProfile[cap.id]}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-[var(--muted)]">Skills</h2>
        <div className="flex flex-col gap-2">
          {SKILLS.map((skill) => {
            const gate = evaluateSkillGate(skill, assessment, capabilityProfile);
            const pct = Math.round(gate.overallReadiness * 100);
            const status = pct >= 95 ? "DOMINADA" : pct <= 2 ? "BLOQUEADA" : `${pct}%`;
            return (
              <Link
                key={skill.id}
                href={`/skills#${skill.id}`}
                className="flex justify-between rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm hover:border-[var(--accent)]"
              >
                <span>{skill.name}</span>
                <span className="text-[var(--muted)]">{status}</span>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
