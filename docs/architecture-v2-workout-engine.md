# Workout engine — V2 (FASE 2)

FASE 2 añade lo que FASE 1 dejó fuera a propósito (ver §9 de
`architecture-v1.md`): un plan de **varios días por semana**, la
**progresión de volumen sesión a sesión** (no solo "qué decisión tomar" sino
"cuántas reps exactamente la próxima vez"), y la **reorganización cuando
cambia la disponibilidad** (§20 del brief). Sigue sin haber UI ni base de
datos real — el "historial" es una estructura en memoria que el motor
consume y produce, como en FASE 1.

## 1. Qué es nuevo aquí vs qué ya existía

FASE 1 ya resuelve "dame la mejor sesión de hoy dado este usuario" —
`assembleWorkoutSketch` + `rankExercises`. FASE 2 no reemplaza eso, lo llama
repetidamente:

- **Split semanal**: llamar al ensamblador de sesión una vez por día de la
  semana, variando qué se prioriza cada día.
- **Progresión de volumen**: usar `decideProgression` (ya construido en
  FASE 1) para decidir la prescripción numérica de la SIGUIENTE sesión de un
  ejercicio concreto, a partir de su historial.
- **Reorganización**: recalcular el split semanal para un nº de días
  distinto, sin que eso afecte el historial de progresión de ningún
  ejercicio (que vive aparte, por ejercicio, no por día de la semana).

## 2. Split semanal: plantillas de arquetipos de día, no un algoritmo de scheduling genérico

Un generador de horarios genérico (resolver qué día de la semana entrena qué
grupo muscular con qué separación óptima) es un problema de optimización que
no aporta nada frente a una regla simple y explicable: **alternar entre "día
de prioridad" y "día complementario"**, con el día de prioridad apareciendo
más veces cuando el número de días es impar (§13: la limitación principal
necesita frecuencia, no una sola exposición semanal).

`src/data/weeklySplitTemplates.ts` fija la plantilla para 2-6 días/semana
(el rango que pide el brief en §20) como datos, no como código: cada entrada
es una lista de arquetipos (`"priority_focus"` | `"complementary"`). Añadir
un séptimo día o cambiar la proporción prioridad/complementario es editar
esa tabla.

- **`priority_focus`**: la sesión se genera igual que en FASE 1 (sin
  restricciones), así que el patrón de movimiento de la limitación principal
  gana de forma natural (es el que puntúa más alto en `rankExercises`).
- **`complementary`**: se pide al ensamblador que evite, si puede, el patrón
  de movimiento que fue "Fuerza principal" el día anterior — una regla de
  separación mínima, no un motor de fatiga real. Es una **preferencia
  blanda**: si no hay alternativa razonable, el ensamblador cae otra vez al
  ranking normal en vez de dejar el día vacío o forzar un ejercicio absurdo.

Esto es deliberadamente un placeholder hasta FASE 3: hoy "evitar
sobrecargar" se basa en "¿qué patrón até ayer?", no en fatiga real por
músculo acumulada a lo largo de la semana. `fatigueByMuscle` en
`UserContext` sigue siendo el gancho para cuando exista ese motor.

## 3. Progresión de volumen sesión a sesión (§13)

`decideProgression` (FASE 1) ya clasifica QUÉ hacer (mantener/subir
reps/avanzar/regresar/deload). FASE 2 añade `planNextSession`, que traduce
esa decisión en una prescripción concreta:

- `INCREASE_REPS` / `INCREASE_TIME`: +1 rep o +un incremento pequeño de
  tiempo sobre lo conseguido la última vez (esto es exactamente el
  3×5→3×6→3×7→3×8 del ejemplo del brief, sesión a sesión, no una tabla fija
  de 4 semanas — el ritmo real lo pone el rendimiento, no el calendario).
- `ADVANCE_PROGRESSION`: cambia de ejercicio al primero de `progressions`,
  empezando en el extremo bajo de su rango recomendado (nunca se salta
  directamente a la mitad del rango del ejercicio nuevo).
- `REGRESS`: cambia al primero de `regressions`, a su volumen recomendado.
- `MAINTAIN`: repite la prescripción anterior tal cual.
- `DELOAD_CANDIDATE`: mismo ejercicio y objetivo de reps/tiempo, pero series
  reducidas (~40%) — una sesión más ligera, no una semana entera de descarga
  (eso requiere una señal agregada de fatiga que no existe hasta FASE 3).

## 4. Reorganización por disponibilidad (§20) sin destruir la progresión

La propiedad que hay que garantizar es esta: **el historial de progresión
vive por ejercicio (`ExerciseHistory`), nunca por día de la semana**.
Cambiar de 4 días a 3 días es simplemente volver a pedir la plantilla de
`weeklySplitTemplates` para 3 en vez de 4 — no toca ningún `ExerciseHistory`
existente. `planNextSession(exercise, history)` da exactamente la misma
prescripción para un ejercicio independientemente de cuántos días entrene
esa semana el usuario. Esto está probado explícitamente en
`tests/weeklyPlan.test.ts`: se genera un plan de 4 días, se registra progreso
en un ejercicio, se regenera el plan para 3 días, y se comprueba que
`planNextSession` para ese ejercicio no cambia.

## 4bis. `planNextSession` y `generateWeeklyPlan` estaban construidos pero NO conectados

Al reverificar FASE 2 se encontró que `generateWeeklyPlan` llamaba solo a
`assembleWorkoutSketch` (ranking + presupuesto de tiempo de FASE 1), que
siempre usa `exercise.recommendedSets`/`recommendedReps` — el rango estático
de la ficha. `planNextSession` (la progresión real sesión a sesión) existía
y tenía tests, pero ningún camino de código real la invocaba desde el plan
semanal: eran dos sistemas construidos en paralelo y nunca cableados.

Se corrigió con `applyTrainingHistory(blocks, historyByExercise,
exercisesById)`: un paso que, cuando hay historial real para un ejercicio de
un bloque, sustituye su volumen estático por la prescripción de
`planNextSession` (y cambia el ejercicio del bloque si la prescripción
decide avanzar o regresar de línea). `generateWeeklyPlan` acepta
`historyByExercise` opcional y aplica esto por cada día. Sin historial, el
comportamiento es exactamente el de antes (compatible con todo lo ya
probado).

**Efecto secundario descubierto al añadir esto**: si un ejercicio de menor
prioridad (p. ej. "Accesorio") avanza de línea y su siguiente progresión
resulta ser el MISMO ejercicio que ya ocupa un bloque de mayor prioridad ese
día (p. ej. "Fuerza principal" ya es ese ejercicio), sin control se
duplicaría el mismo ejercicio dos veces bajo etiquetas distintas.
`applyTrainingHistory` deduplica por `exercise.id` en orden de prioridad de
bloque (los bloques ya llegan ordenados Skill → Fuerza principal → ... →
Movilidad) y descarta el bloque de menor prioridad que colisiona, en vez de
rellenarlo con otra cosa — un hueco así se prefiere vacío a duplicado.
Validado en `tests/weeklyPlan.test.ts`.

## 5. Qué NO se construye todavía

- **Fatigue engine real** (FASE 3): la regla de "evitar el patrón de ayer"
  es un placeholder explícito, no fatiga por músculo con recuperación en el
  tiempo.
- **Semana de descarga completa** (FASE 3): el deload de FASE 2 es por
  ejercicio y por sesión, no una semana entera con volumen reducido en todo
  el plan — eso necesita agregar señales de fatiga de varios ejercicios a la
  vez.
- **Persistencia real**: `ExerciseHistory`/`WeeklyPlan` son estructuras en
  memoria que el motor consume y produce (mismo enfoque que FASE 1). Guardar
  esto en una base de datos real es FASE 4 (la app), no un cambio de
  arquitectura del motor.
