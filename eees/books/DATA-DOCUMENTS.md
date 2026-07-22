---
document_id: EEES-BOOK-DATA
title: Data Governance and Documents Book
version: 1.0.0
status: Activo
language: es-CL
owner: Engineering
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Data Governance and Documents Book

## Proposito

Definir reglas normativas para data governance and documents book del ERP, derivadas de evidencia real del repositorio.

## Evidencia del repositorio

- `src/app/router/AppRouter.tsx`
- `src/modules/*`
- `src/shared/*`
- `supabase/migrations/*`
- `supabase/functions/*`
- `scripts/*`
- `.github/workflows/*`

## Reglas obligatorias

- **DATA-001. Datos personales minimizados.** Snapshots publicos deben exponer solo campos necesarios.
- **DOC-001. Documentos privados por defecto.** Buckets de documentos operativos deben ser privados salvo validacion publica acotada.
- **DOC-002. BUK como custodia final.** Documentos generados que terminan en BUK deben conservar metadata y purgar storage cuando aplique.
- **API-001. Contratos de datos versionables.** Payloads consumidos por frontend y Edge Functions deben mapearse y validarse.

## Quality Gates

- `npm run guardian`
- `npm run build:frontend-check`
- `git diff --check`

## Gestion de excepciones

Las excepciones se registran en `eees/audits/exceptions/` con owner, fecha, regla afectada, riesgo y condicion de salida.
