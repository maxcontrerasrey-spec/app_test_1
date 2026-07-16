# Smoke Tests Operativos

## Gating actual del repo

Comandos minimos ya usados en cambios productivos:

```bash
npm run audit:migrations
npm run audit:enterprise-docs
npm run audit:route-role-smoke
npx tsc -b --pretty false
npm run build:frontend-check
git diff --check
```

## Smoke automatizado actual

`npm run audit:route-role-smoke` valida de forma estatica:

- toda ruta con `RoleProtectedRoute` usa un `moduleCode` conocido por `src/modules/auth/config/access.ts`;
- todo item de navegacion tiene ruta protegida real;
- el `moduleCode` visible en navegacion coincide con el guard de la ruta mas especifica;
- `visibleForRoles` solo referencia roles conocidos;
- `routeModules.ts` precarga las rutas protegidas y rutas publicas principales.

Este smoke no reemplaza pruebas E2E con login real, pero bloquea drift de contrato entre navegacion, routing, autorizacion frontend y lazy loading.

`npm run smoke:dashboard-rpc` valida de forma funcional contra el proyecto Supabase linkeado:

- `get_my_effective_permissions()` rechaza llamadas sin `auth.uid()`;
- se selecciona un perfil activo con rol vigente, o se usa `SUPABASE_SMOKE_USER_ID` si esta definido;
- se simula el claim `request.jwt.claim.sub` dentro de una transaccion `read only`;
- `get_my_effective_permissions()` devuelve perfil, roles y modulos con estructura valida;
- `get_dashboard_home_bundle(2)` devuelve el bundle de Inicio con arrays y resumen operacional esperados.

Este smoke no escribe datos ni crea usuarios. Requiere que el proyecto este linkeado con Supabase CLI y que el operador tenga acceso para `supabase db query --linked`.

`npm run smoke:operations-rpc` valida de forma funcional contra el proyecto Supabase linkeado:

- `user_contracts` y `operations_editable_contracts` no exponen filas sin `auth.uid()`;
- se selecciona un perfil activo con modulo `operaciones`, priorizando usuarios con matriz editable activa, o se usa `SUPABASE_OPERATIONS_SMOKE_USER_ID`;
- se simula el claim `request.jwt.claim.sub` dentro de una transaccion `read only`;
- el usuario autenticado ve contratos visibles, servicios base, contratos activos y equipos activos;
- las consultas read-only de `service_entries` para resumen/exportador responden sin crear ni modificar planificaciones.

Este smoke no ejecuta `submit_service_entries_batch(...)` ni escribe `service_entries`.

`npm run smoke:operations-write-rpc` valida de forma funcional el guardado de Operaciones contra el proyecto Supabase linkeado:

- selecciona un usuario activo L1/L2 con contrato editable vigente, o usa `SUPABASE_OPERATIONS_SMOKE_USER_ID`;
- selecciona un servicio base real del contrato editable;
- simula `request.jwt.claim.sub` en una transaccion controlada;
- ejecuta `submit_service_entries_batch(...)` dos veces con estado `not_performed` para cubrir insercion y actualizacion sobre la misma llave operacional;
- confirma que dentro de la transaccion aparece exactamente una fila y que el segundo guardado actualiza sin duplicar;
- ejecuta `ROLLBACK` y verifica desde una consulta posterior que el conteo persistente de `service_entries` no cambio.

Este smoke prueba la frontera de escritura sin dejar planificaciones reales ni documentos operativos falsos.

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

### `certificaciones`

- acceso a `/certificados`
- busqueda BUK por autocompletar estandar
- seleccion editable de instructor cuando corresponde
- generacion de PDF de prueba sin persistencia ni carga BUK

### `instructor`

- acceso a `/certificados`
- instructor autocompletado desde la cuenta cuando existe vinculacion
- campos de instructor bloqueados para edicion manual
- generacion de PDF de prueba sin persistencia ni carga BUK

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
- Certificacion de competencias: trabajador BUK, instructor, equipos autorizados, PDF temporal y Edge Function productiva con rechazo sin bearer.
- Onboarding: templates, tasks, cases y activity log.

## Deuda actual

- El repo no tiene aun `tests/smoke` ni Playwright/Cypress productivo.
- La cobertura funcional UI aun depende de build + humo SQL/manual, pero rutas/roles/preloads, RPCs base de Inicio y lecturas/escritura transaccional de Operaciones ya tienen smoke automatizado.

## Siguiente implementacion segura

Crear una pasada separada con:

1. `tests/smoke/` por rol principal.
2. fixtures de usuarios controlados.
3. validaciones RPC con cuentas reales de prueba o harness service-role acotado.
