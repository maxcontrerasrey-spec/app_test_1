# Plan de Implementación: Dashboard "Análisis de Incentivos"

## Hallazgos del estado actual

- La superficie real del módulo no es `IncentivesPage`; el entrypoint vigente es [`HumanResourcesDashboard.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/pages/HumanResourcesDashboard.tsx:1), montado en la ruta `/recursos-humanos/:view`.
- Las pestañas actuales del módulo son `incentivos`, `aprobaciones`, `solicitudes` y `configuracion`. La analítica debe entrar como un nuevo `view` en ese mismo dashboard, no como un shell paralelo.
- El módulo ya vive detrás de `RoleProtectedRoute moduleCode="recursos_humanos"`, pero la analítica necesita una matriz **más estrecha** que el resto del módulo.
- Los roles correctos del repo son:
  - `director_eje`
  - `gerente_general`
  - `director_op`
  - `gerencia`
  - `operaciones_l_1`
  - `control_contratos`
- El wrapper de gráficos existente es [`EChart.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/ui/charts/EChart.tsx:1) y el registro modular ya soporta `LineChart`, `BarChart`, `PieChart`, `Tooltip`, `Legend`, `Grid`, `Toolbox`, `Graphic`, `Dataset`, `DataZoom`, `Mark*`, `CanvasRenderer` y `SVGRenderer` desde [`registry.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/lib/echarts/registry.ts:1).
- La base operativa ya expone en `hr_incentive_requests` los campos suficientes para analítica gerencial sin traer detalle masivo al cliente:
  - `period_code`
  - `incentive_type_id`
  - `incentive_type_name`
  - `selected_contract_code`
  - `selected_area_name`
  - `status`
  - `calculated_amount`
  - `is_out_of_deadline`
  - `is_contract_mismatch`
  - `service_date`
  - `created_at`

## Decisiones de implementación

### 1. Routing y visibilidad

- Agregar un nuevo `view` llamado `analisis` dentro de `HUMAN_RESOURCES_VIEWS`.
- La ruta seguirá siendo `/recursos-humanos/analisis`, reutilizando el dashboard actual.
- La pestaña se mostrará **solo** si el usuario cumple la matriz de roles analíticos o es `superadmin`.
- La vista también se protegerá dentro del propio dashboard: si un usuario llega manualmente a `/recursos-humanos/analisis` sin rol permitido, se redirige a `/sin-acceso` o a `/recursos-humanos/incentivos`.

### 2. Backend analítico

- Crear una migración SQL nueva con dos piezas:
  - `public.user_can_view_hr_incentive_analytics(p_user_id uuid)` para centralizar la autorización.
  - `public.get_hr_incentives_analytics(...)` para devolver payload agregado.
- La RPC será `SECURITY DEFINER`, con `search_path = public`, `grant execute` explícito y `notify pgrst, 'reload schema'`.
- La autorización del backend será:
  - `public.user_is_admin(p_user_id)` **o**
  - cualquiera de los roles analíticos listados arriba.
- No se abrirá acceso directo a tablas. La analítica seguirá entrando solo por RPC.

### 3. Contrato de la RPC

- Parámetros iniciales:
  - `p_period_code text default null`
  - `p_contract_code text default null`
  - `p_incentive_type_id uuid default null`
  - `p_status text default 'A'`
- Payload JSON de salida:
  - `summary_cards`
    - `total_amount`
    - `request_count`
    - `approved_count`
    - `rejected_count`
    - `approval_rate`
    - `rejection_rate`
  - `total_amount_by_period`
    - lista por `period_code` con `total_amount`, `request_count`, `approved_amount`, `rejected_amount`
  - `count_by_incentive_type`
    - lista por `incentive_type_id` / `incentive_type_name` con `request_count` y `total_amount`
  - `deviations_by_contract`
    - lista por contrato con `out_of_deadline_count`, `contract_mismatch_count`, `total_deviations`
  - `filter_options`
    - contratos e incentivos disponibles bajo el filtro actual para poblar selects sin otra query paralela

### 4. Frontend y hooks

- Extender [`queryKeys.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/lib/queryKeys.ts:1) con una rama `analytics`.
- Agregar en [`useIncentivesQueries.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/hooks/useIncentivesQueries.ts:1):
  - `useHrIncentivesAnalytics(filters)`
- Agregar en [`incentivesApi.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/services/incentivesApi.ts:1):
  - `fetchHrIncentivesAnalytics(filters)`
  - mapping tipado del JSON retornado por la RPC
- Crear componente nuevo:
  - `src/modules/incentives/components/IncentiveAnalyticsView.tsx`

### 5. Diseño de la vista

- Barra superior de filtros:
  - período
  - contrato
  - tipo de incentivo
  - estado
- KPIs superiores:
  - gasto total
  - solicitudes
  - tasa de aprobación
  - tasa de rechazo
- Gráficos:
  - línea/área: evolución del gasto por período
  - donut: distribución por tipo
  - barras apiladas: desviaciones por contrato (`Fuera de plazo` vs `Contrato distinto`)
- Estilo:
  - reutilizar clases visuales del sistema (`tracking-panel`, `tracking-kpi-card`, `info-card`)
  - sumar clases específicas en `incentives.css` sin introducir otro sistema visual

## Orden de ejecución

1. Crear tipos frontend para el payload analítico.
2. Implementar migración SQL con helper RBAC + RPC JSON agregada.
3. Extender API + query keys + hook React Query.
4. Construir `IncentiveAnalyticsView`.
5. Integrar pestaña `analisis` en `HumanResourcesDashboard`.
6. Ajustar navegación lateral para exponer la opción solo a roles permitidos.
7. Validar `npx tsc -b` y `git diff --check`.

## Riesgos y controles

- Riesgo: abrir la analítica a todo `recursos_humanos`.
  - Control: helper backend específico + gating frontend por roles.
- Riesgo: duplicar queries para poblar filtros.
  - Control: la RPC devuelve `filter_options` dentro del mismo payload.
- Riesgo: bundle inflado por ECharts.
  - Control: reutilizar el registro modular ya existente; no incorporar otro wrapper ni librería.
