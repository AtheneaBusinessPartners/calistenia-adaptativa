# App — V4 (FASE 4)

FASE 4 pone una UI real y persistencia real encima del motor de FASE 1-3, que
hasta ahora vivía enteramente en memoria. Alcance de este primer tramo (a
petición explícita, no todo el brief de golpe): **el bucle central** — login,
onboarding con el test adaptativo, dashboard con el plan semanal real, y una
pantalla de sesión que registra lo entrenado y alimenta de verdad la fatiga y
la progresión. Progreso y árbol de skills quedan como vistas de solo lectura
sobre cálculos que el motor ya sabe hacer.

## 1. Stack

**Next.js (App Router) + Supabase + Tailwind, en el mismo repo que el
motor.** Decisión del usuario, justificada por dos motivos:

- El motor (`src/engine`, `src/data`) es TypeScript puro sin dependencias de
  Node ni de navegador — se importa tal cual desde código de servidor de
  Next.js sin ningún adaptador.
- Supabase da Auth + Postgres + RLS en una pieza, evitando construir un
  backend de autenticación a mano para un MVP.

## 2. Dónde corre el motor: servidor, no cliente

Todas las llamadas a `computeCapabilityProfile`, `evaluateSkillGate`,
`rankExercises`, `generateWeeklyPlan`, `computeMuscleFatigue`, etc. ocurren en
**Server Components y Server Actions**, nunca en el navegador:

- El motor no tiene por qué viajar al bundle del cliente — son cálculos
  deterministas sobre datos que ya están en el servidor al pedir la página.
- Las Server Actions que registran una sesión (`logSession`) escriben en
  Supabase y devuelven; la página vuelve a renderizar en servidor con el
  motor recalculando sobre los datos ya persistidos — no hay estado de
  aplicación duplicado en el cliente que se pueda desincronizar del que ve
  el motor.
- Los Client Components se limitan a formularios e interacción (marcar
  series, campos del check-in) — nunca reimplementan ni una pizca de la
  lógica del motor.

## 3. Esquema de datos — un mapeo directo de los tipos del motor

Cada tabla es la persistencia de un tipo que ya existe en `src/engine/types.ts`
— no se ha diseñado un esquema nuevo, se ha guardado el que ya había:

- `profiles` (1:1 con `auth.users`) ← `UserProfile`.
- `assessment_entries` (user_id, exercise_id, reps, seconds, assessed_at) ←
  `AssessmentEntry`, con histórico (§23: reevaluaciones periódicas) en vez de
  una sola fila por ejercicio; "la evaluación actual" es la fila más
  reciente por `exercise_id`.
- `training_sessions` (user_id, performed_at) + `training_session_sets`
  (session_id, exercise_id, sets, reps, seconds, rir, technique_ok) ← un
  `TrainingDay`/`PerformedExercise` ya ocurrido de verdad, no planeado.
- `check_ins` (user_id, created_at, feeling, sleep_quality, stress,
  motivation, fatigue_zones, pain_zones, pain_severity) ← `CheckIn`.

**Por qué histórico y no una fila que se sobrescribe**: `computeMuscleFatigue`
necesita "cuántos días hace" cada estímulo, y `historyByExercise` de
`sessionPlanner` necesita la secuencia completa de sesiones de un ejercicio,
no solo la última. Guardar solo el estado actual habría hecho falta
reconstruir ambas cosas más adelante — se persiste el log real desde el
principio, exactamente como los tipos del motor ya esperaban recibirlo.

RLS en las cuatro tablas: `auth.uid() = user_id`, sin excepciones — cada
usuario entrena para sí mismo, no hay el reparto cuidador/paciente del otro
proyecto (`pastillero-abuelos`) porque aquí no aplica.

## 4. De filas de Supabase a los tipos del motor: una capa de mapeo, no lógica

`src/lib/repository.ts` (código de servidor) hace *solo* `SELECT` +
transformación de filas a los tipos del motor
(`AssessmentEntry[]`, `TrainingDay[]`, `Record<string, SessionLogEntry[]>`,
`CheckIn`) y `INSERT` de lo que las Server Actions reciben. No contiene
ninguna decisión de negocio — todas las decisiones (qué recomendar, cuánta
fatiga hay, si avanzar de línea) siguen viviendo exclusivamente en
`src/engine`. Esto es deliberado: si algún día se cambia Supabase por otra
base de datos, solo hay que reescribir este archivo.

`trainingLogFromSessions(sessions)` agrupa `training_session_sets` por
`performed_at`, calcula `daysAgo` como la diferencia en días contra "hoy" —
exactamente el contrato de `TrainingDay` que ya usa `computeMuscleFatigue`, y
que en FASE 3 había que envejecer a mano entre llamadas
(`advanceTrainingLog`) porque no existía un "hoy" real. Con fechas reales de
Postgres, `daysAgo` se recalcula desde cero en cada carga de página — el
problema que motivó `advanceTrainingLog` (encadenar semanas a mano,
propenso a desincronizarse) desaparece en la app real: ya no hace falta
encadenar nada, cada carga de página parte de "hoy" de verdad.

## 5. Onboarding y test adaptativo

El onboarding es un flujo de varios pasos (datos personales → objetivos →
disponibilidad → equipamiento/modo de entrenamiento → test adaptativo) que
termina escribiendo `profiles` + `assessment_entries` y generando la primera
sesión. El test adaptativo reutiliza `nextAssessmentStep`/`shouldStopChain`
de `adaptiveTest.ts` tal cual — la UI solo pregunta lo que esas funciones
dicen que hay que preguntar, cadena a cadena, y para en cuanto el usuario
falla un escalón.

## 6. Qué NO se construye en este tramo

- **Progreso y árbol de skills como vistas ricas** (gráficos de evolución,
  interacción): se construyen como listas/tablas simples sobre
  `evaluateSkillGate`/`computeCapabilityProfile` ya calculados — informativas,
  no el diseño visual final.
- **Reevaluación periódica guiada (§23)**: la tabla `assessment_entries` ya
  soporta histórico, pero el flujo de UI para "repetir el test cada 4-6
  semanas" no se construye en este tramo — hoy el usuario puede volver a
  hacer onboarding, no hay recordatorio ni flujo dedicado.
- **Notificaciones, recordatorios, PWA**: fuera de alcance.
