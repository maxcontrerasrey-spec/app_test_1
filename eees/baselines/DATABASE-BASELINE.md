---
document_id: EEES-BASELINE-DB
title: Database Baseline
version: 1.0.0
status: Activo
language: es-CL
owner: Database
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Database Baseline

## Inventario medido

- Migraciones SQL: 347.
- Edge Functions con `index.ts`: 11.
- Baseline de migraciones: `supabase/migration-baseline.json`.
- Auditoria historica: `supabase/MIGRATIONS_AUDIT.md`.

## Fortalezas

- Migraciones canonicas recientes con baseline para deuda legacy.
- RLS habilitado en dominios criticos.
- RPCs para operaciones transaccionales y controles de permisos.
- Backfills versionados para reparaciones operativas.

## Riesgos

- Historial grande con colisiones/formatos legacy congelados.
- Logica de negocio pesada en SQL dificulta revision manual.
- Cambios de grants pueden afectar varios modulos.

## Score inicial

74/100. Metodo: baseline de migraciones y auditorias existentes pesan alto; se penaliza complejidad historica y dependencia de auditoria manual para RPCs grandes.
