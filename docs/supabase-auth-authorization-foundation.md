# Base robusta de usuarios y permisos en Supabase

## Objetivo

Reemplazar la dependencia temporal en `raw_user_meta_data` y allowlists de frontend por una base formal de usuarios, roles y acceso a módulos.

## Tablas creadas

### `public.profiles`

Perfil operativo del usuario autenticado.

Columnas clave:
- `id`: UUID, referencia a `auth.users.id`
- `email`: correo principal del usuario
- `full_name`: nombre visible en la plataforma
- `job_title`: cargo visible
- `employee_code`: código interno si luego aplica
- `department`: área o gerencia
- `phone`: teléfono opcional
- `avatar_url`: foto o avatar opcional
- `status`: `pending | active | suspended | inactive`
- `is_super_admin`: admin máximo fuera del esquema de roles estándar
- `must_reset_password`: marca de seguridad para forzar cambio de contraseña
- `last_seen_at`: última actividad registrada

### `public.app_roles`

Catálogo de roles del sistema.

Roles iniciales:
- `admin`
- `reclutamiento`
- `control_contratos`
- `certificaciones`
- `instructor`

### `public.user_roles`

Relación muchos-a-muchos entre usuarios y roles.

Columnas clave:
- `user_id`
- `role_code`
- `assigned_at`
- `assigned_by`

### `public.app_modules`

Catálogo de módulos protegidos.

Módulos iniciales:
- `solicitud_contrataciones`
- `control_contrataciones`
- `certificados`
- `seguimiento_certificados`

### `public.role_module_access`

Relación entre roles y módulos visibles/accesibles.

## Automatización incluida

La migración agrega triggers sobre `auth.users` para:
- crear `profiles` al crear un usuario nuevo
- mantener sincronizado el correo y metadata base si cambia en `auth.users`

## Seguridad incluida

La migración habilita `RLS` para:
- `profiles`
- `app_roles`
- `user_roles`
- `app_modules`
- `role_module_access`

Reglas base:
- un usuario puede leer y actualizar su propio perfil
- `admin` puede ver más de un perfil y administrar roles
- usuarios autenticados pueden leer catálogo de roles/módulos

## Información que debe existir para cada usuario futuro

Mínimo recomendado:
- `email`
- `full_name`
- `job_title`
- `status`

Recomendado para operación real:
- `employee_code`
- `department`
- `phone`
- uno o más registros en `user_roles`

## Cómo poblar los primeros 2 usuarios

### 1. Ejecutar la migración

Archivo:
- [20260515_000001_auth_authorization_foundation.sql](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260515_000001_auth_authorization_foundation.sql:1)

### 2. Completar el perfil del administrador

```sql
update public.profiles
set
  full_name = 'Maximiliano Contreras',
  job_title = 'Administrador del Sistema',
  department = 'Plataforma',
  status = 'active',
  is_super_admin = true
where email = 'maximiliano.contreras@busesjm.com';
```

### 3. Asignar rol explícito de admin

```sql
insert into public.user_roles (user_id, role_code)
select id, 'admin'
from public.profiles
where email = 'maximiliano.contreras@busesjm.com'
on conflict (user_id, role_code) do nothing;
```

### 4. Crear un segundo usuario y asignarle rol

Ejemplo `reclutamiento`:

```sql
update public.profiles
set
  full_name = 'Nombre Apellido',
  job_title = 'Analista de Reclutamiento',
  department = 'Reclutamiento',
  status = 'active'
where email = 'usuario@busesjm.com';

insert into public.user_roles (user_id, role_code)
select id, 'reclutamiento'
from public.profiles
where email = 'usuario@busesjm.com'
on conflict (user_id, role_code) do nothing;
```

## Siguiente cambio de aplicación

El frontend hoy todavía puede apoyarse en metadata temporal y allowlist para no cortar la operación.

El siguiente paso correcto es cambiar `AuthContext` para que lea:
- `profiles`
- `user_roles`
- `role_module_access`

Y dejar de depender de:
- `raw_user_meta_data.app_role`
- allowlist local por correo
