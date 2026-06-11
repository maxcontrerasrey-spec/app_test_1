# Factibilidad Técnica: Módulo Movilidad Interna

## Resumen ejecutivo

La implementación de `Movilidad Interna` es factible sobre la base actual del proyecto, con alta reutilización de frontend, permisos, aprobaciones, auditoría y notificaciones ya construidas para `Solicitud de Contratación`.

La decisión correcta no es extender directamente `hiring_requests`, porque ese modelo está acoplado a vacantes, cupos y apertura de casos de reclutamiento. `Movilidad Interna` representa otro dominio: un traslado de un trabajador activo ya existente.

La recomendación es:

1. Crear un módulo nuevo y explícito (`movilidad_interna`).
2. Reutilizar la misma cadena de aprobación y el mismo patrón transaccional.
3. Crear tablas y RPCs propias para movilidad interna.
4. Extraer utilidades compartidas donde hoy la lógica está repetida o muy específica de contratación.

## Reutilización real disponible hoy

### Frontend

- La navegación y protección por módulo ya existen en:
  - [src/shared/config/navigation.ts](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/config/navigation.ts:1)
  - [src/app/router/AppRouter.tsx](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/app/router/AppRouter.tsx:1)
  - [src/modules/auth/config/access.ts](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/auth/config/access.ts:1)
- El patrón de formulario, estado local, validaciones y envío ya existe en:
  - [src/modules/recruitment/pages/HiringRequestPage.tsx](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/pages/HiringRequestPage.tsx:1)
- El patrón de carga de catálogos desde Supabase ya existe en:
  - [src/modules/recruitment/services/hiringCatalogs.ts](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/services/hiringCatalogs.ts:1)
- El lookup de trabajadores activos BUK ya existe en:
  - [src/modules/incentives/services/incentivesApi.ts](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/services/incentivesApi.ts:1)

### Backend / SQL

- La vista consolidada de trabajadores activos BUK ya existe en:
  - [supabase/migrations/20260529_235000_harden_buk_active_employee_contract.sql](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260529_235000_harden_buk_active_employee_contract.sql:1)
- El catálogo de áreas operativas mapeadas desde BUK ya existe en:
  - [supabase/migrations/20260607_230000_add_buk_contract_mapping_catalog.sql](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260607_230000_add_buk_contract_mapping_catalog.sql:1)
- La resolución de contexto del trabajador BUK ya existe en:
  - [supabase/migrations/20260607_230000_add_buk_contract_mapping_catalog.sql](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260607_230000_add_buk_contract_mapping_catalog.sql:820)
- La cadena de aprobación base de contratación ya existe en:
  - [supabase/migrations/20260607_230000_add_buk_contract_mapping_catalog.sql](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260607_230000_add_buk_contract_mapping_catalog.sql:349)
- La notificación transaccional por correo ya quedó preparada en:
  - [supabase/functions/hiring-transactional-email/index.ts](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/hiring-transactional-email/index.ts:1)

## Qué no conviene reutilizar de forma directa

No conviene forzar `Movilidad Interna` dentro de `hiring_requests`.

### Motivos

- `hiring_requests` está diseñado para crear requerimientos de vacantes.
- La RPC `submit_hiring_request(...)` valida y persiste campos que no aplican a movilidad:
  - vacantes
  - fechas de ingreso
  - turno
  - oferta salarial
  - apertura de caso de reclutamiento posterior
- `Movilidad Interna` parte desde un trabajador activo y su área/contrato actual, no desde una necesidad de dotación nueva.

Si se mezcla en la misma tabla, el costo es alto:

- columnas nulas o semánticamente ambiguas,
- lógica condicional creciente,
- riesgo de regresiones en el flujo productivo de contratación,
- reportes y auditoría más difíciles de mantener.

## Gap principal detectado

El sistema ya puede obtener `empresa actual` desde BUK a través del `raw_payload` del colaborador sincronizado.

El gap real es `empresa destino`.

Hoy `buk_contract_mappings` no guarda explícitamente una columna de empresa legal o empresa destino para cada área/contrato operacional. Por eso la regla:

- `empresa actual != empresa destino`

no queda 100% confiable si solo usamos el estado actual del catálogo tal como está hoy.

## Recomendación para resolver empresa destino

Agregar una columna explícita en `buk_contract_mappings`, por ejemplo:

- `company_name text not null`

Con eso:

- `empresa destino` se resuelve por el contrato/área destino seleccionado,
- el cálculo de `requiere_finiquito` queda determinístico,
- el dato sirve también para reportería, auditoría y exportación,
- se evita depender de inferencias débiles por nombre de contrato o centro de costo.

La lista de empresas entregada por negocio puede usarse para poblar o validar este catálogo.

## Diseño recomendado

## 1. Módulo nuevo

Crear un nuevo módulo autorizado:

- `movilidad_interna`

Con:

- entrada en `app_modules`,
- reglas en `role_module_access`,
- alta en `AppModuleCode`,
- nueva ruta protegida,
- nueva opción de navegación junto a `Solicitud de Contratación`.

## 2. Nuevo dominio de datos

Crear al menos:

- `internal_mobility_requests`
- `internal_mobility_request_approvals`
- `internal_mobility_request_audit_log`

Campos sugeridos para `internal_mobility_requests`:

- `id`
- `folio`
- `status`
- `requested_by`
- `requester_name`
- `requester_email`
- `employee_buk_employee_id`
- `employee_document_number`
- `employee_full_name`
- `current_job_title`
- `current_contract_code`
- `current_area_name`
- `current_area_code`
- `current_company_name`
- `destination_job_title`
- `destination_contract_id`
- `destination_contract_code`
- `destination_area_name`
- `destination_area_code`
- `destination_company_name`
- `requires_termination`
- `motive`
- `submitted_at`
- `created_at`
- `updated_at`

## 3. RPCs nuevas

Crear RPCs específicas, por ejemplo:

- `get_internal_mobility_setup_catalogs()`
- `get_internal_mobility_worker_context(p_buk_employee_id text)`
- `submit_internal_mobility_request(...)`
- `get_internal_mobility_dashboard(...)`
- `approve_internal_mobility_request(...)`

La recomendación es que `get_internal_mobility_worker_context(...)` reutilice el mismo patrón ya probado en el módulo de incentivos.

## 4. Aprobación compartida por patrón, no por tabla

La cadena debe ser la misma:

- solicitante
- gerente o aprobador de área
- control de contratos
- reclutamiento si el flujo de negocio efectivamente lo requiere en movilidad

Pero la implementación debe compartir:

- resolución de aprobadores,
- snapshots,
- auditoría,
- disparo de notificaciones,
- plantillas de correo,

sin obligar a que contratación y movilidad escriban en la misma tabla.

## 5. UI del formulario

El formulario puede reutilizar:

- layout general,
- componentes base,
- mensajes de error,
- loaders,
- patrón de submit,
- detalle de solicitud.

Campos del formulario:

- trabajador activo BUK
- RUT
- cargo actual
- contrato/área actual
- empresa actual
- cargo nuevo
- contrato/área nuevo
- empresa destino
- motivo

Reglas UI:

- al seleccionar trabajador, autocompletar desde BUK,
- al cambiar contrato/área destino, recalcular empresa destino,
- si cambia empresa, mostrar alerta amarilla,
- persistir `requires_termination` calculado por backend, no por confianza en el frontend.

## Factibilidad por capas

### Alta

- navegación y permisos,
- lookup de trabajadores activos BUK,
- catálogos de cargos y áreas,
- patrón de formulario,
- patrón de RPC transaccional,
- auditoría,
- correo transaccional.

### Media

- dashboard/resumen del nuevo módulo,
- detalle de solicitud con historial completo,
- reutilización parcial del motor de aprobaciones sin refactor mayor.

### Baja si se intenta en una sola pasada

- unificar completamente contratación y movilidad bajo un único modelo genérico,
- reutilizar `hiring_requests` sin degradar semántica,
- derivar empresa destino sin extender catálogos.

## Dependencias mínimas antes de construir

1. Definir el código oficial del módulo nuevo.
2. Confirmar si `Movilidad Interna` termina en reclutamiento o solo replica hasta control de contratos.
3. Incorporar `company_name` o equivalente al mapping de destino.
4. Confirmar si cualquier cargo BUK vigente puede ser destino o si habrá restricción por contrato/empresa.

## Propuesta de implementación incremental

### Etapa 1

- registrar módulo `movilidad_interna`
- crear tablas base
- exponer catálogo de trabajadores activos y áreas destino
- construir formulario
- calcular y persistir `requires_termination`
- enviar solicitud a aprobación

### Etapa 2

- detalle completo con historial
- dashboard y filtros
- correos transaccionales por etapa
- reportería/exportación

### Etapa 3

- refactor compartido de utilidades entre contratación y movilidad
- consolidación de helpers de aprobación/notificación para evitar drift futuro

## Conclusión

Sí es factible y encaja bien con la arquitectura actual si se implementa como un módulo hermano de `Solicitud de Contratación`, no como una variante escondida dentro del mismo flujo.

La reutilización buena está en:

- autenticación y permisos,
- integración BUK,
- resolución de áreas/contratos,
- aprobación,
- auditoría,
- correo.

La principal dependencia técnica a resolver antes de implementar en serio es dejar explícita la `empresa destino` en el catálogo que relaciona área BUK con contrato operativo.
