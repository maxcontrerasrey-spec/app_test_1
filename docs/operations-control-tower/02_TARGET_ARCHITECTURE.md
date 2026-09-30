# Arquitectura objetivo — Atlas Operations Control

## Principios

- Un solo ERP Atlas, Supabase y sistema de roles.
- Contratos, BUK, roster, Auth y roles siguen siendo fuentes compartidas.
- `atlas_ops_*` reemplaza las tablas/datos del módulo Operaciones previo y parte sin datos heredados.
- Toda transición crítica ocurre en RPC transaccional que valida `auth.uid()`, `profiles.is_super_admin`, contrato activo y estado previo.
- La salida inicial limita navegación, rutas, RPC y RLS a superadministradores activos. L1/L2 y las acciones de conductor permanecen cerrados hasta una fase posterior autorizada; los RPC de conductor rechazan perfiles normales.
- El plan es la versión congelada del servicio; cambios posteriores generan eventos, no reescriben el significado histórico.

## Componentes propuestos

1. Catálogo/planificador: usa contratos compartidos y plantillas Atlas configurables, crea ocurrencias fechadas y snapshots explícitos.
2. Validador: determina conductor activo/jornada con BUK+roster y equipo activo; comunica datos no disponibles como “sin verificar”, nunca como válidos.
3. Dispatch: máquina de estados de planificación y ejecución separadas; publicación solo para recursos y hitos requeridos validados.
4. Hitos/eventos: agenda congelada por versión; eventos inmutables con source, actor, timestamps y correlación.
5. Control Tower: consulta agregada, filtros, semáforo determinístico y drill-down de timeline; proyectado separado de vencido real.
6. Driver surface: PWA responsiva bajo autenticación Atlas, habilitada solo al confirmar una identidad BUK vinculada.
7. Telematics Gateway: interfaz provider-neutral, adaptador mock, normalización y deduplicación antes de TrackTec.

## Estados y reglas

- Planificación: `draft -> planning -> ready -> published`; cancelación/suspensión solo con reglas explícitas.
- Ejecución: `not_started -> in_progress -> completed`; fallida o suspendida cuando una acción respaldada lo determina.
- Riesgo: derivado `green | attention | at_risk | critical`, nunca escrito como estado manual del viaje.
- Un hito solo vence si `now >= critical_at` y no existe evento válido; antes del umbral es proyección/atención según regla.
- Correcciones manuales no borran eventos GPS/TrackTec; conservan ambos y registran actor/motivo.

## Despliegue por fases

Fase 0 documenta el estado. La primera salida productiva deja el contrato de dominio y persistencia vacía con acceso solo superadmin. Fases posteriores podrán habilitar control coordinador y conductor cuando se autoricen sus ámbitos de acceso; las acciones del conductor exigirán binding individual verificado. Otras fases incorporan gateway mock, geocercas, reglas y alertas. La IA queda fuera de este despliegue. La integración TrackTec real sigue desactivada hasta recibir documentación oficial. Las migraciones fueron aplicadas en Supabase producción el 2026-09-30.

## Alcance que requiere completar antes de operación productiva

- La primera entrega deja persistencia, RPC y Control Tower accesibles solo a superadministradores; no configura jobs/cron para el refresco SLA ni escalamiento por roles.
- El gateway tiene contratos internos y persistencia de telemetría mock; faltan el adapter TypeScript ejecutable, UI de simulación, endpoints de posición histórica y adapter real TrackTec.
- La geocerca circular aplica radio, histéresis y debounce, pero necesita prueba runtime con datos representativos antes de habilitar ingesta productiva.
- No se implementa mapa ni IA operacional en esta fase. No se afirma ETA proyectado: el semáforo actual representa reglas determinísticas vencidas/próximas.
- No se implementan capacidad, licencias/acreditaciones ni estado mecánico del vehículo porque los contratos canónicos disponibles no exponen una fuente verificada para esas validaciones.
- Las posiciones raw propuestas no tienen tarea de retención automatizada todavía; definir período y job antes de activar flujo real.
