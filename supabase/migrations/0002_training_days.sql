-- Días de la semana en los que el usuario prefiere entrenar (0=domingo..
-- 6=sábado, mismo criterio que Date#getUTCDay() en el cliente) — para que
-- el calendario de /history pueda marcar qué días concretos tocan
-- entrenar, no solo cuántos por semana. El default (lunes a viernes) es
-- solo un valor de partida razonable para perfiles ya existentes que
-- todavía no han elegido días concretos; no se puede inferir su
-- preferencia real retroactivamente.
alter table public.profiles
  add column training_days integer[] not null default '{1,2,3,4,5}';
