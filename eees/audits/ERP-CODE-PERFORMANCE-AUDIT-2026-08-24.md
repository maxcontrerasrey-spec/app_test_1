---
document_id: EEES-AUDIT-ERP-CODE-PERFORMANCE-2026-08-24
title: Auditoria integral ERP de codigo y rendimiento
version: 1.0.0
status: Activo
language: es-CL
owner: Engineering
repository_scope: ERP completo
baseline_date: 2026-08-24
---

# Auditoría integral ERP — código, versionado y rendimiento

Fecha: 2026-08-24
Alcance: frontend React/Vite, servicios, pruebas, funciones Supabase, PostgreSQL/RLS, migraciones, dependencias y respuesta pública de producción.

## Dictamen ejecutivo

El ERP queda funcional y con mejoras productivas verificables, pero no corresponde declarar que todas las rutas son “ultra rápidas” sin una matriz autenticada por rol y datos Web Vitals de usuarios reales. Los gates disponibles pasan 215 pruebas, build productivo, smoke público/protegido, auditoría de migraciones y baseline de artefactos. La matriz autenticada sigue sin ejecutarse porque no existen credenciales de prueba seguras configuradas.

Los dos cuellos de botella de mayor impacto comprobado fueron corregidos:

- Login: el fondo de 5.257.091 bytes fue reemplazado por WebP de 65.132 bytes (-98,8%). En medición local equivalente, la transferencia inicial bajó de 5.630.430 a 428.732 bytes (-92,4%) y FCP de 274 ms a 123 ms.
- Sincronización BUK de jornadas: se reemplazó el RPC por trabajador/día por un RPC set-based de hasta 1.000 registros por lote. La función productiva acepta solo `service_role`; una prueba transaccional de 100 filas tomó 947,73 ms y fue revertida.

## Evidencia de funcionamiento

- Unitarias: 23 archivos, 102 pruebas, todas aprobadas.
- Contratos: 2 archivos, 6 pruebas, todas aprobadas.
- Integridad: 10 archivos, 84 pruebas, todas aprobadas.
- Concurrencia: 2 archivos, 8 pruebas, todas aprobadas.
- Idempotencia: 2 archivos, 15 pruebas, todas aprobadas.
- Total: 39 archivos, 215 pruebas.
- TypeScript y Vite: aprobados; build en aproximadamente 11 segundos.
- Smoke: `/login` y `/verificar/documento` responden; una ruta protegida redirige a `/login` sin sesión.
- Dependencias: `npm audit` informa 0 vulnerabilidades en 279 dependencias.

## Rendimiento frontend

Medición pública previa en producción, cinco muestras por ruta:

| Ruta | HTTP | TTFB observado |
|---|---:|---:|
| `/` | 200 | 56–116 ms |
| `/login` | 200 | 56–116 ms |
| `/roster` | 200 | 56–116 ms |
| `/bi/dotacion` | 200 | 56–116 ms |
| `/gestion-psicolaboral` | 200 | 56–116 ms |

El build corregido pesa hasta 5.081.661 bytes en CI (5.080.346 bytes en el entorno local). Los paquetes pesados (`xlsx` y `echarts`) permanecen separados por lazy loading; no se mezclaron con el chunk inicial. El baseline usa el resultado mayor medido para impedir regresiones sin depender de diferencias de entorno.

## Base de datos y Supabase

- Historial remoto/local: cuatro timestamps divergentes fueron reconciliados y reaplicados desde sus migraciones locales equivalentes. El `db push --dry-run` final indica `upToDate: true`.
- RLS: se optimizaron 22 políticas para evaluar `auth.uid()` una sola vez por sentencia. Verificación productiva: 0 políticas pendientes con ese patrón.
- Funciones: seis funciones recibieron `search_path` explícito.
- Índices: se retiraron dos duplicados exactos, conservando sus equivalentes semánticamente más claros o más usados.
- Jornadas: se desplegó `sync_hr_roster_exceptions_from_buk_batch(jsonb)` con límite de 5.000 filas, procesamiento set-based y ejecución exclusiva de `service_role`.
- Capacidad: base de 109 MB, tablas 16 MB, índices 17 MB y cache hit reportado 1,00.

## Código eliminado y simplificado

Se retiraron hooks, fetchers, query keys y tipos BI que quedaron obsoletos después de consolidar el dashboard en `get_bi_dotacion_dashboard`. La limpieza elimina rutas de consulta duplicadas y evita mantener dos contratos para la misma información. Las pruebas de integridad verifican que esos accesos individuales no reaparezcan.

El historial de etapas del candidato se separó como componente dedicado; el sidebar principal bajó de 812 a 779 líneas y el Guardian dejó de reportar el umbral de complejidad.

No se eliminaron los entrypoints de Edge Functions ni `postcss` aunque una herramienta estática los marque como no usados: son puntos de entrada de despliegue y componentes del pipeline, no código muerto demostrable.

## Versionado y dependencias

- Node requerido: `>=22.22`; el entorno de validación cumple.
- Supabase CLI usada: 2.115.0.
- No se aplicaron actualizaciones mayores de Vite/TypeScript durante esta auditoría. No hay vulnerabilidad que las justifique y mezclarlas con cambios operacionales ampliaría innecesariamente el riesgo.
- Debe vigilarse cualquier integración propia con Management API: `logs.all` deja de estar disponible el 2026-09-23.

## Deuda y límites que permanecen

1. La matriz E2E autenticada por los 16 escenarios de rol no pudo ejecutarse sin credenciales seguras de prueba. Es el principal vacío para afirmar latencia y permisos de cada módulo.
2. El linter PostgreSQL mantiene 18 observaciones de volatilidad, conversiones y variables no utilizadas. Requieren cambios individuales con pruebas semánticas; no son fallas de ejecución demostradas.
3. Los asesores reportan 295 observaciones de seguridad: 21 tablas deliberadamente cerradas sin políticas, 2 extensiones en `public`, 4 RPC anónimos del flujo público DSAL y 268 RPC `SECURITY DEFINER` autenticados. La cantidad no equivale a 295 vulnerabilidades; exige revisión contractual RPC por RPC y no revocación masiva.
4. Rendimiento reporta 169 observaciones: 59 FK sin índice, 102 índices sin uso desde el último reset de estadísticas, 7 políticas permisivas múltiples y 1 configuración de conexiones Auth. No se crean/eliminan índices solo por el asesor: deben cruzarse con volumen, plan y frecuencia real.
5. La sincronización histórica singular acumuló aproximadamente 170 mil llamadas y 7,9 segundos promedio por llamada. El lote nuevo elimina el patrón futuro, pero su tiempo real debe seguirse en las siguientes ejecuciones programadas.

## Criterio de cierre

La auditoría corrige los hallazgos críticos y altos respaldados por medición, mantiene cambios forward-only y deja explícito lo que requiere instrumentación o credenciales. El siguiente nivel de madurez es incorporar Web Vitals/RUM por módulo y una cuenta de prueba por perfil para convertir la exigencia “ultra rápido” en SLO verificables de p50/p95/p99.
