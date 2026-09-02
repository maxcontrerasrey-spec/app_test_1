---
document_id: EEES-AUDIT-REPOSITORY-CLEANUP-INVENTORY
title: Repository Cleanup Inventory
version: 1.0.0
status: Activo
language: es-CL
owner: Engineering Governance
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Repository Cleanup Inventory

## REMOVE_CONFIRMED

| Candidato | Evidencia | Validacion |
| --- | --- | --- |
| `artifacts/EEES_ENTERPRISE_FINAL.zip` | ZIP versionado duplicaba 58 fuentes EEES ya versionadas; referencias eran historicas. | TypeScript, build, tests y Guardian PASS. |
| `react-is` | 0 imports/usos fuera de package/lock; `npm ls` lo mostraba solo como directo. | `npm uninstall`; tests y Guardian PASS. |
| `@tanstack/query-core` directo | 0 imports directos; sigue transitivo por `@tanstack/react-query`. | `npm uninstall`; tests y Guardian PASS. |
| `pdf-parse` | 0 imports/usos; Edge `orion-document-processor` usa `npm:unpdf`. | `npm uninstall`; tests y Guardian PASS. |
| `scripts/fix-migrations.mjs` | 0 consumidores; renombraba migraciones historicas con `fs.renameSync`, contrario a regla forward-only. | TypeScript, build, tests y Guardian PASS. |
| `scripts/test-bi-rpc.mjs` | 0 consumidores; probe ad hoc con service role e import roto a `scripts/lib/env.mjs`. | TypeScript, build, tests y Guardian PASS. |
| `scripts/provision-competency-instructors.mjs` | 0 consumidores; provisioning one-off ya cerrado en tasks, con datos personales embebidos. | TypeScript, build, tests y Guardian PASS. |
| `scripts/provision-hiring-approvers-from-cecos.mjs` | 0 consumidores; path absoluto a workbook local y flujo superseded por `provision-hiring-approvers`. | TypeScript, build, tests y Guardian PASS. |
| `scripts/validate-buk-token-access.mjs` | 0 consumidores; diagnostico manual no gobernado y reemplazable por smokes/audits BUK vivos. | TypeScript, build, tests y Guardian PASS. |
| `src/shared/services/catalogs.ts` | 0 consumidores; solo importaba CSV locales. | TypeScript, build, tests y Guardian PASS. |
| `src/shared/data/*.csv` | Consumidos solo por `catalogs.ts`; duplicaban `data/seed/sharepoint` para trabajadores, vehiculos e instructores. | TypeScript, build, tests y Guardian PASS. |
| `src/shared/ui/ModulePlaceholderPage.tsx` | 0 consumidores; no exportado por barrel vivo. | TypeScript, build, tests y Guardian PASS. |
| PNGs legacy en `public/assets` | 0 referencias exactas a `login-*` y `nav-*`; no rutas publicas ni CSS los usan. | Build y smoke frontend PASS. |
| PNGs legacy en `src/assets` | 0 referencias exactas a `certification-icon`, `recruiting-icon`, `status-*`, `operacion`, `recursos-humanos`. | Build y smoke frontend PASS. |
| `public/maps/chile.json` | El BI vigente reemplazó el mapa por barras y no existe `fetch`, import ni ruta runtime al asset; Vite lo copiaba completo a cada deploy. | Build, tests y Guardian 2026-08-27. |
| `public/app-logo.png` | Era idéntico byte a byte al asset importado `src/assets/app-logo.png`; el favicon ahora usa la fuente Vite y evita publicar dos copias. | HTML construido referencia el mismo asset hashado que la aplicación. |
| Runtime ORION | El único consumidor de `react-markdown`/`remark-gfm` era ORION; su provider se montaba globalmente y las dos Edge Functions eran exclusivas del módulo. | Se retiran ruta, navegación, UI, contexto, estilos, assets, dependencias, pruebas, configuración y Edge sources; la baja de tablas, RPC y bucket queda forward-only y aborta si Storage aún contiene archivos. |

## CONSOLIDATE

| Candidato | Clasificacion | Decision |
| --- | --- | --- |
| CSV locales vs `data/seed/sharepoint` | CONSOLIDATE cerrado | Se elimina copia runtime huérfana y se conserva seed historico. |
| Helpers repetidos de scripts | KEEP_UNCERTAIN | No se consolida en cleanup porque scripts activos tienen contratos operativos distintos; riesgo mayor que beneficio sin cambio funcional. |
| `ROLLBACK-PRODUCTIVO.md` vs `PRODUCTION-ROLLBACK.md` | KEEP_HISTORICAL | Se conservan ambos: uno es historico/indexado y otro es playbook P4/100 requerido. |

## KEEP_ACTIVE

- Tests `tests/unit`, `tests/contracts`, `vitest.config.ts`.
- Auditores Guardian, P3/P4/100, smokes, migrations, security, route/role y performance.
- Workflows GitHub activos con schedule/manual o guardrails enterprise.
- Baselines, Books, closure reports, certification, residual risk y lessons EEES.
- `docs/CODEX_OBJECTIVE_LOOP_EEES_100_PERCENT.md` porque es fuente de regla `REL-004`.
- `docs/CODEX_OBJECTIVE_LOOP_ENTERPRISE_REPOSITORY_CLEANUP.md` porque es fuente de regla `REL-005`.

## KEEP_PUBLIC_CONTRACT

- Re-exports de servicios modulares como `hiringControl.ts` y `competencyApi.ts`, aunque algunas fuentes reales se consuman por barrels.
- `src/vite-env.d.ts`, por declarar tipos globales Vite/assets/CSV.

## KEEP_RUNTIME_DYNAMIC

- `@pdf-lib/fontkit` y `unpdf`: usados directamente por Edge Functions mediante imports npm y locks Deno propios; no requieren dependencias duplicadas en el paquete frontend.
- `@vitest/coverage-v8`, `@vitejs/plugin-react`, Vite, Vitest, Playwright y vendors lazy, porque sostienen gates, build o imports dinamicos.

## KEEP_HISTORICAL

- `data/seed/sharepoint/*` como snapshots/seed historicos.
- P1/P2/P3/P4/100 closure reports, final implementation report y residual risk.
- Docs legales, smoke plan, architecture, permissions y rollback documentados.

## KEEP_UNCERTAIN

- Helpers duplicados entre scripts operativos. No son residuo confirmado porque cada script activo tiene entrada, secretos y validaciones distintas; consolidar sin necesidad funcional puede introducir riesgo.

## Pendientes confirmados

- `REMOVE_CONFIRMED` pendientes: 0.
- `CONSOLIDATE` pendientes dentro del alcance seguro: 0.

## Revision profunda 2026-08-04

### REMOVE_CONFIRMED cerrado

- Instalacion local corrupta: 16 carpetas `@types/* 2` y otras 184 carpetas `* 2`, todas vacias y no versionadas. Se respaldo la instalacion completa y se reconstruyo con `npm ci`; el conteo posterior es 0.
- Residuos regenerables ignorados: `dist/`, `coverage/`, ambos `*.tsbuildinfo`, `public/.DS_Store` y `supabase/.temp/`.
- Seis copias conflictivas locales no usadas por Git: `.git/index 2`, `.git/index 3` y `.git/info/refs 2..5`.
- Ocho APIs frontend sin consumidores y sus cadenas privadas de tipos, mappers y query keys.
- Duplicacion exacta de `splitFullName` y `normalizeLegacyMaritalStatus`, consolidada en un helper compartido de reclutamiento.
- PostCSS 8.5.18 vulnerable, actualizado por lockfile a 8.5.25 sin cambio mayor.

### KEEP verificado

- Los 94 documentos Markdown/EEES no tienen duplicados binarios y varios forman parte de contratos Guardian, seguridad, rollback o historia forward-only.
- La conservación duplicada previa de `public/app-logo.png` quedó superada el 2026-08-27: `index.html` procesa `src/assets/app-logo.png` mediante Vite y publica una sola copia hashada.
- `src/assets/fondo.png` conserva consumidor runtime. La clasificación anterior de `public/maps/chile.json` quedó superada por la verificación completa del árbol del 2026-08-27 y el asset fue retirado.
- `supabase/functions/check_buk_candidate` queda `KEEP_UNCERTAIN`: parece supersedida en el repositorio, pero no se retira sin confirmar consumidores y despliegue productivo.
- `data/seed/sharepoint/*.csv` queda `KEEP_HISTORICAL_REVIEW`: no tiene consumidor runtime y contiene datos personales historicos; requiere una purga de gobierno e historial Git separada para que una eliminacion sea efectiva.
