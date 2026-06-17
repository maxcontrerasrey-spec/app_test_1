begin;

-- 1. Tabla de Catálogo de Cursos de Onboarding
create table if not exists public.onboarding_courses_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  role_target text not null default 'all',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger trg_onboarding_courses_catalog_updated_at
before update on public.onboarding_courses_catalog
for each row execute function public.set_updated_at();

-- 2. Tabla de Procesos de Onboarding (vinculada a employees)
create table if not exists public.onboarding_processes (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'cancelled')),
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint idx_unique_active_onboarding unique (employee_id)
);

create trigger trg_onboarding_processes_updated_at
before update on public.onboarding_processes
for each row execute function public.set_updated_at();

-- 3. Tabla de Seguimiento de Cursos por Empleado
create table if not exists public.onboarding_employee_courses (
  id uuid primary key default gen_random_uuid(),
  onboarding_process_id uuid not null references public.onboarding_processes(id) on delete cascade,
  course_id uuid not null references public.onboarding_courses_catalog(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  evaluated_by uuid null references public.profiles(id) on delete set null,
  instructor_name text null,
  evaluation_date timestamptz null,
  notes text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger trg_onboarding_employee_courses_updated_at
before update on public.onboarding_employee_courses
for each row execute function public.set_updated_at();

-- 4. RLS y Permisos Básicos (Zero Trust)
alter table public.onboarding_courses_catalog enable row level security;
alter table public.onboarding_processes enable row level security;
alter table public.onboarding_employee_courses enable row level security;

-- Políticas de lectura (Reclutamiento y Administradores)
create policy "Usuarios reclutamiento pueden ver catalogo" on public.onboarding_courses_catalog
  for select using (public.user_can_access_module(auth.uid(), 'reclutamiento') or public.user_is_admin(auth.uid()));

create policy "Usuarios reclutamiento pueden ver procesos" on public.onboarding_processes
  for select using (public.user_can_access_module(auth.uid(), 'reclutamiento') or public.user_is_admin(auth.uid()));

create policy "Usuarios reclutamiento pueden ver cursos empleado" on public.onboarding_employee_courses
  for select using (public.user_can_access_module(auth.uid(), 'reclutamiento') or public.user_is_admin(auth.uid()));

-- Grants
grant select, insert, update on public.onboarding_courses_catalog to authenticated;
grant select, insert, update on public.onboarding_processes to authenticated;
grant select, insert, update on public.onboarding_employee_courses to authenticated;

-- 5. Carga inicial del catálogo según requerimiento
insert into public.onboarding_courses_catalog (name, category, role_target) values
  ('Smith System- técnicas de conducción segura', 'Técnicas', 'Conductor'),
  ('Manejo defensivo', 'Técnicas', 'Conductor'),
  ('Uso y freno de parqueo', 'Técnicas', 'Conductor'),
  ('Uso cajas de cambios', 'Marcas/Modelos', 'Conductor'),
  ('Frenos auxiliares', 'Marcas/Modelos', 'Conductor'),
  ('Sistema de seguridad', 'Marcas/Modelos', 'Conductor'),
  ('Panel 2014', 'Marcas/Modelos', 'Conductor'),
  ('Capacitacion formación operación buses electricos', 'Marcas/Modelos', 'Conductor'),
  ('Entrevista y Reclutamiento de conductores teórico y prácticos', 'Procesos', 'Conductor'),
  ('Reforzamiento de hábitos operacionales (malas conductas)', 'Procesos', 'Conductor'),
  ('Charlas en terreno', 'Procesos', 'Conductor'),
  ('Toma de prácticos y promociones de conductores (entrenamiento)', 'Procesos', 'Conductor'),
  ('Recertificaciones vencidas a conductores', 'Procesos', 'Conductor'),
  ('Levantamiento y cierres de brechas de conductores por Otec', 'Procesos', 'Conductor'),
  ('Protocolos de descenso y ascenso mina', 'Procesos', 'Conductor')
on conflict do nothing;

notify pgrst, 'reload schema';

commit;
