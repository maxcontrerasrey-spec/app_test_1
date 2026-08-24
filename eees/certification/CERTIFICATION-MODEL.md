---
document_id: EEES-CERT-MODEL
title: Certification Model
version: 2.0.0
status: Activo
language: es-CL
owner: QA
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Modelo de certificacion

## Formula

Puntaje = Arquitectura 20 + Seguridad 25 + Database 20 + Calidad 15 + Operabilidad 10 + Documentacion 10.

## Gates bloqueantes

Una puntuacion alta no compensa:

- Vulnerabilidad critica.
- Corrupcion potencial de datos.
- Migracion invalida.
- Autorizacion rota.
- Build roto.
- Regresion critica conocida sin guardrail.

## Evidencia aceptada

Comandos ejecutados, logs de CI, auditorias SQL, smokes, tests, reportes EEES y lessons.

## Vigencia

El estado vigente se calcula con `npm run eees:certify` y queda asociado al SHA en `.eees/evidence/certification.json` dentro del artefacto de CI. Los estados son:

- `CERTIFIED`: todos los gates pasan, sin riesgo aceptado vigente.
- `CERTIFIED_WITH_ACCEPTED_RISK`: gates pasan y existen excepciones vigentes gobernadas.
- `STALE`: la evidencia no representa `HEAD`, excede su ventana o cambio el estandar.
- `NOT_CERTIFIED`: existe al menos un gate bloqueante fallido.

Un documento historico nunca reemplaza esta evidencia.
