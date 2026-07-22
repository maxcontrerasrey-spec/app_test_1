---
document_id: EEES-CHANGELOG
title: Changelog EEES
version: 1.0.0
status: Activo
language: es-CL
owner: Engineering Governance
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Control de cambios

## 1.5.0 - 2026-07-22

- Se certifica CORE Data Integrity con 15 flujos, 37 invariantes y 16 gaps P1 internos cerrados.
- Se agregan idempotencia para contratación e incentivos, serialización de jornadas e inmutabilidad de snapshots BUK.
- Se cierran mutaciones directas que evitaban RPCs canónicos y se activan constraints de metadata terminal.
- Se agregan checkpoints documentales, timeout BUK, stale recovery y job durable de acreditación.
- Guardian y CI incorporan auditoría y suites CORE de integridad, concurrencia e idempotencia.
- El baseline de bundle queda normalizado al artefacto de CI con configuracion publica de despliegue inyectada.

## 1.4.0 - 2026-07-22

- Se ejecuta Enterprise Repository Cleanup post EEES 100 sin alterar comportamiento funcional.
- Se eliminan residuos confirmados: artifact ZIP duplicado, scripts ad hoc/one-off, assets PNG sin consumidores, CSV runtime duplicados y dependencias directas unused.
- Se agrega `eees/baselines/REPOSITORY-CLEANUP-BASELINE_v1.md`, inventario y reporte de cierre.
- Guardian incorpora `audit:repository-cleanup` y regla `REL-005`.

## 1.3.0 - 2026-07-22

- Se ejecuta el cierre EEES Enterprise 100% desde `docs/CODEX_OBJECTIVE_LOOP_EEES_100_PERCENT.md`.
- Se agregan baselines finales de production readiness, SRE/SLI/SLO y capacity.
- Se agregan auditorias finales de DR, failure modes, security hardening, database hardening y residual risk.
- Se agrega `eees/certification/ENTERPRISE-CERTIFICATION-FINAL.md`.
- Guardian incorpora `audit:enterprise-100-readiness` y CI ejecuta `guardian:full`, unit, contracts, coverage, build y `git diff --check`.

## 1.2.0 - 2026-07-22

- Se ejecuta EEES P4 para performance baseline, observabilidad, concurrencia/idempotencia y release engineering.
- Se agrega `eees/baselines/PERFORMANCE_BASELINE_v1.md` y `eees/baselines/OBSERVABILITY-BASELINE.md`.
- Se formaliza `eees/playbooks/PRODUCTION-ROLLBACK.md` y se fortalece `eees/playbooks/FAILED-MIGRATION.md`.
- Guardian incorpora auditorias P4 de performance baseline y readiness operacional.

## 1.1.0 - 2026-07-22

- Se ejecuta EEES P3 para testing automatizado, contract tests, query key governance y matriz anti-regresion.
- Se agrega baseline medido `eees/baselines/TESTING_BASELINE_v1.md`.
- Se agrega `eees/audits/REGRESSION-COVERAGE-MATRIX.md` y reporte de cierre P3.
- Guardian incorpora controles P3 para query keys inline, logica pura critica sin tests, artefactos P3 y excepciones sin expiracion.

## 1.0.0 - 2026-07-22

- Construccion inicial de EEES desde evidencia real del repositorio.
- Se crea estructura foundation, baselines, books, guardian, certification, playbooks, knowledge y codex.
- Se agrega `npm run guardian` con validaciones EEES, reglas, metadata, referencias, deuda de complejidad y gates existentes.
- Se registra modelo de certificacion y politica anti-regresion.
