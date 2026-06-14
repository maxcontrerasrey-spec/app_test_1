# Prompt para Codex: Backend "Alta Operacional de Personal"

Actúa como arquitecto senior de bases de datos y especialista en Supabase, PostgreSQL y Row Level Security (RLS). 

Necesitamos implementar la capa de Backend (Migraciones SQL, Tablas, RLS y Storage) para un nuevo módulo del ERP llamado **"Alta Operacional de Personal"** (Onboarding Operacional post-contratación).

> **REGLA FUNDAMENTAL:** El Frontend debe ser capaz de administrar y editar TODO dinámicamente. **NO uses `ENUMs` duros** a nivel de base de datos para nombres de "Departamentos", "Áreas responsables" o "Cargos". Usa campos `text` o tablas paramétricas (maestras) para que los administradores puedan agregar nuevas áreas o tipos de tareas desde el Frontend sin requerir nuevas migraciones SQL en el futuro.

Por favor, genera la migración SQL (`.sql`) necesaria para implementar la siguiente arquitectura de datos:

## 1. Modelo de Datos (Tablas Requeridas)

### A. `onboarding_templates`
Plantillas que definen qué tareas se deben ejecutar para un alta operacional según variables del trabajador.
- `id` uuid primary key
- `name` text not null
- `description` text
- `cargo` text
- `area` text
- `contrato` text
- `faena` text
- `division` text
- `centro_costo` text
- `worker_type` text
- `is_active` boolean default true
- `created_by` uuid (references auth.users)
- `created_at` timestamptz default now()
- `updated_at` timestamptz default now()

### B. `onboarding_template_tasks`
Las tareas predefinidas que componen una plantilla.
- `id` uuid primary key
- `template_id` uuid references onboarding_templates(id) on delete cascade
- `area_responsible` text not null *(Ej: HSEC, TI, Operaciones. Debe ser editable/texto)*
- `role_responsible` text *(Opcional, rol sugerido)*
- `task_name` text not null
- `task_description` text
- `is_required` boolean default true
- `is_blocking` boolean default true *(Impide que el trabajador opere si no se cumple)*
- `requires_evidence` boolean default false
- `evidence_type` text
- `sla_hours` integer
- `order_index` integer
- `depends_on_task_id` uuid null references onboarding_template_tasks(id)
- `is_active` boolean default true
- `created_at` timestamptz default now()
- `updated_at` timestamptz default now()

### C. `employee_onboarding_cases`
El caso real de habilitación de un trabajador específico.
- `id` uuid primary key
- `employee_id` uuid null
- `candidate_id` uuid null
- `hiring_request_id` uuid null
- `template_id` uuid references onboarding_templates(id)
- `status` text not null default 'draft' *(Valores Frontend: draft, in_progress, waiting_external, blocked, ready_for_operation, cancelled)*
- `cargo` text
- `contrato` text
- `faena` text
- `division` text
- `centro_costo` text
- `target_ready_date` date
- `progress_percent` numeric default 0
- `total_tasks` integer default 0
- `completed_tasks` integer default 0
- `expired_tasks` integer default 0
- `blocking_pending_tasks` integer default 0
- `created_by` uuid (references auth.users)
- `closed_by` uuid (references auth.users)
- `closed_at` timestamptz
- `created_at` timestamptz default now()
- `updated_at` timestamptz default now()

### D. `employee_onboarding_tasks`
La copia real de la tarea asignada para un caso específico.
- `id` uuid primary key
- `case_id` uuid references employee_onboarding_cases(id) on delete cascade
- `template_task_id` uuid references onboarding_template_tasks(id)
- `area_responsible` text not null
- `owner_user_id` uuid null (references auth.users)
- `role_responsible` text
- `task_name` text not null
- `task_description` text
- `status` text not null default 'pending' *(Valores Frontend: pending, in_progress, completed, rejected, not_applicable, expired)*
- `is_required` boolean default true
- `is_blocking` boolean default true
- `requires_evidence` boolean default false
- `evidence_type` text
- `due_at` timestamptz
- `started_at` timestamptz
- `completed_at` timestamptz
- `completed_by` uuid (references auth.users)
- `rejected_at` timestamptz
- `rejected_by` uuid (references auth.users)
- `rejection_reason` text
- `close_comment` text
- `order_index` integer
- `created_at` timestamptz default now()
- `updated_at` timestamptz default now()

### E. `employee_onboarding_evidence`
Evidencias adjuntas a una tarea.
- `id` uuid primary key
- `task_id` uuid references employee_onboarding_tasks(id) on delete cascade
- `case_id` uuid references employee_onboarding_cases(id) on delete cascade
- `file_name` text not null
- `file_path` text not null
- `file_url` text
- `mime_type` text
- `file_size` bigint
- `evidence_type` text
- `comment` text
- `uploaded_by` uuid (references auth.users)
- `uploaded_at` timestamptz default now()

### F. `employee_onboarding_activity_log`
Trazabilidad de todo lo que ocurre en el caso.
- `id` uuid primary key
- `case_id` uuid references employee_onboarding_cases(id) on delete cascade
- `task_id` uuid null references employee_onboarding_tasks(id) on delete cascade
- `action` text not null
- `old_value` jsonb
- `new_value` jsonb
- `comment` text
- `created_by` uuid (references auth.users)
- `created_at` timestamptz default now()

## 2. Storage
Asegúrate de incluir en la migración la creación de un nuevo **Storage Bucket** llamado `onboarding_evidence` (público o privado según consideres mejor para evidencias documentales internas, preferiblemente protegido).

## 3. Seguridad y RLS
Configura las políticas RLS básicas para las tablas:
- Lectura: Autenticados pueden leer.
- Escritura: Puedes dejar políticas abiertas para usuarios autenticados por ahora, el Frontend manejará el bloqueo fuerte de UI, o puedes implementar validaciones estrictas si las conoces.

## 4. Triggers (Opcional pero recomendado)
Si lo consideras útil, puedes incluir Triggers SQL para:
- Actualizar `updated_at`.
- Actualizar automáticamente los contadores de `employee_onboarding_cases` (`progress_percent`, `completed_tasks`, etc.) cuando una `employee_onboarding_tasks` cambia de estado.

Por favor, entrega el código de la migración en formato SQL limpio para poder aplicarlo en Supabase de inmediato.
