# Auditoría de Historial de Migraciones

## Estado auditado

- Fecha de auditoría: `2026-06-13`
- Archivos SQL en `supabase/migrations`: `146`
- Migraciones con formato canónico `YYYYMMDDHHMMSS_nombre.sql`: `38`
- Migraciones legacy con formato partido `YYYYMMDD_HHMMSS_nombre.sql`: `108`
- Archivos con naming inválido: `0`
- Colisiones de versión normalizada detectadas: `1`

## Hallazgo crítico

El árbol histórico mezcla dos esquemas de versionado:

- canónico: `YYYYMMDDHHMMSS_nombre.sql`
- legacy: `YYYYMMDD_HHMMSS_nombre.sql`

Además existe una colisión real de versión normalizada:

- `20260522000020`
  - `20260522_000020_add_update_candidate_driver_license_rpc.sql`
  - `20260522_000020_candidate_documents_module.sql`

Ese estado no necesariamente rompe la base productiva hoy, pero sí debilita:

- `supabase migration list`
- reconciliación local vs remoto
- auditoría de cambios
- automatización futura de CI/CD sobre base de datos

## Qué se reparó en esta pasada

### 1. Se congeló una baseline explícita del árbol legacy

Quedó creada en:

[`supabase/migration-baseline.json`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migration-baseline.json:1)

Esa baseline:

- enumera las `108` migraciones legacy permitidas hoy
- registra la única colisión de versión normalizada actualmente aceptada
- define el corte canónico en `20260612120000`

### 2. Se agregó un auditor automatizable

Quedó creado:

[`scripts/audit-supabase-migrations.mjs`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/scripts/audit-supabase-migrations.mjs:1)

Capacidades:

- clasifica canónicas, legacy e inválidas
- detecta colisiones de versión normalizada
- puede regenerar la baseline congelada
- puede fallar el build si aparece deuda nueva fuera del baseline

Comandos:

```bash
npm run audit:migrations
npm run audit:migrations:write-baseline
```

### 3. Se dejó una guardia en CI

Quedó creado:

[`audit-supabase-migrations.yml`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/.github/workflows/audit-supabase-migrations.yml:1)

Ese workflow ejecuta `npm run audit:migrations` en push y pull request sobre cambios que toquen:

- `supabase/**`
- `scripts/audit-supabase-migrations.mjs`
- `package.json`

### 4. Se actualizó la documentación operativa

Quedó reforzado:

[`supabase/README.md`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/README.md:1)

Ahora documenta:

- convención canónica
- existencia de baseline congelada
- guardarraíl automático
- advertencia explícita sobre aplicar SQL manual sin reconciliar historial remoto

## Reconciliación remota ya hecha

En la pasada anterior ya se había backfilleado en `supabase_migrations.schema_migrations` la ventana reciente cuya presencia en base fue verificada o cuyo efecto quedó absorbido por migraciones posteriores:

- `20260612224500`
- `20260612233000`
- `20260613103000`
- `20260613150000`
- `20260613193000`
- `20260614001000`
- `20260614102500`
- `20260614104000`
- `20260614113000`
- `20260614130000`
- `20260614133500`
- `20260614170000`

Eso cerró la parte reciente y operativa del drift sin reejecutar DDL histórico sobre producción.

## Qué no se hizo a propósito

No se renombraron en lote las `108` migraciones legacy.

Razón técnica:

- el sistema productivo hoy opera bien
- el historial remoto ya mezcla migraciones aplicadas manualmente y registros generados por el conector
- renombrar archivos históricos sin una reconciliación integral podría empeorar la trazabilidad en vez de mejorarla

Tampoco se movieron archivos legacy fuera de `supabase/migrations`, porque hacerlo ahora dejaría un repo incapaz de reconstruir historia completa sin crear primero una baseline SQL materializada, lo que ya sería una cirugía mayor

## Riesgo residual después de esta reparación

Sigue existiendo deuda legacy histórica, pero ahora está encapsulada:

- no puede crecer silenciosamente sin romper la auditoría automatizada
- la colisión conocida quedó registrada como excepción explícita
- toda migración nueva debe entrar con naming canónico

En otras palabras: no quedó resuelto todo el pasado, pero sí quedó reparado el mecanismo para que el problema no siga empeorando.

## Próxima fase segura si se quisiera sanear el pasado completo

Solo en una pasada separada y controlada:

1. exportar snapshot completo de `supabase_migrations.schema_migrations`
2. construir un manifiesto uno a uno `archivo local -> versión normalizada -> estado remoto`
3. decidir un corte de baseline histórica
4. recién después evaluar archivado o materialización de baseline SQL

Mientras esa fase no ocurra, la baseline congelada actual pasa a ser la fuente operativa de verdad para la deuda legacy.
