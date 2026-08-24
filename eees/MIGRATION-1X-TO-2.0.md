---
document_id: EEES-MIGRATION-2
title: Migracion EEES 1.x a 2.0
version: 2.0.0
status: Activo
language: es-CL
owner: Engineering Governance
repository_scope: ERP completo
baseline_date: 2026-08-24
---

# Migracion EEES 1.x a 2.0

## Compatibilidad

No se renombraron ni reutilizaron IDs 1.x. `rules.json`, `guardian` y los comandos anteriores conservan su interfaz. La certificacion final 1.x queda como evidencia historica.

## Reglas nuevas

- Gobierno: `GOV-001` a `GOV-004`.
- Seguridad: `SEC-005` a `SEC-007`.
- Supply chain: `SUP-001` a `SUP-006`.
- Contratos y resiliencia: `API-002`, `RES-001`, `OBS-008`.
- Database y calidad: `DB-005`, `TST-007`, `PERF-003`.
- Ingenieria: `ENG-001`, `ENG-002`.

## Gates nuevos

Ejecutar `npm run audit:eees-governance`, `audit:secrets`, `audit:dependencies`, `audit:ci-supply-chain` y `audit:destructive-migrations`. `npm run eees:certify` produce evidencia ligada al SHA; `npm run eees:sbom` genera el inventario CycloneDX.

## Excepciones

Las excepciones antiguas deben declarar ID, owner, riesgo, creacion, expiracion y criterio de salida. Una excepcion vencida deja de ser valida y bloquea gobernanza.

## Certificacion

No usar `ENTERPRISE-CERTIFICATION-FINAL.md` para afirmar salud vigente. Consultar `certification.json` del artefacto `eees-evidence-<sha>` de CI.
