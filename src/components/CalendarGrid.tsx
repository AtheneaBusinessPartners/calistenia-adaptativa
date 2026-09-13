"use client";

import { useState } from "react";
import type { CalendarDay } from "../engine/trainingStats.js";

const WEEKDAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];
const MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function formatLong(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return `${day} de ${MONTH_NAMES[month! - 1]} de ${year}`;
}

function statusMessage(day: CalendarDay): string {
  if (day.trained) return `✓ Entrenaste el ${formatLong(day.date)}.`;
  if (day.isToday && day.planned) return "💪 Hoy toca entrenar.";
  if (!day.isPast && day.planned) return `💪 Vas a entrenar el ${formatLong(day.date)}.`;
  if (day.isPast && day.planned) return `No entrenaste el ${formatLong(day.date)}.`;
  return `Sin sesión planificada el ${formatLong(day.date)}.`;
}

export function CalendarGrid({ days }: { days: CalendarDay[] }) {
  const today = days.find((d) => d.isToday) ?? null;
  const [selected, setSelected] = useState<CalendarDay | null>(today);

  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="text-center text-xs text-[var(--muted)]">
            {w}
          </div>
        ))}
        {days.map((d) => (
          <button
            key={d.date}
            type="button"
            onClick={() => setSelected(d)}
            disabled={!d.inMonth}
            className={`flex aspect-square items-center justify-center rounded-lg text-xs ${
              !d.inMonth
                ? "text-[var(--border)]"
                : d.trained
                  ? "bg-[var(--accent)] font-medium text-black"
                  : d.planned && !d.isPast
                    ? "border border-[var(--accent-dim)] text-[var(--foreground)]"
                    : "text-[var(--muted)]"
            } ${selected?.date === d.date ? "ring-2 ring-[var(--accent)]" : ""}`}
          >
            {d.day}
          </button>
        ))}
      </div>
      {selected && <p className="mt-3 text-sm text-[var(--muted)]">{statusMessage(selected)}</p>}
    </div>
  );
}
