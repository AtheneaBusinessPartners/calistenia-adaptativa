"use client";

import { useMemo, useState } from "react";
import { nextAssessmentStep, shouldStopChain } from "../engine/adaptiveTest.js";
import { EXERCISES_BY_ID } from "../data/exercises.js";
import { SKILLS } from "../data/skills.js";
import { TRAINING_ENVIRONMENTS, resolveEquipment } from "../data/trainingEnvironments.js";
import { completeOnboarding } from "../lib/actions/onboarding.js";
import type { AssessmentEntry, ActivityLevel, ExerciseCategory, ExperienceLevel, GoalId, UserProfile } from "../engine/types.js";

// Contexto breve por categoría para que el test de evaluación no se sienta
// como una lista de preguntas sueltas — cada ejercicio explica brevemente
// qué está midiendo (petición del usuario: hacerlo más interactivo/menos
// aburrido, en la línea de apps como Better Me).
const CATEGORY_INFO: Record<ExerciseCategory, { emoji: string; label: string; why: string }> = {
  pull: { emoji: "💪", label: "Fuerza de tirón", why: "Cuánto puedes tirar de tu propio peso." },
  push: { emoji: "🙌", label: "Fuerza de empuje", why: "Cuánto puedes empujar tu propio peso." },
  legs: { emoji: "🦵", label: "Fuerza de pierna", why: "Fuerza y control de tus piernas." },
  core: { emoji: "🧘", label: "Core", why: "Estabilidad de tu tronco." },
  skill: { emoji: "🤸", label: "Equilibrio y control", why: "Tu control corporal y equilibrio." },
};

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

const GOAL_OPTIONS: { id: GoalId; label: string; emoji: string }[] = [
  { id: "strength", label: "Ganar fuerza", emoji: "💪" },
  { id: "muscle_mass", label: "Ganar masa muscular", emoji: "🏋️" },
  { id: "fat_loss", label: "Perder grasa", emoji: "🔥" },
  { id: "conditioning", label: "Mejorar condición física", emoji: "🏃" },
  { id: "learn_skills", label: "Aprender skills", emoji: "🤸" },
  { id: "mobility", label: "Mejorar movilidad", emoji: "🧘" },
  { id: "explosiveness", label: "Mejorar explosividad", emoji: "⚡" },
  { id: "endurance", label: "Mejorar resistencia", emoji: "⏱️" },
  { id: "competition", label: "Prepararme para una competición", emoji: "🏆" },
  { id: "specific_skill", label: "Conseguir una skill concreta", emoji: "🎯" },
];

const WEEKDAY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "L" },
  { value: 2, label: "M" },
  { value: 3, label: "X" },
  { value: 4, label: "J" },
  { value: 5, label: "V" },
  { value: 6, label: "S" },
  { value: 0, label: "D" },
];

const ENVIRONMENT_ICONS: Record<string, string> = {
  pure_calisthenics: "🤸",
  calisthenics_plus_gym: "🏋️",
  gym_for_calisthenics: "🏢",
  minimalist: "🎒",
  home: "🏠",
  park: "🌳",
};

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
    sessionDurationMinutes: 45,
    minSessionDurationMinutes: 20,
  });
  // 0=domingo..6=sábado (Date#getUTCDay()) — mismo criterio que usa el
  // calendario de /history para marcar qué días concretos tocan entrenar.
  const [trainingDays, setTrainingDays] = useState<number[]>([1, 2, 3, 4, 5]);

  function toggleTrainingDay(day: number) {
    setTrainingDays((prev) => {
      const isChecked = prev.includes(day);
      if (isChecked && prev.length <= 2) return prev;
      if (!isChecked && prev.length >= 6) return prev;
      return isChecked ? prev.filter((d) => d !== day) : [...prev, day];
    });
  }

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
      daysPerWeek: trainingDays.length,
      trainingDays,
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
      <p className="mb-2 text-xs text-[var(--muted)]">
        Paso {stepIndex + 1} de {STEPS.length}
      </p>
      <div className="mb-6 flex gap-1.5">
        {STEPS.map((s, i) => (
          <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= stepIndex ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`} />
        ))}
      </div>

      <div key={step} className="animate-fade-in-up">
      {step === "profile" && (
        <Section title="Sobre ti">
          <NumberField
            label="Edad"
            value={profile.age}
            onChange={(v) => setProfile((p) => ({ ...p, age: v }))}
            min={10}
            max={100}
          />
          <ChipSelect
            label="Sexo"
            value={profile.sex}
            options={[
              { value: "male", label: "Hombre" },
              { value: "female", label: "Mujer" },
              { value: "other", label: "Prefiero no decirlo" },
            ]}
            onChange={(v) => setProfile((p) => ({ ...p, sex: v }))}
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
          <ChipSelect
            label="Experiencia con calistenia"
            value={profile.calisthenicsExperience}
            options={[
              { value: "none", label: "Ninguna" },
              { value: "beginner", label: "Principiante" },
              { value: "intermediate", label: "Intermedia" },
              { value: "advanced", label: "Avanzada" },
            ]}
            onChange={(v) => setProfile((p) => ({ ...p, calisthenicsExperience: v }))}
          />
          <NumberField
            label="Horas de sueño (media)"
            value={profile.sleepHoursAvg}
            onChange={(v) => setProfile((p) => ({ ...p, sleepHoursAvg: v }))}
            min={0}
            max={14}
          />
          <ChipSelect
            label="Nivel de actividad diaria"
            value={profile.activityLevel}
            options={[
              { value: "sedentary", label: "Sedentario" },
              { value: "light", label: "Ligero" },
              { value: "moderate", label: "Moderado" },
              { value: "active", label: "Activo" },
            ]}
            onChange={(v) => setProfile((p) => ({ ...p, activityLevel: v }))}
          />
        </Section>
      )}

      {step === "goals" && (
        <Section title="Objetivos">
          <p className="mb-2 text-sm text-[var(--muted)]">Marca todos los que te interesen:</p>
          <div className="mb-5 grid grid-cols-2 gap-2">
            {GOAL_OPTIONS.map((g) => {
              const active = goals.includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => toggleGoal(g.id)}
                  className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left text-sm ${
                    active ? "border-[var(--accent)]" : "border-[var(--border)] text-[var(--muted)]"
                  }`}
                >
                  <span className="text-xl">{g.emoji}</span>
                  <span>{g.label}</span>
                </button>
              );
            })}
          </div>

          <p className="mb-2 text-sm text-[var(--muted)]">¿Cuál es tu prioridad número uno?</p>
          <div className="mb-4 flex flex-wrap gap-2">
            {goals.map((id) => {
              const opt = GOAL_OPTIONS.find((o) => o.id === id)!;
              const active = primaryGoal === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPrimaryGoal(id)}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    active ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--muted)]"
                  }`}
                >
                  {active ? "★ " : ""}
                  {opt.emoji} {opt.label}
                </button>
              );
            })}
          </div>
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
          <div className="flex flex-col gap-2 text-sm">
            <span>¿Qué días quieres entrenar?</span>
            <div className="flex gap-2">
              {WEEKDAY_OPTIONS.map((w) => {
                const active = trainingDays.includes(w.value);
                return (
                  <button
                    key={w.value}
                    type="button"
                    onClick={() => toggleTrainingDay(w.value)}
                    className={`flex h-10 w-10 items-center justify-center rounded-full border text-sm ${
                      active ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--muted)]"
                    }`}
                  >
                    {w.label}
                  </button>
                );
              })}
            </div>
            <span className="text-xs text-[var(--muted)]">
              {trainingDays.length} día{trainingDays.length === 1 ? "" : "s"} por semana. Los verás marcados en tu calendario.
            </span>
          </div>
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
                <span className="mr-2">{ENVIRONMENT_ICONS[env.id] ?? "🏋️"}</span>
                <span className="font-medium">{env.name}</span>
                <span className="ml-2 text-[var(--muted)]">{env.description}</span>
              </label>
            ))}
          </div>
        </Section>
      )}

      {step === "assessment" && (
        <Section title="Evaluación inicial">
          <div className="mb-5 flex gap-1.5">
            {ASSESSMENT_CHAINS.map((chain, i) => (
              <div
                key={chain}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i < assessmentIndex ? "bg-[var(--accent)]" : i === assessmentIndex && !assessmentDone ? "bg-[var(--accent-dim)]" : "bg-[var(--border)]"
                }`}
              />
            ))}
          </div>
          {!assessmentDone && currentExercise ? (
            <div key={currentExercise.id} className="animate-fade-in-up">
              <div className="mb-4 flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
                <span className="text-2xl">{CATEGORY_INFO[currentExercise.category].emoji}</span>
                <div className="text-sm">
                  <p className="font-medium">{CATEGORY_INFO[currentExercise.category].label}</p>
                  <p className="text-[var(--muted)]">{CATEGORY_INFO[currentExercise.category].why}</p>
                </div>
              </div>
              <p className="mb-1 text-center text-lg font-semibold">{currentExercise.name}</p>
              <p className="mb-4 text-center text-sm text-[var(--muted)]">
                {currentExercise.masteryCriteria.type === "time" ? "¿Cuántos segundos aguantas?" : "¿Cuántas repeticiones haces?"}
              </p>
              <div className="mb-5 flex items-center justify-center gap-4">
                <StepperButton label="Restar" onClick={() => setAnswerValue(String(Math.max(0, (Number(answerValue) || 0) - 1)))}>
                  −
                </StepperButton>
                <input
                  type="number"
                  min={0}
                  value={answerValue}
                  onChange={(e) => setAnswerValue(e.target.value)}
                  placeholder="0"
                  className="w-20 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-2 text-center text-2xl font-semibold outline-none focus:border-[var(--accent)]"
                />
                <StepperButton label="Sumar" accent onClick={() => setAnswerValue(String((Number(answerValue) || 0) + 1))}>
                  +
                </StepperButton>
              </div>
              <button
                onClick={() => submitAssessmentAnswer(true)}
                className="w-full rounded-lg bg-[var(--accent)] px-3 py-3 font-medium text-black"
              >
                ✓ Lo consigo
              </button>
              <button
                onClick={() => submitAssessmentAnswer(false)}
                className="mt-2 w-full rounded-lg border border-[var(--border)] px-3 py-3 text-sm text-[var(--muted)]"
              >
                Todavía no puedo
              </button>
            </div>
          ) : (
            <p className="animate-fade-in-up text-sm text-[var(--muted)]">🎉 Evaluación completa — {answered.length} ejercicios probados.</p>
          )}
        </Section>
      )}

      {step === "review" && (
        <Section title="Todo listo">
          <p className="mb-4 text-sm text-[var(--muted)]">
            {profile.age} años · objetivo principal: {GOAL_OPTIONS.find((g) => g.id === primaryGoal)?.label} ·{" "}
            {trainingDays.length} días/semana · {answered.length} ejercicios evaluados.
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
      </div>

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

function StepperButton({
  label,
  onClick,
  accent,
  children,
}: {
  label: string;
  onClick: () => void;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex h-11 w-11 items-center justify-center rounded-full border text-xl ${
        accent ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--muted)]"
      }`}
    >
      {children}
    </button>
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
    <div className="flex flex-col gap-1 text-sm">
      <span>{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Restar"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--border)] text-lg text-[var(--muted)]"
        >
          −
        </button>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-center outline-none focus:border-[var(--accent)]"
        />
        <button
          type="button"
          aria-label="Sumar"
          onClick={() => onChange(max !== undefined ? Math.min(max, value + 1) : value + 1)}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--accent)] text-lg text-[var(--accent)]"
        >
          +
        </button>
      </div>
    </div>
  );
}

function ChipSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <span>{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              value === o.value ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--muted)]"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
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
