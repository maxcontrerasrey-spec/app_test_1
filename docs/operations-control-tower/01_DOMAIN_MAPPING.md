# Mapa de dominio — Atlas Operations Control

## Entidades vigentes confirmadas

| Concepto funcional | Entidad Atlas | Identificadores/uso |
|---|---|---|
| Contrato | `public.contracts` | `id`, `code`, `contract_name`, `is_active` |
| Servicio planificado base | `public.base_services` | `id`, `external_key`, `contract_id`, nombres, categoría, jornada |
| Vehículo/equipo | `public.equipment` | `equipment_code`, patente, tipo, cliente, `is_active` |
| Registro operacional existente | `public.service_entries` | servicio base + fecha + turno + snapshots BUK/equipo; registros históricos |
| Jornada de conductor | dominio roster/Buk | Resolver por RPC `search_operations_drivers` para fecha; no copiar su fuente |
| Alcance de edición | `operations_contract_editors` + `user_can_edit_operations_contract` | usuario, contrato activo, rol L1/L2 |
| Identidad de actor | `auth.uid()` / `profiles` | actor autenticado para toda mutación |

## Brechas del dominio actual

No había orden/viaje independiente, assignment temporal, versión de plantilla de hitos, evento de conductor, acknowledgment, alerta, geocerca ni telemetría. `service_entries.service_execution_status` solo describía `planned` / `not_performed`; no equivalía al lifecycle de un viaje. Estas tablas y sus datos se retiran; el nuevo esquema inicia vacío.

## Mapeo de reemplazo

Las nuevas tablas `atlas_ops_service_templates`, `atlas_ops_vehicles` y `atlas_ops_dispatches` sustituyen los maestros/registros Operaciones y parten vacías. No se importan los datos previos. Hitos, eventos append-only, bindings de conductor, reglas de geocerca, telemetría y alertas viven en nuevas tablas `atlas_ops_*`.

Las tablas externas `contracts`, `employees`/BUK, roster y `profiles` se conservan; los roles siguen siendo canónicos, pero se borraron todas las filas `role_module_access` de `operaciones`. La antigua matriz `operations_contract_editors` se retira; `atlas_ops_contract_editors` parte vacía y solo superadmin puede modificarla. La salida inicial autoriza exclusivamente perfiles activos con `profiles.is_super_admin = true`.

## Identidad del conductor

Un acceso móvil a acciones de conductor requiere resolver, en backend, `auth.uid()` a un ID BUK exacto. La búsqueda de conductores por nombre/RUT sirve al coordinador y roster, pero no autentica al conductor. La asociación vigente para login compartido no se considera automáticamente equivalente a identidad personal del conductor.
