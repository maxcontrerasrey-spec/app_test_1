# Auditoría de Historial de Migraciones

## Resumen

- Estado revisado: `2026-06-12`
- Archivos SQL en `supabase/migrations`: `119`
- Migraciones con formato CLI válido (`YYYYMMDDHHMMSS_nombre.sql`): `11`
- Migraciones legacy con formato partido (`YYYYMMDD_HHMMSS_nombre.sql`): `108`
- Colisiones detectadas al convertir `YYYYMMDD_HHMMSS` a `YYYYMMDDHHMMSS`: `0`
- Archivo no SQL que generaba ruido en `migration list`: `README.md`

## Qué se corrigió en esta pasada

- Se movió `supabase/migrations/README.md` a [`supabase/README.md`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/README.md:1).
- Se dejó este documento como referencia operativa del saneamiento pendiente.

## Qué no se hizo a propósito

No se renombraron masivamente las `108` migraciones legacy.

Razón:

- El historial remoto ya está desalineado respecto del naming local.
- Varias migraciones fueron aplicadas manualmente en producción fuera del flujo normal de la CLI.
- Renombrar en lote ahora mismo sin reconciliar `schema_migrations` puede empeorar `migration list` y abrir riesgo de registros falsos en remoto.

## Regla segura

Antes de renombrar una migración legacy, deben cumplirse las dos cosas:

1. Tener claro el nombre destino exacto de 14 dígitos.
2. Saber si esa versión ya fue aplicada en remoto y, si corresponde, registrarla con `supabase migration repair ... --status applied`.

## Mapeo seguro de naming

La normalización segura del nombre es puramente mecánica:

- Origen: `YYYYMMDD_HHMMSS_descripcion.sql`
- Destino: `YYYYMMDDHHMMSS_descripcion.sql`

Ejemplos reales:

- `20260611_170000_add_hiring_transactional_email_notifications.sql`
  -> `20260611170000_add_hiring_transactional_email_notifications.sql`
- `20260611_231500_fix_internal_mobility_worker_resolution.sql`
  -> `20260611231500_fix_internal_mobility_worker_resolution.sql`
- `20260612_003000_link_internal_mobility_to_recruitment_cases.sql`
  -> `20260612003000_link_internal_mobility_to_recruitment_cases.sql`

## Migraciones nuevas ya registradas correctamente

Estas sí quedaron con naming válido y registradas en remoto en esta fase reciente:

- `20260612120000_align_internal_mobility_permission_contracts.sql`
- `20260612130334_add_hr_incentive_double_approval_queue.sql`
- `20260612131500_expand_hr_incentive_contract_options.sql`
- `20260612133000_fix_hr_incentive_request_folio_ambiguity.sql`
- `20260612133601_expose_hr_module_for_incentive_approvers.sql`
- `20260612140000_restore_requester_visibility_for_hiring_process_summary.sql`

## Próximo saneamiento recomendado

La próxima pasada debe ser controlada y en este orden:

1. Exportar una foto del remoto desde `supabase_migrations.schema_migrations`.
2. Generar una tabla de equivalencias `legacy local -> normalized local -> remote`.
3. Renombrar solo archivos cuyo mapeo y estado remoto estén confirmados.
4. Registrar con `migration repair` únicamente las versiones realmente aplicadas.
5. Repetir `supabase migration list` y validar que no aparezcan fechas colapsadas como `20260611`.

## Criterio de no regresión

Si una limpieza mejora el naming local pero empeora la reconciliación con remoto, se considera incorrecta.

En este proyecto, primero manda la integridad del historial remoto; después la estética del árbol local.
