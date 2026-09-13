# Calistenia adaptativa — motor de progresión (FASE 1-2)

Sistema de entrenamiento de calistenia adaptativo: no una biblioteca de
rutinas, sino un motor que modela las capacidades reales del usuario, sus
objetivos como skills con requisitos concretos, y recomienda ejercicios en
función de lo que le falta — no de lo que pide.

Este repo cubre **FASE 1 (el cerebro) y FASE 2 (workout engine)** — sin UI,
sin base de datos, sin login. Ver
[`docs/architecture-v1.md`](docs/architecture-v1.md) y
[`docs/architecture-v2-workout-engine.md`](docs/architecture-v2-workout-engine.md)
para las decisiones de diseño.

## Estructura

```
src/
  engine/     motor: perfil de capacidades, gate de skills, selector de
              ejercicios, motor de progresión, test adaptativo, sesión
              de ejemplo, plan semanal, planificador de sesión
  data/       catálogo de ejercicios, músculos, patrones de movimiento,
              capacidades, equipamiento, skills, cadenas de progresión,
              modos de entrenamiento, plantillas de split semanal
  scenarios/  casos de validación con un usuario ficticio (§40 del brief)
tests/        vitest sobre el motor (incluye integration.test.ts: FASE 1 + FASE 2
              con un objetivo distinto a muscle-up, para probar que generaliza)
docs/         arquitectura y decisiones de diseño
```

## Uso

```bash
npm install
npm run scenario      # pipeline de FASE 1 con el usuario ficticio del brief
npm run weekly-plan    # plan semanal + progresión sesión a sesión (FASE 2)
npm run check-data     # integridad referencial del catálogo de datos
npm test               # tests del motor
npm run typecheck
```

## Estado

FASE 1 (cerebro) y FASE 2 (workout engine: split semanal, progresión de
volumen sesión a sesión, reorganización por disponibilidad) completas y
validadas end-to-end con dos usuarios ficticios de objetivos distintos
(muscle-up y front lever) más un caso límite de equipamiento insuficiente,
para comprobar que la lógica generaliza y no está sesgada a un solo caso.
59/59 tests. Pendiente: FASE 3 (motor de fatiga), FASE 4 (app/UI), FASE 5
(nutrición), FASE 6 (coach IA).
