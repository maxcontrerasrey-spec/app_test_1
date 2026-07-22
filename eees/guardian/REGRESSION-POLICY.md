---
document_id: EEES-GUARDIAN-REGRESSION
title: Regression Policy
version: 1.0.0
status: Activo
language: es-CL
owner: QA
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Politica anti-regresion

## Regla central

Un bug critico no se considera cerrado hasta que exista, cuando sea tecnicamente viable, un mecanismo automatico capaz de detectar su reaparicion.

## Mecanismos aceptados

- Unit test.
- Integration test.
- E2E o smoke Playwright.
- SQL audit.
- Guardian rule.
- Script de auditoria.
- Lesson en `tasks/lessons.md` cuando la automatizacion inmediata no sea viable.

## Excepciones

Si el mecanismo automatico requiere credenciales o datos no disponibles, se registra el bloqueo y se crea una prueba parcial o auditoria estatica equivalente.
