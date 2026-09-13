# Motor de fatiga — V3 (FASE 3)

FASE 3 rellena los dos ganchos que FASE 1 y FASE 2 dejaron explícitamente
como placeholders: `fatigueGate` (siempre neutral hasta ahora) y la regla de
"evitar el patrón de ayer" del split semanal (una aproximación sin datos
reales de fatiga). También añade lo que el brief pide en §14-16 y §24 que no
tenía sentido construir antes de tener un motor de progresión validado:
fatiga real por músculo, check-in antes de entrenar, y detección de semana
de descarga.

## 1. Qué mide la fatiga y de dónde sale

`computeMuscleFatigue(trainingLog, exercisesById)` en `fatigueEngine.ts`
calcula, para cada músculo, un valor 0-100 a partir de un historial de
entrenamientos (`TrainingDay[]`, cada uno con los ejercicios hechos y cuántos
días hace). Por cada ejercicio realizado:

1. **Estímulo** = `series × intensidad`, donde la intensidad depende del RIR
   reportado (más cerca del fallo = más estímulo). Esto cubre "volumen" e
   "intensidad/proximidad al fallo" del §14.
2. Ese estímulo se reparte entre los músculos del ejercicio: peso 1.0 para
   `primaryMuscles`, 0.5 para `secondaryMuscles` — cubre "grupo muscular".
3. El estímulo de cada día se **descompone con el tiempo**:
   `remanente = 0.1 ^ (díasTranscurridos / díasDeRecuperación)` — a los
   `díasDeRecuperación` de ese músculo queda ~10% del estímulo original.
   Esto cubre "días desde el último estímulo" y "rendimiento histórico"
   (varios días de estímulo se acumulan si no ha dado tiempo a recuperar).
**Nota de una corrección real, encontrada al probar el ejemplo del §16 con
datos concretos:** `exerciseFatigueLoad` (la fatiga que ve un ejercicio
concreto) toma el **máximo** entre sus músculos primarios, no la media —
igual que `computeCapabilityProfile` (§4 de `architecture-v1.md`). La
primera versión promediaba, y eso diluía la señal: un ejercicio con tres
músculos primarios donde solo uno estaba agotado al 100% salía con una
fatiga "media" del 33%, con amortiguación casi nula — en la práctica seguía
colando ejercicios que exigen un músculo realmente agotado solo porque
también usan otros músculos frescos. El músculo primario más cargado es el
cuello de botella real del movimiento, no un promedio con los demás.

4. Los `díasDeRecuperación` son distintos por músculo
   (`src/data/muscleRecovery.ts`): grupos grandes (dorsal, cuádriceps,
   isquios, pectoral) recuperan más despacio (~3 días) que grupos pequeños
   (antebrazos, gemelos, bíceps) (~1.5-2 días). Son valores heurísticos de
   partida, documentados como tales — se podrán ajustar con datos reales sin
   tocar la fórmula, igual que `SECONDS_PER_REP` en FASE 2.

**Qué NO mide**: la fatiga del sistema nervioso central, el estrés fuera del
gimnasio como señal objetiva (eso entra por el check-in, no por el cálculo),
o la fatiga de un músculo que nunca aparece en `primaryMuscles`/
`secondaryMuscles` de ningún ejercicio realizado (se queda en 0, no en un
valor por defecto inventado).

## 2. Check-in antes de entrenar (§15) — y la diferencia entre fatiga y dolor

`CheckIn` (`checkIn.ts`) recoge percepción subjetiva: cómo se encuentra,
calidad del sueño, estrés, motivación, zonas que nota especialmente
fatigadas, y — por separado, nunca mezclado — zonas con **dolor**.

- `applyCheckInToFatigue(baseFatigue, checkIn)` ajusta el cálculo objetivo
  con la percepción subjetiva (§14 lo pide explícitamente): un "muy
  cansado" general sube la fatiga de todos los músculos un poco; marcar una
  zona concreta como fatigada la sube más específicamente ahí. Es una suma
  acotada a 100, no una sustitución del cálculo objetivo.
- `painZones` del check-in **no** entra en `fatigueByMuscle`. Entra en
  `UserContext.painZones`, el mismo campo que ya existía desde FASE 1 y que
  `painGate` en `exerciseSelector.ts` usa como **gate duro** (descarta el
  ejercicio, puntuación 0). La fatiga se puede entrenar con cuidado; el dolor
  no se ignora ni se "cambia de ejercicio y ya" — se corta esa vía de
  entrenamiento y, si `painSeverity` es moderado o severo,
  `checkInSafetyMessage(checkIn)` devuelve una recomendación explícita de
  precaución/consulta profesional para mostrar en la UI (FASE 4). El motor
  no diagnostica ni decide "es solo un tirón, sigue entrenando".

### Repaso de FASE 3: tres piezas construidas pero no conectadas

Al revisar esta fase por segunda vez se encontró el mismo patrón de bug que
ya había aparecido al conectar FASE 2 (`sessionPlanner` sin llamar desde
`generateWeeklyPlan`): módulos con sus propios tests, correctos en
aislamiento, pero que ningún camino de código real invocaba juntos.

1. **`applyCheckInToFatigue` nunca se llamaba desde `generateWeeklyPlan`.**
   El check-in existía y tenía tests, pero el plan semanal real se generaba
   siempre con fatiga puramente objetiva, ignorando la percepción subjetiva
   del §15. Se añadió `GenerateWeeklyPlanOptions.todayCheckIn`, aplicado al
   día 0 del plan (los días siguientes de esa misma semana no tienen su
   propio check-in todavía — eso pasará sesión a sesión, no al generar la
   semana entera de golpe).
2. **El bump global del check-in solo tocaba músculos que YA tenían fatiga
   objetiva.** Un usuario recién llegado sin ningún historial que reportara
   "muy cansado" no veía ningún efecto — el bump nunca tenía ninguna clave
   sobre la que aplicarse. Se corrigió para recorrer todos los músculos
   conocidos (`MUSCLES`), no solo los presentes en el mapa de entrada.
3. **`explainFatigueImpact` tampoco se llamaba desde `generateWeeklyPlan`.**
   Había que invocarla aparte con los parámetros exactos para obtener la
   frase del §16; ahora `DayPlan.fatigueExplanation` la lleva integrada,
   calculada automáticamente cada día.
4. **`painZones` del check-in nunca llegaba al gate duro real.** Se mostraba
   el aviso de seguridad, pero el plan generado seguía pudiendo incluir
   ejercicios de esa zona porque `dayCtx.user.painZones` no incorporaba
   `todayCheckIn.painZones`. Corregido: se unen al `painZones` que ya
   trajera el usuario, para ese primer día.

Los cuatro se verifican en `tests/weeklyPlan.test.ts` con datos reales, no
solo releyendo el código — la lección repetida es que un módulo con tests
propios no garantiza que el pipeline real lo use.

## 3. Fatiga en el motor de scoring: amortiguación, no gate

`fatigueGate` deja de ser el stub neutral de FASE 1. Igual que la
amortiguación por preparación de FASE 1 (§4bis de `architecture-v1.md`), la
fatiga **amortigua** la puntuación total de un ejercicio según la fatiga
media (ponderada por `primaryMuscles`/`secondaryMuscles`) de los músculos
que trabaja — nunca la anula del todo (suelo 0.1, más estricto que el 0.15
de la amortiguación por preparación: la fatiga debe pesar más como freno).

**Por qué esto ya resuelve §16 sin código nuevo de "redirección":** si los
músculos de tirón están muy fatigados, todos los ejercicios de tirón bajan
de puntuación por la amortiguación, y automáticamente los ejercicios de
pierna/core (músculos frescos) pasan a rankear más alto — el día "Pull" se
convierte en un día de piernas/core por sí solo, sin necesitar una regla
aparte de "si fatiga > X, cambia el día a Y". Es la misma idea de fondo que
ya usamos para el split semanal y para no recomendar el movimiento final de
una skill antes de tiempo: dejar que el ranking decida con la señal
correcta, no hardcodear el caso.

Esto también sustituye la heurística de FASE 2 ("evitar el patrón de
movimiento de ayer") por la señal real — y esta vez se **eliminó** en vez de
mantenerla como fallback, como se planteó al empezar esta fase. Motivo
encontrado al probarlo: las plantillas de `weeklySplitTemplates.ts` siempre
empiezan con un día `priority_focus`, y ese día siempre genera al menos un
bloque (regla ya existente en `assembleWorkoutSketch`: el primer bloque
nunca queda vacío) — así que para cuando se llega al primer día
`complementary`, YA existe fatiga real de los días anteriores de esa misma
semana. La condición "todavía no hay ninguna señal de fatiga" nunca se
cumplía en la práctica con el conjunto de plantillas actual, así que
mantener el código del fallback habría sido lógica sin ninguna forma de
alcanzarse ni de probarse. `assembleWorkoutSketch` y `generateWeeklyPlan` se
simplificaron quitándolo (`avoidMovementPatterns` desapareció del todo).

**Explicación breve al usuario (§16):** `explainFatigueImpact` compara el
ranking CON fatiga real contra el mismo ranking recalculado con fatiga en
cero; si el bloque de "Fuerza principal" cambia de ejercicio (o de patrón de
movimiento), genera una frase como la del brief: *"Hemos reducido el
trabajo de tirón porque tu nivel de fatiga de espalda y bíceps todavía es
elevado."* — usando los músculos con más fatiga del bloque que se evitó, no
una plantilla genérica.

## 4. Semana de descarga (§24)

El deload de FASE 2 (`DELOAD_CANDIDATE` en `progression.ts`) es **por
ejercicio y por sesión**: una señal local. FASE 3 añade
`shouldRecommendDeloadWeek` (`deloadWeek.ts`), que agrega señales de **toda
la semana**:

- Cuántos ejercicios en curso están en `DELOAD_CANDIDATE` a la vez (varias
  señales locales coincidiendo es una señal global).
- El **máximo** entre los músculos "grandes" (dorsal, pectoral, cuádriceps,
  isquios) por encima de un umbral — no la media: un split con un día de
  tirón muy exigente y piernas apenas tocadas esa semana no debe diluir una
  fatiga real y alta en dorsal/pectoral con isquios/cuádriceps frescos. Un
  solo grupo grande sostenido por encima del umbral ya justifica la
  descarga (mismo hallazgo que el de `exerciseFatigueLoad`, encontrado al
  repasar esta fase por tercera vez con una semana intensa pero realista,
  no el extremo original de 8 series a RIR 0 en los 4 grupos a la vez).
- Sueño reportado como deficiente en varios check-ins recientes.
- Motivación baja reportada de forma sostenida.

Si se recomienda, `applyDeloadWeek(plan)` reduce las series de todos los
bloques de fuerza de un plan semanal ya generado (mismo factor que el
deload de FASE 2, aplicado a nivel de semana completa) — no genera un plan
nuevo desde cero, transforma el que ya existe, para no duplicar la lógica de
selección de ejercicios.

## 5. Qué NO se construye todavía

- **Fatiga del sistema nervioso / hormonal**: fuera de alcance de cualquier
  fase de este proyecto tal como está planteado; el check-in subjetivo es la
  única señal de ese tipo de fatiga.
- **Aprendizaje de las plantillas de recuperación por músculo a partir de
  datos reales del usuario**: los valores de `muscleRecovery.ts` son
  heurísticos fijos, no se ajustan automáticamente — eso encajaría en un
  futuro motor de personalización, no en FASE 3.
- **Persistencia real del historial de entrenamiento y de los check-ins**:
  sigue siendo una estructura en memoria que el motor consume y produce
  (mismo criterio que FASE 1 y FASE 2); guardarlo de verdad es FASE 4.
