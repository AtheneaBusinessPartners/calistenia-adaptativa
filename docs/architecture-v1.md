# Arquitectura del motor de progresión — V1

FASE 1 del proyecto ("el cerebro"). Sin UI, sin base de datos, sin login. El
objetivo de este documento es fijar el modelo de dominio y las reglas antes de
escribir el motor, y dejar constancia de las decisiones que afectan a todo lo
que se construya después.

## 1. Qué vive en código vs qué vive en datos vs qué será configurable

| Elemento | Dónde vive ahora | Por qué |
|---|---|---|
| Catálogo de ejercicios, músculos, patrones de movimiento, skills, requisitos | **Datos** (`src/data/*.ts`, objetos tipados) | Debe poder crecer a cientos de ejercicios y decenas de skills sin tocar el motor. En FASE 1 vive en TS por comodidad de tipado; en FASE 4 se migra a tablas Postgres (mismo shape, detrás de un repositorio) sin reescribir el motor. |
| Fórmulas de scoring, reglas de progresión, cálculo de capacidades | **Código** (`src/engine/*.ts`) | Es lógica, no contenido. Cambia con el diseño del algoritmo, no con la ampliación del catálogo. |
| Pesos de la fórmula de scoring (importancia relativa de cada factor) | **Datos, pero separados de las entidades** (`src/engine/scoringWeights.ts`) | Se ajustarán con testing real; deben poder tunearse sin tocar la lógica del cálculo. |
| Umbrales de "dominio" de un ejercicio (p. ej. cuántas reps para considerar el pull-up "mastered") | **Dato en el propio ejercicio** (`masteryCriteria`) | Es una propiedad del ejercicio, no una regla global. Cada ejercicio define su propio criterio. |
| Assessment interactivo (qué pregunta hacer después según la respuesta) | **Código genérico + datos de la cadena** | El árbol de preguntas se deriva automáticamente de la cadena de progresión de cada patrón de movimiento (ver §5). No hace falta un árbol de decisión escrito a mano por movimiento. |

Esto es lo que permite que una IA (o un admin) amplíe el catálogo más adelante
sin tocar `src/engine`: añadir un ejercicio es añadir un objeto de datos con
las relaciones correctas (regresión/progresión/skills/capacidades), no escribir
código nuevo.

## 2. Separación ejercicio / capacidad / skill (§8 del brief)

Tres entidades distintas y nunca mezcladas:

- **Ejercicio** (`Exercise`): algo concreto que se hace en la sala/parque. Tiene
  reps, series, tempo, técnica.
- **Capacidad** (`Capability`): una de las 7 dimensiones fisiológicas del
  perfil del usuario (`pull`, `push`, `core`, `legs`, `balance`, `mobility`,
  `explosiveness`), 0–100. Un ejercicio *contribuye* a una o varias
  capacidades con un peso (`capabilitiesDeveloped: Partial<Record<CapabilityId, number>>`).
- **Skill** (`Skill`): una habilidad objetivo (muscle-up, front lever...). No
  se entrena directamente "de golpe": se alcanza cumpliendo *requisitos*
  (`SkillRequirement`), que pueden ser sobre un ejercicio concreto (reps/tiempo)
  o sobre una capacidad agregada.

Esto permite que el motor razone "te falta explosividad" (capacidad) y
"te falta chest-to-bar × 3" (ejercicio concreto) como dos tipos de gap
distintos, y elija ejercicios que atacan lo que realmente falta en vez de
solo mirar el nombre de la skill.

## 3. El grafo ejercicio ↔ ejercicio es el árbol de prerrequisitos

En vez de mantener una lista de "prerrequisitos" separada de "progresiones" y
"regresiones" (que se desincronizaría), cada ejercicio solo declara:

- `regressions: ExerciseId[]` — variantes más fáciles del mismo patrón.
- `progressions: ExerciseId[]` — variantes más difíciles del mismo patrón.
- `masteryCriteria` — el listón (reps o segundos) para considerarlo dominado.
- `difficulty` (1-10) — nivel relativo dentro de su línea de trabajo.

Esto es a la vez el árbol de progresión (§10) y el sistema de prerrequisitos
(§11): no hay dos estructuras de datos que mantener sincronizadas, hay una.
Para el test adaptativo y para "qué preguntar/recomendar después" existe
además `src/data/chains.ts`: listas explícitas ordenadas por línea de trabajo
(p. ej. `vertical_pull_main`: dead hang → scapular pull-up → band-assisted →
negative → pull-up). Son deliberadamente una estructura aparte y no algo
derivado de recorrer `progressions` en tiempo de ejecución: varias líneas
distintas conviven sobre el mismo `movementPattern` (p. ej. `vertical_pull`
tiene la línea base y, a partir de `pull_up`, la línea que continúa hacia
muscle-up), así que "seguir progressions[0]" no basta para reconstruirlas de
forma fiable — es más simple declarar el orden una vez que inferirlo.

**Nota de implementación:** el "nivel" de un ejercicio para el perfil de
capacidades (§4 más abajo) usa el campo `difficulty` de cada ejercicio, NO la
posición dentro de estas cadenas. `difficulty` es un dato plano editable por
un admin sin tocar código ni reordenar cadenas; las cadenas de
`chains.ts` solo dirigen el test adaptativo y las recomendaciones de
siguiente paso.

## 4. Perfil de capacidades (§1)

`computeCapabilityProfile(assessment, exercisesById)` (en `capabilityProfile.ts`)
calcula, para cada una de las 7 capacidades, un valor 0–100:

1. Para cada ejercicio evaluado, `progressRatio = min(valor_actual / valor_objetivo_de_masteryCriteria, 1)`
   — 0 si no se ha probado o no llega, 1 si lo cumple o lo supera.
2. `levelScore = progressRatio × (difficulty / 10)` (0–1): combina "cuánto
   domina este ejercicio concreto" con "qué tan avanzado es ese ejercicio
   dentro de su línea de trabajo".
3. La contribución a cada capacidad es `levelScore × capabilitiesDeveloped[capacidad] × 100`.
4. Por cada capacidad, se toma el **máximo** entre todos los ejercicios
   evaluados que contribuyen a ella (no la media ni la suma): el perfil debe
   reflejar el punto más alto demostrado, igual que en el ejemplo del brief
   (excelente en handstand y cero dominadas → `balance` alto y `pull` bajo,
   independientemente de cuántos ejercicios de pull se hayan evaluado).

Esto reproduce directamente el ejemplo del §1: dos líneas de trabajo
independientes (pull vertical, balance/handstand) no se promedian entre sí.
Validado en `tests/engine.test.ts`.

## 5. Test adaptativo (§7)

Implementado en `src/engine/adaptiveTest.ts`. `nextAssessmentStep(chainKey,
answeredSoFar)` recorre una cadena de `data/chains.ts` de más fácil a más
difícil y ofrece el primer ejercicio sin responder. `shouldStopChain(chainKey,
answeredSoFar)` decide si merece la pena seguir subiendo de nivel: si el
último ejercicio respondido no se domina, no tiene sentido preguntar por el
siguiente (si no hace una dominada, no se pregunta por chest-to-bar — mismo
ejemplo del §7). `runAdaptiveChain` encadena ambas para simular el test
completo contra respuestas ya conocidas. Validado en
`tests/adaptiveTest.test.ts`.

Este módulo expone la lógica; la UI que hace las preguntas una a una en
pantalla, paso a paso, es FASE 4. El usuario ficticio de §40 no pasa por este
flujo interactivo — sus datos se introducen ya resueltos — precisamente para
probar el resto del pipeline (perfil → gate → selector → sesión) de forma
aislada antes de conectar la UI del test.

## 6. Requisitos de skill y limitantes (§11, §32)

Cada `SkillRequirement` es de tipo `exercise` (umbral de reps/segundos en un
ejercicio concreto) o `capability` (umbral en una capacidad agregada), y
lleva:

- `importance` (0–1): cuánto pesa este requisito en el gate global de la
  skill.
- `label`: texto explicativo listo para mostrar al usuario ("Chest-to-bar ×3",
  "Fuerza explosiva de tracción").

`evaluateSkillGate(user, skill)` devuelve, por requisito: cumplido / parcial /
no cumplido, con el **gap** (cuánto falta, no solo un booleano). Las
limitaciones se ordenan por `importance × gapSize` — así el motor prioriza el
requisito que más bloquea el objetivo, no simplemente el primero de la lista,
igual que el ejemplo del §11 (chest-to-bar y explosividad por delante de
mantener fuerza de tracción ya conseguida).

## 7. Motor de selección de ejercicios (§29)

`scoreExercise(exercise, context)` implementa la fórmula del brief como suma
ponderada de factores independientes, **cada uno una función pura propia**
para poder testear y ajustar por separado:

```
score = w.skillRelevance      * skillRelevance(exercise, targetSkill)
       + w.capabilityFit       * capabilityFit(exercise, prioritizedLimitations)
       + w.levelCompatibility  * levelCompatibility(exercise, userChainPosition)
       + w.goalRelevance       * goalRelevance(exercise, primaryGoal)
       + w.progressionReadiness* progressionReadiness(exercise, user)
       + w.preference          * preferenceFit(exercise, user)   // stub FASE1: neutral
   × equipmentGate(exercise, userEquipment)   // 0 si falta material → descarta
   × fatigueGate(exercise, userFatigue)        // 1.0 en FASE1 (motor de fatiga es FASE 3)
   × painGate(exercise, userConstraints)       // 0 si el ejercicio agrava una zona con dolor
```

Se implementa como suma + multiplicadores de "gate" (no de peso) para los
factores duros: si falta el material o el ejercicio duele, la puntuación debe
ir a cero sin importar lo bien que puntúe en lo demás — no es algo que deba
"perder unos puntos", debe descartarse. Los pesos (`w.*`) están en
`src/engine/scoringWeights.ts`, separados del código, para poder ajustarlos
con datos reales sin tocar las funciones.

`fatigueGate` y el `preference` real (aprendido, no declarado) son ganchos que
hoy devuelven un valor neutral documentado — se implementan en FASE 3 (motor
de fatiga) y no necesitan cambiar la forma de la fórmula, solo rellenar la
función.

## 8. Principio de no repetición estúpida (§30)

El selector de ejercicios no sustituye un ejercicio que el usuario ya está
usando y en el que progresa. `progression.ts` decide primero **mantener vs
cambiar**; solo si decide "cambiar" (por estancamiento, progresión conseguida,
falta de material o cambio de objetivo) se vuelve a invocar el selector para
elegir el siguiente. El selector nunca se ejecuta "por defecto" en cada
sesión para el ejercicio principal ya asignado.

## 9. Qué NO se construye en FASE 1 (y dónde queda el hueco)

- **Motor de fatiga real** (FASE 3): hoy `fatigueGate` siempre devuelve
  neutral. El tipo `UserContext` ya incluye un campo `fatigueByMuscle`
  opcional para que FASE 3 lo rellene sin cambiar la firma de `scoreExercise`.
- **Generador de sesión completo con periodización semanal** (FASE 2): hoy
  `workoutSketch.ts` monta **una** sesión de ejemplo con la estructura de
  bloques del §17 a partir de los ejercicios recomendados, pero no gestiona
  semanas, series de progresión temporal (3×5 → 3×8) ni reorganización por
  disponibilidad — eso es el "workout engine" de FASE 2.
- **Nutrición, gamificación, IA conversacional**: fuera de alcance, FASE 5/6.

## 10. Entidades de este documento vs entidades de §28 del brief

Este documento cubre las entidades de la FASE 1 (`Muscle`, `MovementPattern`,
`Capability`, `Equipment`, `Exercise`, `Skill`, `SkillRequirement`,
`UserProfile`, `AssessmentEntry`, `CapabilityProfile`). El resto de la lista
del §28 (`WORKOUTS`, `WORKOUT_SETS`, `TRAINING_HISTORY`, `FATIGUE`,
`RECOVERY`, `NUTRITION_PROFILE`, `MEALS`, `PROGRESS_TESTS`) pertenece a FASE
2/3/5 y se diseñará cuando toque esa fase, para no fijar un esquema de datos
de tracking antes de tener el motor de progresión validado.

## 11. Validación de esta fase

`src/scenarios/muscleup-user.ts` instancia el usuario ficticio del brief
(§40: 7 dominadas, 12 push-ups, 10 dips, 30s hollow hold, 60s handstand, 0
chest-to-bar, objetivo muscle-up) y hace pasar sus datos por todo el pipeline
(`assessment → capabilityProfile → skillGate → priorities → exerciseSelector
→ workoutSketch → progression criteria`), imprimiendo los 15 puntos pedidos
en el brief. Esto es la prueba de que el modelo aguanta un caso real antes de
construir nada más encima.
