"use client";

import { useMemo, useState } from "react";
import { nextAssessmentStep, shouldStopChain } from "../engine/adaptiveTest.js";
import { EXERCISES_BY_ID } from "../data/exercises.js";
import { SKILLS } from "../data/skills.js";
import { TRAINING_ENVIRONMENTS, resolveEquipment } from "../data/trainingEnvironments.js";
import { completeOnboarding } from "../lib/actions/onboarding.js";
import type { AssessmentEntry, ActivityLevel, ExperienceLevel, GoalId, UserProfile } from "../engine/types.js";

// Cadenas que cubre el test adaptativo de onboarding: una por patrón básico
// (tirón, empuje vertical, empuje horizontal, pierna, core, equilibrio) —
// suficiente para arrancar el perfil de capacidades sin hacer un test
// interminable. Reutiliza nextAssessmentStep/shouldStopChain tal cual.
const ASSESSMENT_CHAINS = [
  "vertical_pull_main",
  "pushup_chain",
  "dip_chain",
  "core_anti_extension_chain",
  "squat_chain",
  "handstand_chain",
];

const GOAL_OPTIONS: { id: GoalId; label: string }[] = [
  { id: "strength", label: "Ganar fuerza" },
  { id: "muscle_mass", label: "Ganar masa muscular" },
  { id: "fat_loss", label: "Perder grasa" },
  { id: "conditioning", label: "Mejorar condición física" },
  { id: "learn_skills", label: "Aprender skills" },
  { id: "mobility", label: "Mejorar movilidad" },
  { id: "explosiveness", label: "Mejorar explosividad" },
  { id: "endurance", label: "Mejorar resistencia" },
  { id: "competition", label: "Prepararme para una competición" },
  { id: "specific_skill", label: "Conseguir una skill concreta" },
];

type Step = "profile" | "goals" | "availability" | "equipment" | "assessment" | "review";
const STEPS: Step[] = ["profile", "goals", "availability", "equipment", "assessment", "review"];

export function OnboardingWizard() {
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex]!;
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [profile, setProfile] = useState({
    age: 25,
    sex: "other" as UserProfile["sex"],
    heightCm: 175,
    weightKg: 70,
    trainingExperienceYears: 1,
    calisthenicsExperience: "beginner" as ExperienceLevel,
    sleepHoursAvg: 7,
    activityLevel: "moderate" as ActivityLevel,
  });

  const [goals, setGoals] = useState<GoalId[]>(["strength"]);
  const [primaryGoal, setPrimaryGoal] = useState<GoalId>("strength");
  const [primarySkillTarget, setPrimarySkillTarget] = useState<string>(SKILLS[0]!.id);

  const [availability, setAvailability] = useState({
    daysPerWeek: 4,
    sessionDurationMinutes: 45,
    minSessionDurationMinutes: 20,
  });

  const [environmentId, setEnvironmentId] = useState("home");

  const [assessmentIndex, setAssessmentIndex] = useState(0);
  const [answered, setAnswered] = useState<AssessmentEntry[]>([]);
  const [answerValue, setAnswerValue] = useState("");

  const currentChainKey = ASSESSMENT_CHAINS[assessmentIndex];
  const currentStep = useMemo(() => (currentChainKey ? nextAssessmentStep(currentChainKey, answered) : null), [currentChainKey, answered]);
  const currentExercise = currentStep ? EXERCISES_BY_ID[currentStep.exerciseId] : null;
  const assessmentDone = assessmentIndex >= ASSESSMENT_CHAINS.length;

  function goNext() {
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }
  function goBack() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  // Desmarcar el último objetivo (o el que sea `primaryGoal`) dejaba
  // `goals: []` y un `primaryGoal` obsoleto que ya no aparecía en la lista
  // de opciones: el desplegable "Objetivo principal" se quedaba vacío y sin
  // ninguna opción seleccionable, y el perfil se guardaba con un objetivo
  // principal que el usuario ya no había marcado. Se exige al menos un
  // objetivo siempre, y si se desmarca el que era principal, el primero que
  // quede pasa a serlo automáticamente.
  function toggleGoal(id: GoalId) {
    setGoals((prev) => {
      const isChecked = prev.includes(id);
      if (isChecked && prev.length === 1) return prev;
      const next = isChecked ? prev.filter((g) => g !== id) : [...prev, id];
      if (isChecked && id === primaryGoal) setPrimaryGoal(next[0]!);
      return next;
    });
  }

  function submitAssessmentAnswer(didIt: boolean) {
    if (!currentExercise || !currentChainKey) return;
    const isTime = currentExercise.masteryCriteria.type === "time";
    const value = didIt ? Number(answerValue) || 0 : 0;
    const entry: AssessmentEntry = isTime
      ? { exerciseId: currentExercise.id, seconds: value }
      : { exerciseId: currentExercise.id, reps: value };

    const updatedAnswered = [...answered, entry];
    setAnswered(updatedAnswered);
    setAnswerValue("");

    if (shouldStopChain(currentChainKey, updatedAnswered) || !nextAssessmentStep(currentChainKey, updatedAnswered)) {
      setAssessmentIndex((i) => i + 1);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    const equipment = resolveEquipment(environmentId);
    const finalProfile: UserProfile = {
      ...profile,
      goals,
      primaryGoal,
      primarySkillTarget: primaryGoal === "specific_skill" ? primarySkillTarget : undefined,
      daysPerWeek: availability.daysPerWeek,
      sessionDurationMinutes: availability.sessionDurationMinutes,
      minSessionDurationMinutes: availability.minSessionDurationMinutes,
      equipment,
    };
    try {
      await completeOnboarding({ profile: finalProfile, assessment: answered });
    } catch (err) {
      if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
      setSubmitError(err instanceof Error ? err.message : "Error al guardar. Inténtalo de nuevo.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <p className="mb-4 text-sm text-[var(--muted)]">
        Paso {stepIndex + 1} de {STEPS.length}
      </p>

      {step === "profile" && (
        <Section title="Sobre ti">
          <NumberField
            label="Edad"
            value={profile.age}
            onChange={(v) => setProfile((p) => ({ ...p, age: v }))}
            min={10}
            max={100}
          />
          <SelectField
            label="Sexo"
            value={profile.sex}
            options={[
              { value: "male", label: "Hombre" },
              { value: "female", label: "Mujer" },
              { value: "other", label: "Prefiero no decirlo" },
            ]}
            onChange={(v) => setProfile((p) => ({ ...p, sex: v as UserProfile["sex"] }))}
          />
          <NumberField
            label="Altura (cm)"
            value={profile.heightCm}
            onChange={(v) => setProfile((p) => ({ ...p, heightCm: v }))}
            min={100}
            max={250}
          />
          <NumberField
            label="Peso (kg)"
            value={profile.weightKg}
            onChange={(v) => setProfile((p) => ({ ...p, weightKg: v }))}
            min={25}
            max={250}
          />
          <NumberField
            label="Años entrenando"
            value={profile.trainingExperienceYears}
            onChange={(v) => setProfile((p) => ({ ...p, trainingExperienceYears: v }))}
            min={0}
            max={80}
          />
          <SelectField
            label="Experiencia con calistenia"
            value={profile.calisthenicsExperience}
            options={[
              { value: "none", label: "Ninguna" },
              { value: "beginner", label: "Principiante" },
              { value: "intermediate", label: "Intermedia" },
              { value: "advanced", label: "Avanzada" },
            ]}
            onChange={(v) => setProfile((p) => ({ ...p, calisthenicsExperience: v as ExperienceLevel }))}
          />
          <NumberField
            label="Horas de sueño (media)"
            value={profile.sleepHoursAvg}
            onChange={(v) => setProfile((p) => ({ ...p, sleepHoursAvg: v }))}
            min={0}
            max={14}
          />
          <SelectField
            label="Nivel de actividad diaria"
            value={profile.activityLevel}
            options={[
              { value: "sedentary", label: "Sedentario" },
              { value: "light", label: "Ligero" },
              { value: "moderate", label: "Moderado" },
              { value: "active", label: "Activo" },
            ]}
            onChange={(v) => setProfile((p) => ({ ...p, activityLevel: v as ActivityLevel }))}
          />
        </Section>
      )}

      {step === "goals" && (
        <Section title="Objetivos">
          <p className="mb-2 text-sm text-[var(--muted)]">Marca todos los que te interesen:</p>
          <div className="mb-4 flex flex-col gap-2">
            {GOAL_OPTIONS.map((g) => (
              <label key={g.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={goals.includes(g.id)} onChange={() => toggleGoal(g.id)} />
                {g.label}
              </label>
            ))}
          </div>
          <SelectField
            label="Objetivo principal"
            value={primaryGoal}
            options={goals.map((g) => ({ value: g, label: GOAL_OPTIONS.find((o) => o.id === g)!.label }))}
            onChange={(v) => setPrimaryGoal(v as GoalId)}
          />
          {primaryGoal === "specific_skill" && (
            <SelectField
              label="¿Qué skill?"
              value={primarySkillTarget}
              options={SKILLS.map((s) => ({ value: s.id, label: s.name }))}
              onChange={setPrimarySkillTarget}
            />
          )}
        </Section>
      )}

      {step === "availability" && (
        <Section title="Disponibilidad">
          <NumberField
            label="Días por semana"
            value={availability.daysPerWeek}
            onChange={(v) => setAvailability((a) => ({ ...a, daysPerWeek: Math.min(6, Math.max(2, v)) }))}
            min={2}
            max={6}
          />
          <NumberField
            label="Duración habitual de la sesión (min)"
            value={availability.sessionDurationMinutes}
            onChange={(v) => setAvailability((a) => ({ ...a, sessionDurationMinutes: v }))}
            min={10}
            max={240}
          />
          <NumberField
            label="Duración mínima si tienes poco tiempo (min)"
            value={availability.minSessionDurationMinutes}
            onChange={(v) => setAvailability((a) => ({ ...a, minSessionDurationMinutes: v }))}
            min={5}
            max={240}
          />
        </Section>
      )}

      {step === "equipment" && (
        <Section title="Material disponible">
          <div className="flex flex-col gap-2">
            {TRAINING_ENVIRONMENTS.map((env) => (
              <label
                key={env.id}
                className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${
                  environmentId === env.id ? "border-[var(--accent)]" : "border-[var(--border)]"
                }`}
              >
                <input
                  type="radio"
                  name="environment"
                  className="mr-2"
                  checked={environmentId === env.id}
                  onChange={() => setEnvironmentId(env.id)}
                />
                <span className="font-medium">{env.name}</span>
                <span className="ml-2 text-[var(--muted)]">{env.description}</span>
              </label>
            ))}
          </div>
        </Section>
      )}

      {step === "assessment" && (
        <Section title="Evaluación inicial">
          {!assessmentDone && currentExercise ? (
            <div>
              <p className="mb-1 text-sm text-[var(--muted)]">
                Cadena {assessmentIndex + 1} de {ASSESSMENT_CHAINS.length}
              </p>
              <p className="mb-3 font-medium">{currentExercise.name}</p>
              <p className="mb-3 text-sm text-[var(--muted)]">
                {currentExercise.masteryCriteria.type === "time" ? "¿Cuántos segundos aguantas?" : "¿Cuántas repeticiones haces?"}
              </p>
              <input
                type="number"
                min={0}
                value={answerValue}
                onChange={(e) => setAnswerValue(e.target.value)}
                placeholder="0 si no puedes hacerlo"
                className="mb-3 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 outline-none focus:border-[var(--accent)]"
              />
              <button
                onClick={() => submitAssessmentAnswer(true)}
                className="w-full rounded-lg bg-[var(--accent)] px-3 py-2 font-medium text-black"
              >
                Siguiente
              </button>
              <button onClick={() => submitAssessmentAnswer(false)} className="mt-2 w-full text-sm text-[var(--muted)] underline">
                No puedo hacerlo
              </button>
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">Evaluación completa — {answered.length} ejercicios probados.</p>
          )}
        </Section>
      )}

      {step === "review" && (
        <Section title="Todo listo">
          <p className="mb-4 text-sm text-[var(--muted)]">
            {profile.age} años · objetivo principal: {GOAL_OPTIONS.find((g) => g.id === primaryGoal)?.label} ·{" "}
            {availability.daysPerWeek} días/semana · {answered.length} ejercicios evaluados.
          </p>
          {submitError && <p className="mb-3 text-sm text-[var(--danger)]">{submitError}</p>}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full rounded-lg bg-[var(--accent)] px-3 py-2 font-medium text-black disabled:opacity-50"
          >
            {submitting ? "Guardando…" : "Empezar"}
          </button>
        </Section>
      )}

      <div className="mt-6 flex justify-between">
        <button onClick={goBack} disabled={stepIndex === 0} className="text-sm text-[var(--muted)] disabled:opacity-0">
          ← Atrás
        </button>
        {step !== "assessment" && step !== "review" && (
          <button onClick={goNext} className="text-sm text-[var(--accent)]">
            Siguiente →
          </button>
        )}
        {step === "assessment" && assessmentDone && (
          <button onClick={goNext} className="text-sm text-[var(--accent)]">
            Siguiente →
          </button>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 outline-none focus:border-[var(--accent)]"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 outline-none focus:border-[var(--accent)]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
