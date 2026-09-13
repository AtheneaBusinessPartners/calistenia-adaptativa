# Calistenia adaptativa — motor de progresión (FASE 1)

Sistema de entrenamiento de calistenia adaptativo: no una biblioteca de
rutinas, sino un motor que modela las capacidades reales del usuario, sus
objetivos como skills con requisitos concretos, y recomienda ejercicios en
función de lo que le falta — no de lo que pide.

Este repo cubre únicamente **FASE 1: el cerebro** (sin UI, sin base de
datos, sin login). Ver [`docs/architecture-v1.md`](docs/architecture-v1.md)
para las decisiones de diseño.

## Estructura

```
src/
  engine/     motor: perfil de capacidades, gate de skills, selector de
              ejercicios, motor de progresión, test adaptativo
  data/       catálogo de ejercicios, músculos, patrones de movimiento,
              capacidades, equipamiento, skills, cadenas de progresión
  scenarios/  caso de validación con un usuario ficticio (§40 del brief)
tests/        vitest sobre el motor
docs/         arquitectura y decisiones de diseño
```

## Uso

```bash
npm install
npm run scenario   # corre el pipeline completo con el usuario ficticio del brief
npm test            # tests del motor
npm run typecheck
```

## Estado

FASE 1 (cerebro) completa y validada con un caso real end-to-end. Pendiente:
FASE 2 (workout engine con periodización semanal), FASE 3 (motor de fatiga),
FASE 4 (app/UI), FASE 5 (nutrición), FASE 6 (coach IA).
