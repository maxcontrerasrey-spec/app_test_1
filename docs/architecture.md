# Arquitectura Actual del ERP

## Estado actual

El ERP opera hoy como una SPA en `React 18 + TypeScript + Vite`, con `React Router` para modulos lazy-loaded, `@tanstack/react-query` para cache/invalidation y `@supabase/supabase-js` como gateway unico hacia PostgreSQL/Supabase, RPCs, Auth y Realtime.

## Capas vivas

### Frontend

- `src/app/router/AppRouter.tsx`: define rutas protegidas por modulo.
- `src/app/router/routeModules.ts`: resuelve lazy imports por ruta.
- `src/app/layout/AppShell.tsx`: shell transversal de navegacion, topbar y layout.
- `src/modules/*`: cada dominio concentra paginas, componentes, hooks y servicios.
- `src/shared/*`: clientes compartidos, UI base, logger, runtime config y utilidades.

### Autorizacion y sesion

- `src/modules/auth/context/AuthContext.tsx`: carga sesion y llama `get_my_effective_permissions`.
- `src/modules/auth/components/RouteGuards.tsx`: protege por autenticacion, rol admin y modulo.
- `src/modules/auth/config/access.ts`: normaliza roles, modulos y capabilities visibles para frontend.

### Datos y backend

- `src/shared/lib/supabase.ts`: cliente anon con `persistSession` y `autoRefreshToken`.
- `src/shared/hooks/useRealtimeQueryInvalidation.ts`: invalida queries por eventos `postgres_changes`.
- `src/modules/*/services/*.ts`: concentran llamadas a RPCs y mapping de payloads.
- `supabase/migrations/*.sql`: source of truth de tablas, RLS, helpers, RPCs y grants.
- `supabase/functions/*`: integraciones y procesos fuera del hot path del frontend.

## Flujo de acceso recomendado

1. Pagina o componente pide datos via hook del dominio.
2. El hook delega a un servicio de `src/modules/<dominio>/services`.
3. El servicio llama una RPC o tabla via Supabase.
4. PostgreSQL aplica RLS, helpers `user_can_*`, grants y triggers.
5. React Query cachea, refresca y revalida por Realtime o eventos mutativos.

## Dominios principales

- Reclutamiento: solicitudes, folios, casos, candidatos, aprobaciones, documentos, dashboard operativo.
- Movilidad interna: solicitud de traslado, aprobaciones, ejecucion RRHH, reuso de folios de reclutamiento.
- RRHH: incentivos extraordinarios, jornadas/turnos, acreditacion.
- Operaciones: registros base/especiales y reportabilidad operacional.
- BI: dotacion, ausentismo y analitica de reclutamiento.
- Alta operacional: templates, tasks, evidencias y activity log.
- AI assistant: consultas y conocimiento asistido.

## Restricciones tecnicas vigentes

- La capa SQL concentra mucha logica de negocio. Eso mantiene Zero Trust, pero sube el costo de auditar cambios en RPCs grandes.
- Aun no existe un harness E2E automatizado por rol; hoy la validacion fuerte es `tsc`, build, auditoria de migraciones y humo SQL/manual.
- El arbol de migraciones tiene deuda legacy controlada por `supabase/migration-baseline.json` y `supabase/MIGRATIONS_AUDIT.md`.

## Decision arquitectonica vigente

- No abrir una segunda fuente de verdad para trabajadores BUK.
- No mover permisos criticos al cliente.
- No reescribir modulos completos mientras existan fixes incrementales seguros.
- No editar migraciones historicas ya aplicadas salvo necesidad excepcional y controlada.

## Validacion minima antes de publicar

```bash
npm run audit:migrations
npx tsc -b --pretty false
npm run build:frontend-check
git diff --check
npx --yes supabase db push --linked --dry-run
```
