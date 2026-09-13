"use client";

import { useState, useTransition } from "react";
import { submitCheckIn } from "../lib/actions/session.js";
import { checkInSafetyMessage } from "../engine/checkIn.js";
import type { CheckIn, FeelingLevel, LevelRating, PainSeverity, SleepQuality } from "../engine/types.js";

const FEELING_OPTIONS: { value: FeelingLevel; label: string }[] = [
  { value: "very_tired", label: "Muy cansado" },
  { value: "tired", label: "Cansado" },
  { value: "normal", label: "Normal" },
  { value: "good", label: "Bien" },
  { value: "excellent", label: "Excelente" },
];
const LEVEL_OPTIONS: { value: LevelRating; label: string }[] = [
  { value: "low", label: "Bajo" },
  { value: "medium", label: "Medio" },
  { value: "high", label: "Alto" },
];
const SLEEP_OPTIONS: { value: SleepQuality; label: string }[] = [
  { value: "poor", label: "Mala" },
  { value: "fair", label: "Regular" },
  { value: "good", label: "Buena" },
];

export function CheckInForm() {
  const [feeling, setFeeling] = useState<FeelingLevel>("normal");
  const [sleepQuality, setSleepQuality] = useState<SleepQuality>("good");
  const [stress, setStress] = useState<LevelRating>("low");
  const [motivation, setMotivation] = useState<LevelRating>("medium");
  const [hasPain, setHasPain] = useState(false);
  const [painDescription, setPainDescription] = useState("");
  const [painSeverity, setPainSeverity] = useState<PainSeverity>("mild");
  const [pending, startTransition] = useTransition();

  const checkIn: CheckIn = {
    feeling,
    sleepQuality,
    stress,
    motivation,
    painZones: hasPain && painDescription ? [painDescription] : undefined,
    painSeverity: hasPain ? painSeverity : undefined,
  };
  const safety = checkInSafetyMessage(checkIn);

  function handleSubmit() {
    startTransition(async () => {
      await submitCheckIn(checkIn);
    });
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold">¿Cómo te encuentras hoy?</h1>

      <div className="mb-4">
        <p className="mb-2 text-sm text-[var(--muted)]">Sensación general</p>
        <div className="flex flex-wrap gap-2">
          {FEELING_OPTIONS.map((o) => (
            <Chip key={o.value} label={o.label} active={feeling === o.value} onClick={() => setFeeling(o.value)} />
          ))}
        </div>
      </div>

      <div className="mb-4">
        <p className="mb-2 text-sm text-[var(--muted)]">Calidad del sueño</p>
        <div className="flex gap-2">
          {SLEEP_OPTIONS.map((o) => (
            <Chip key={o.value} label={o.label} active={sleepQuality === o.value} onClick={() => setSleepQuality(o.value)} />
          ))}
        </div>
      </div>

      <div className="mb-4">
        <p className="mb-2 text-sm text-[var(--muted)]">Estrés</p>
        <div className="flex gap-2">
          {LEVEL_OPTIONS.map((o) => (
            <Chip key={o.value} label={o.label} active={stress === o.value} onClick={() => setStress(o.value)} />
          ))}
        </div>
      </div>

      <div className="mb-4">
        <p className="mb-2 text-sm text-[var(--muted)]">Motivación</p>
        <div className="flex gap-2">
          {LEVEL_OPTIONS.map((o) => (
            <Chip key={o.value} label={o.label} active={motivation === o.value} onClick={() => setMotivation(o.value)} />
          ))}
        </div>
      </div>

      <div className="mb-6">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={hasPain} onChange={(e) => setHasPain(e.target.checked)} />
          Tengo dolor (no solo fatiga) en alguna zona
        </label>
        {hasPain && (
          <div className="mt-2 flex flex-col gap-2">
            <input
              placeholder="¿Dónde? (p.ej. hombro derecho)"
              value={painDescription}
              onChange={(e) => setPainDescription(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
            <div className="flex gap-2">
              {(["mild", "moderate", "severe"] as PainSeverity[]).map((s) => (
                <Chip
                  key={s}
                  label={s === "mild" ? "Leve" : s === "moderate" ? "Moderado" : "Severo"}
                  active={painSeverity === s}
                  onClick={() => setPainSeverity(s)}
                />
              ))}
            </div>
          </div>
        )}
        {safety.shouldWarn && <p className="mt-3 text-sm text-[var(--danger)]">{safety.message}</p>}
      </div>

      <button
        onClick={handleSubmit}
        disabled={pending}
        className="w-full rounded-lg bg-[var(--accent)] px-3 py-2 font-medium text-black disabled:opacity-50"
      >
        {pending ? "Guardando…" : "Ver mi sesión de hoy"}
      </button>
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-sm ${
        active ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--muted)]"
      }`}
    >
      {label}
    </button>
  );
}
