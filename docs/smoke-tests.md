# Smoke Tests Operativos

## Gating actual del repo

Comandos minimos ya usados en cambios productivos:

```bash
npm run audit:migrations
npx tsc -b --pretty false
npm run build:frontend-check
git diff --check
```

Cuando hay SQL/RPCs nuevas o modificadas:

```bash
npx --yes supabase db push --linked --dry-run
npx --yes supabase db push --linked --include-all
```

Cuando hay Edge Functions afectadas:

```bash
npx --yes supabase functions deploy <function_name> --project-ref <ref> --use-api --yes
```

## Matriz minima por rol

### `admin`

- login
- carga de `get_my_effective_permissions`
- acceso a Inicio
- acceso a BI y alta operacional

### `reclutamiento`

- abrir `Solicitud de Contrataciones`
- abrir `Control de Contrataciones`
- buscar candidatos/trabajadores
- ver detalle de caso y mover etapa segura

### `control_contratos`

- aprobar/gestionar folio
- revisar `Folios en curso`
- validar que no vea datos fuera de su scope

### `administrativo` / `jefe_administrativo`

- acceso a movilidad/roster/acreditacion segun modulo efectivo
- validacion de que capacidades acumuladas existan cuando aplica

### Roles gerenciales

- acceso a resumenes/BI
- bloqueo de acciones mutativas no autorizadas

### `operaciones`

- acceso a `/operaciones/*`
- acceso a roster y acreditacion
- bloqueo de modulos de reclutamiento si no corresponde

## Flujos criticos que siempre deben humearse

- `Inicio`: widgets, tareas, resumen operativo y folios activos.
- Reclutamiento: listado paginado, detalle, aprobaciones, resumen y visibilidad por rol.
- Movilidad interna: carga de catalogos, folios elegibles, detalle y cola RRHH.
- Incentivos: setup, registro, cola de aprobacion, analytics.
- Roster: worker lookup, calendario y resumen mensual.
- Acreditacion: dashboard, workers, settings y eventos auditables.
- Onboarding: templates, tasks, cases y activity log.

## Deuda actual

- El repo no tiene aun `tests/smoke` ni Playwright/Cypress productivo.
- La cobertura depende de build + humo SQL/manual.

## Siguiente implementacion segura

Crear una pasada separada con:

1. `tests/smoke/` por rol principal.
2. fixtures de usuarios controlados.
3. validaciones RPC con cuentas reales de prueba o harness service-role acotado.
