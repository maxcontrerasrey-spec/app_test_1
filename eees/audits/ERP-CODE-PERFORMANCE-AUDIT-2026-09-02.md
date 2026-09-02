---
document_id: EEES-AUDIT-CODE-PERFORMANCE-2026-09-02
title: Auditoría actual de rendimiento y reducción de código
version: 1.0.0
status: Activo
language: es-CL
owner: Engineering
repository_scope: ERP completo
audit_date: 2026-09-02
baseline_date: 2026-09-02
---

# Auditoría actual de rendimiento y reducción de código

Esta revisión se rehízo desde el árbol vigente. Los informes anteriores se consideran únicamente contexto histórico.

## Línea base y resultado

| Medición | Línea base verificada | Resultado actual | Variación |
| --- | ---: | ---: | ---: |
| Archivos TS/TSX en `src` | 230 | 219 | -11 |
| Líneas TS/TSX en `src` | 49.672 | 47.962 | -1.710 |
| Build `dist` | 5.082.308 B | 3.301.984 B | -1.780.324 B |
| JavaScript generado | 2.754.896 B | 2.562.408 B | -192.488 B |
| Clones detectados por jscpd | 107 | 104 | -3 |
| Líneas duplicadas detectadas | 1.630 | 1.431 | -199 |
| Vulnerabilidades `npm audit --audit-level=high` | 0 | 0 | 0 |

La reducción principal proviene de retirar ORION y el asset de mapa sin consumidor. También se eliminaron dos dependencias Markdown exclusivas, se consolidó el reintento de chunks y se eliminó código muerto confirmado.

## Cambios aplicados

- ORION dejó de existir en el runtime frontend: provider global, widget, ruta, navegación, estilos, logo, permisos funcionales, lazy importer y prueba exclusiva.
- ORION dejó de existir en el runtime backend versionado: fuentes de las dos Edge Functions, configuración y checks dedicados.
- `deno.lock` y `package-lock.json` ya no incluyen `react-markdown` ni `remark-gfm`; `postcss` se conserva como dependencia transitiva de Vite.
- Los checks Deno usan `--node-modules-dir=none` para no contaminar `node_modules` con copias paralelas.
- Las suscripciones Realtime usan firma estable y refs para evitar desmontar/recrear canales por arrays inline en cada render.
- Se consolidó `lazyWithRetry`/`importWithRetry` en un único cargador.
- Se retiraron funciones, tipos y constantes sin consumidores demostrables.
- Se añadió una migración forward-only para bajar el refresco de la caché BI de cada minuto a cada 10 minutos, manteniendo la función y sus grants sin cambios.

## Verificación

- `npm ci --ignore-scripts` y `npm ls --depth=0`: instalación limpia, sin extraneous.
- Build frontend: PASS, 1.012 módulos.
- Unitarias: 24 archivos, 113 pruebas PASS.
- Contratos: 2 archivos, 6 pruebas PASS.
- Integridad: 10 archivos, 86 pruebas PASS.
- Concurrencia: 15 pruebas PASS.
- Idempotencia: 15 pruebas PASS.
- 13 Edge Functions: `deno check --no-config --node-modules-dir=none` PASS.
- Guardian full: 0 errores, 0 advertencias.
- Migraciones: 488 archivos canónicos, 0 duplicados.
- Seguridad Supabase: PASS; los avisos históricos permanecen sin relajarse.

## Cierre productivo

Las migraciones históricas ORION, el baseline de migraciones y las excepciones del auditor de seguridad se conservan para trazabilidad inmutable; no son código ejecutable.

En producción se descargó una copia recuperable del único documento y se eliminó el bucket `orion_knowledge` mediante Storage API. Luego se aplicó la migración forward-only, se retiraron las tablas, RPC, políticas, módulo y permisos ORION, y se eliminaron las Edge Functions `orion-chat` y `orion-document-processor`. La verificación remota confirmó ausencia de todos esos objetos. El frontend actualizado queda listo para publicación automática al subir `main`.
