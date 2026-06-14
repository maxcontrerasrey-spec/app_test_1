# Supabase

Este directorio contiene el historial completo de base de datos y runtime de Supabase del ERP: migraciones SQL, funciones Edge y documentación operativa.

## Convención de nomenclatura de migraciones

Las migraciones SQL que deban ser reconocidas limpiamente por la CLI de Supabase deben vivir en [`supabase/migrations`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations) con este formato:

`YYYYMMDDHHMMSS_descripcion_corta.sql`

Ejemplo válido:

`20260612133601_expose_hr_module_for_incentive_approvers.sql`

No dejar archivos Markdown ni utilitarios dentro de `supabase/migrations`, porque `supabase migration list` los recorre y genera ruido operacional.

## Estado actual del historial legacy

El repositorio todavía conserva muchas migraciones históricas con formato legacy:

`YYYYMMDD_HHMMSS_descripcion.sql`

Ese formato no rompe el SQL, pero sí degrada el output de `supabase migration list`, colapsando versiones como `20260611` o `20260612`.

La auditoría y el plan seguro de saneamiento quedaron documentados en:

[`supabase/MIGRATIONS_AUDIT.md`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/MIGRATIONS_AUDIT.md:1)

La baseline congelada que permite auditar sin seguir degradando el árbol quedó en:

[`supabase/migration-baseline.json`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migration-baseline.json:1)

## Guardia automática

Desde esta reparación, el repo trae un validador explícito:

```bash
npm run audit:migrations
```

Ese comando:

- falla si aparece un archivo con naming inválido dentro de `supabase/migrations`
- falla si entra una migración legacy nueva fuera de la baseline congelada
- falla si aparece una nueva colisión de versión normalizada

La baseline actual se puede regenerar solo de forma deliberada con:

```bash
npm run audit:migrations:write-baseline
```

Además, GitHub Actions ejecuta la misma validación en:

[`audit-supabase-migrations.yml`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/.github/workflows/audit-supabase-migrations.yml:1)

## 🔒 Arquitectura Zero Trust

La plataforma opera bajo el principio de Confianza Cero en la capa de datos:

1. **Mutaciones Restringidas**: Los clientes web (frontend) tienen prohibido modificar estados operacionales (ej. cambiar un caso de reclutamiento de `open` a `screening`) de forma directa mediante un `UPDATE` tradicional.
2. **SECURITY DEFINER**: Todas las acciones sensibles deben ejecutarse llamando a Funciones RPC (`supabase.rpc()`). Estas funciones se ejecutan con privilegios de administrador temporalmente (`SECURITY DEFINER`) pero validan internamente (`request.jwt.claims`) si el usuario tiene permiso para esa acción.
3. **Triggers Defensivos**: Tablas críticas como `profiles` poseen triggers en PostgreSQL (`BEFORE UPDATE`) que abortan cualquier transacción que intente modificar columnas sensibles (como `is_super_admin`) a menos que el usuario emisor sea legítimamente un superadmin.

## 🚀 Ejecutar migraciones localmente

Si utilizas la CLI oficial de Supabase para desarrollo local:

```bash
# Iniciar contenedor de base de datos
supabase start

# Aplicar las nuevas migraciones generadas
supabase migration up
```

*(Si no usas la CLI, las migraciones se aplican pegando el SQL directamente en el SQL Editor del dashboard web de Supabase en el proyecto de Staging/Producción. Si haces eso, después debes reconciliar `supabase_migrations.schema_migrations` o dejarás roto el historial remoto respecto del repo.)*
