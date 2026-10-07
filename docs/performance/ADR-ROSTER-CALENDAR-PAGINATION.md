# ADR — Paginación del calendario general de Jornadas

- Estado: Propuesta implementada localmente; pendiente de staging antes de aprobar liberación.
- Fecha: 2026-10-07.
- Decisión: incorporar RPCs aditivas versionadas para resumen global y página del calendario; mantener intactas las RPCs legacy.

## Contexto

`get_hr_roster_bulk_calendar` entrega el padrón y el rango completos en un solo JSON. El contrato expande fechas para cada persona filtrada y resuelve pauta, excepciones y salida antes de devolver el calendario. Por ello, una consulta de `N` trabajadores por `D` días puede producir hasta `N × D` celdas y transferirlas aunque la interfaz solo muestre una parte del padrón.

## Decisión

1. `get_hr_roster_calendar_scope_summary_v2` devuelve conteos y facetas de jornada en el rango, sin construir JSON diario. Los ciclos efectivos se obtienen mediante intervalos de asignación y sus límites, conservando la regla BUK de invalidación y la asignación más reciente para intervalos solapados.
2. `get_hr_roster_bulk_calendar_page_v2` filtra el padrón y, antes de `generate_series`, selecciona como máximo 50 trabajadores. Usa cursor compuesto `(full_name, buk_employee_id)` para navegación estable y evitar el costo creciente de `OFFSET`; el ID BUK desempata nombres iguales.
3. El frontend debounced/cancelable conserva el rango, búsqueda, área/administrador, chips de ciclo y Sin Jornada. La vista no solicita páginas sin un alcance operativo, como antes.
4. Excel es una acción explícita y solicita sucesivas páginas bajo los mismos filtros. No solicita la página completa al entrar en la vista.
5. Las RPCs antiguas permanecen sin cambios para rollback de frontend. Las dos funciones nuevas son `SECURITY DEFINER`, fijan `search_path`, verifican `user_can_view_hr_roster`, rechazan rangos/filtros no permitidos y conceden ejecución solo a `authenticated`. El helper privado no se expone a roles de API.

## Cardinalidad estimada

| Rango | Antes: todos los trabajadores | Página nueva: máximo 50 |
|---:|---:|---:|
| 7 días | `N × 7` | 350 celdas |
| 31 días | `N × 31` | 1.550 celdas |
| 90 días | `N × 90` | 4.500 celdas |
| 184 días | `N × 184` | 9.200 celdas |

La RPC de resumen aún inspecciona el conjunto filtrado y sus intervalos de asignación para preservar totales/facetas globales, pero no produce la cuadrícula diaria ni el payload por trabajador. No se añade una proyección persistente ni índices especulativos sin plan real.

## Consistencia y límites conocidos

- Cada página es una llamada/instantánea transaccional independiente; cambios del padrón o del nombre durante una exportación pueden afectar el conjunto entre páginas. El cursor evita el desplazamiento inherente a `OFFSET`, pero no promete snapshot serializable entre múltiples llamadas. Confirmar si exportaciones con mutación concurrente requieren un snapshot materializado antes de liberar.
- La descarga XLSX conserva los datos de todas las filas en memoria del navegador al terminar de traer páginas. El costo queda detrás de la acción explícita; falta medir con contratos y rangos grandes.
- La equivalencia exacta de conteos, ciclos y celdas debe probarse en PostgreSQL staging; las pruebas locales actuales son de contrato/frontend, no ejecución real de SQL.

## Rollback

Revertir el frontend para consultar `get_hr_roster_bulk_calendar` y el resumen mensual existente. La migración es aditiva: las RPC legacy no se reemplazan ni se eliminan. No aplicar en producción hasta staging, comparación old/new, planes/mediciones y aprobaciones del flujo normal de release.
