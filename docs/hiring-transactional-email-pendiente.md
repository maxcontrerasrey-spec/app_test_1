# Pendiente de Ejecutar: Correos de Aprobación de Contratación

Este documento deja solo lo que falta ejecutar manualmente en Supabase para activar los correos del flujo:

- envío al `gerente de área` cuando nace la aprobación `area_manager`
- envío a `control de contratos` cuando nace la aprobación `contracts_control`
- envío a `reclutamiento` cuando se abre el `recruitment_case`

## Estado actual

Ya quedó listo en repo:

- Edge Function: `hiring-transactional-email`
- Configuración en `supabase/config.toml` con `verify_jwt = false`
- Migración: `supabase/migrations/20260611_170000_add_hiring_transactional_email_notifications.sql`

La function ya fue deployada en el proyecto:

- `project_ref`: `pzblmbahnoyntrhistea`
- URL: `https://pzblmbahnoyntrhistea.supabase.co/functions/v1/hiring-transactional-email`

## 1. Ejecutar la migración SQL

Aplicar en Supabase la migración:

- `supabase/migrations/20260611_170000_add_hiring_transactional_email_notifications.sql`

Si la aplicas manualmente desde el SQL Editor, usa el contenido completo del archivo.

## 2. Crear los secrets faltantes

Ejecutar desde la raíz del repo:

```bash
cd /Users/maximilianocontrerasrey/Documents/GitHub/app_test_1

npx supabase secrets set INTERNAL_EMAIL_WEBHOOK_SECRET=correo_flujo_aprobaciones_2026_x9KpL2mQ7zR8

npx supabase secrets set HIRING_NOTIFICATIONS_APP_URL=https://TU_DOMINIO_REAL

npx supabase secrets set HIRING_NOTIFICATIONS_FROM_EMAIL=tu-correo-remitente@tu-dominio.com
```

Notas:

- `RESEND_API_KEY` no se toca.
- `INTERNAL_EMAIL_WEBHOOK_SECRET` ya está definido para este flujo y debe quedar exactamente así:
  - `correo_flujo_aprobaciones_2026_x9KpL2mQ7zR8`
- `HIRING_NOTIFICATIONS_APP_URL` debe ser la URL real de la app productiva.
- `HIRING_NOTIFICATIONS_FROM_EMAIL` debe ser un remitente válido/verificado en Resend.

## 3. Activar la configuración en base

Ejecutar este SQL:

```sql
update public.transactional_email_settings
set
  edge_function_url = 'https://pzblmbahnoyntrhistea.supabase.co/functions/v1/hiring-transactional-email',
  webhook_secret_value = 'correo_flujo_aprobaciones_2026_x9KpL2mQ7zR8',
  is_enabled = true
where singleton = true;
```

## 4. Verificación mínima recomendada

Confirmar que existe configuración activa:

```sql
select
  singleton,
  is_enabled,
  edge_function_url,
  webhook_secret_value is not null as has_webhook_secret
from public.transactional_email_settings;
```

Confirmar que la cola de despachos existe:

```sql
select *
from public.transactional_email_dispatches
order by created_at desc
limit 20;
```

## 5. Prueba funcional esperada

Después de activar todo:

1. Crear o enviar un requerimiento de contratación.
2. Debe generarse correo al aprobador de `gerente de área`.
3. Al aprobar gerencia, debe generarse correo a `control de contratos`.
4. Al aprobar `control de contratos`, debe abrirse el caso y generarse correo al pool activo de `reclutamiento`.

## 6. Si algo falla

Revisar primero:

- que la migración esté aplicada
- que `HIRING_NOTIFICATIONS_FROM_EMAIL` exista
- que `HIRING_NOTIFICATIONS_APP_URL` exista
- que `INTERNAL_EMAIL_WEBHOOK_SECRET` coincida exactamente con `webhook_secret_value`
- que `transactional_email_settings.is_enabled = true`

Si la function recibe el evento pero Resend rechaza el envío, el problema normalmente será:

- remitente no verificado
- dominio no verificado en Resend
- formato inválido del remitente
