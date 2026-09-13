-- FASE 4: esquema inicial. Cada tabla es la persistencia directa de un tipo
-- que ya existe en src/engine/types.ts (ver docs/architecture-v4-app.md §3).
-- No editar esta migración una vez aplicada — añadir una nueva.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  age integer not null,
  sex text not null check (sex in ('male', 'female', 'other')),
  height_cm integer not null,
  weight_kg numeric not null,
  training_experience_years numeric not null default 0,
  calisthenics_experience text not null check (calisthenics_experience in ('none', 'beginner', 'intermediate', 'advanced')),
  sleep_hours_avg numeric not null default 7,
  activity_level text not null check (activity_level in ('sedentary', 'light', 'moderate', 'active')),
  days_per_week integer not null default 4,
  session_duration_minutes integer not null default 45,
  min_session_duration_minutes integer not null default 20,
  equipment text[] not null default '{}',
  goals text[] not null default '{}',
  primary_goal text not null,
  primary_skill_target text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- Histórico, no una fila que se sobrescribe (§23 del brief: reevaluaciones
-- periódicas). "La evaluación actual" de un ejercicio es su fila más
-- reciente por assessed_at.
create table public.assessment_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id text not null,
  reps integer,
  seconds integer,
  assessed_at timestamptz not null default now()
);

create index assessment_entries_user_exercise_idx on public.assessment_entries (user_id, exercise_id, assessed_at desc);
alter table public.assessment_entries enable row level security;
create policy "assessment_entries_all_own" on public.assessment_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Un día de entrenamiento REALMENTE ocurrido (no un plan generado, que no
-- se persiste — se recalcula en cada carga con computeMuscleFatigue /
-- sessionPlanner sobre estas filas).
create table public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  performed_at date not null default current_date,
  archetype text,
  created_at timestamptz not null default now()
);

create index training_sessions_user_date_idx on public.training_sessions (user_id, performed_at desc);
alter table public.training_sessions enable row level security;
create policy "training_sessions_all_own" on public.training_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.training_session_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  exercise_id text not null,
  sets integer not null,
  reps integer,
  seconds integer,
  rir numeric,
  technique_ok boolean not null default true
);

alter table public.training_session_sets enable row level security;
create policy "training_session_sets_all_own" on public.training_session_sets for all using (
  exists (select 1 from public.training_sessions s where s.id = session_id and s.user_id = auth.uid())
) with check (
  exists (select 1 from public.training_sessions s where s.id = session_id and s.user_id = auth.uid())
);

create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feeling text not null,
  sleep_quality text not null,
  stress text not null,
  motivation text not null,
  fatigue_zones text[] not null default '{}',
  pain_zones text[] not null default '{}',
  pain_severity text,
  created_at timestamptz not null default now()
);

create index check_ins_user_date_idx on public.check_ins (user_id, created_at desc);
alter table public.check_ins enable row level security;
create policy "check_ins_all_own" on public.check_ins for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
