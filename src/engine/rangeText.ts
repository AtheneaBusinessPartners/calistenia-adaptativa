// Parseo de los rangos en texto libre de recommendedReps/recommendedTime
// (p.ej. "6-8", "8-10 por pierna", "hasta perder la forma"). Compartido por
// workoutSketch.ts (necesita la media, para estimar tiempo) y
// sessionPlanner.ts (necesita el extremo bajo, para no saltar directamente
// a la mitad del rango de un ejercicio nuevo al avanzar de progresión).

function parseNumbers(text: string | undefined): number[] {
  if (!text) return [];
  const matches = text.match(/\d+(\.\d+)?/g);
  return matches ? matches.map(Number) : [];
}

export function parseAverage(text: string | undefined): number | null {
  const nums = parseNumbers(text);
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function parseLowEnd(text: string | undefined): number | null {
  const nums = parseNumbers(text);
  if (nums.length === 0) return null;
  return Math.min(...nums);
}
