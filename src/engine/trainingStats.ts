// Estadísticas de calendario/adherencia (petición del usuario: un
// calendario y un resumen semanal/mensual en el dashboard). Toda la
// aritmética de fechas usa UTC de forma consistente — igual que
// `hasTrainingSessionToday` en repository.ts, que ya compara
// `performed_at` (columna `date`, fijada por `default current_date` de
// Postgres, en UTC) contra `new Date().toISOString().slice(0, 10)`. Usar
// aquí un "hoy" en hora local en vez de UTC crearía una segunda definición
// de "hoy" que podría no coincidir con la que ya usa el resto de la app.

export interface WeeklyStats {
  sessionsThisWeek: number;
  targetPerWeek: number;
  adherencePct: number; // 0-100
}

export interface MonthlyStats {
  sessionsThisMonth: number;
  currentStreakDays: number;
}

export interface CalendarDay {
  date: string; // YYYY-MM-DD
  day: number;
  inMonth: boolean;
  isToday: boolean;
  trained: boolean;
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Lunes (00:00 UTC) de la semana ISO a la que pertenece `d`. */
function startOfWeekMonday(d: Date): Date {
  const day = d.getUTCDay(); // 0=domingo .. 6=sábado
  const diff = (day === 0 ? -6 : 1) - day;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff));
}

export function computeWeeklyStats(sessionDates: string[], targetPerWeek: number, today: Date = new Date()): WeeklyStats {
  const weekStart = startOfWeekMonday(today);
  const weekStartStr = toDateOnly(weekStart);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
  const weekEndStr = toDateOnly(weekEnd);

  const sessionsThisWeek = sessionDates.filter((d) => d >= weekStartStr && d < weekEndStr).length;
  const adherencePct = targetPerWeek > 0 ? Math.min(100, Math.round((sessionsThisWeek / targetPerWeek) * 100)) : 0;
  return { sessionsThisWeek, targetPerWeek, adherencePct };
}

export function computeMonthlyStats(sessionDates: string[], today: Date = new Date()): MonthlyStats {
  const monthPrefix = toDateOnly(today).slice(0, 7); // YYYY-MM
  const sessionsThisMonth = sessionDates.filter((d) => d.startsWith(monthPrefix)).length;

  const trained = new Set(sessionDates);
  const cursor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  // Si hoy todavía no se ha entrenado, la racha no se rompe solo porque el
  // día de hoy aún no ha terminado — se cuenta desde ayer hacia atrás.
  if (!trained.has(toDateOnly(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  let currentStreakDays = 0;
  while (trained.has(toDateOnly(cursor))) {
    currentStreakDays += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return { sessionsThisMonth, currentStreakDays };
}

/**
 * Cuadrícula de semanas completas (lunes-domingo) que cubren el mes
 * `month` (0-indexado) de `year`, con los días de relleno de los meses
 * adyacentes marcados como `inMonth: false` — así el calendario siempre se
 * puede pintar como una tabla de 7 columnas sin huecos.
 */
export function buildCalendarMonth(sessionDates: string[], year: number, month: number, today: Date = new Date()): CalendarDay[] {
  const trained = new Set(sessionDates);
  const todayStr = toDateOnly(today);
  const gridStart = startOfWeekMonday(new Date(Date.UTC(year, month, 1)));

  const days: CalendarDay[] = [];
  const cursor = new Date(gridStart);
  for (let i = 0; i < 42; i++) {
    const dateStr = toDateOnly(cursor);
    days.push({
      date: dateStr,
      day: cursor.getUTCDate(),
      inMonth: cursor.getUTCMonth() === month,
      isToday: dateStr === todayStr,
      trained: trained.has(dateStr),
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  // 42 = 6 semanas fijas; si el mes cabe en 5, se recorta la última semana
  // completamente ajena al mes para no dejar una fila vacía de más.
  while (days.length > 35 && days.slice(-7).every((d) => !d.inMonth)) {
    days.splice(-7);
  }
  return days;
}
