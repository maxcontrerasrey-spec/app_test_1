---
document_id: EEES-CERT-CORE-DATA-INTEGRITY
title: Core Data Integrity Certification
version: 1.0.0
status: Activo
language: es-CL
owner: Engineering Governance
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Core Data Integrity Certification

## Dictamen

CORE DATA INTEGRITY: CERTIFIED WITH EXTERNAL DEPENDENCIES.

## Base de certificación

- 15 flujos críticos mapeados.
- 37 invariantes verificadas sin enforcement exclusivo de UI.
- 16 gaps P1 internos cerrados; 0 P0 y 0 P1 internos abiertos.
- Migración forward-only aplicada y versionada.
- Reataque remoto sobre estado, grants, RLS, funciones, jobs y anomalías.
- Suites dedicadas de integridad, concurrencia e idempotencia integradas en CI y Guardian.

## Alcance externo

La certificación no afirma atomicidad distribuida con BUK, Storage ni proveedores de correo. Afirma que el ERP conserva estado durable, replay seguro, trazabilidad y recuperación interna frente a esos límites. La disponibilidad y los IDs omitidos por proveedores son dependencias externas reales.
