---
document_id: EEES-FOUNDATION-03
title: Governance
version: 1.0.0
status: Activo
language: es-CL
owner: Engineering Governance
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Governance

## Autoridad

EEES gobierna estandares. `docs/` describe el sistema. `tasks/` registra ejecucion y lecciones. El codigo y SQL son evidencia, pero no toda evidencia es norma.

## Ciclo obligatorio

1. Leer `tasks/todo.md` y `tasks/lessons.md`.
2. Inspeccionar contratos vivos antes de editar.
3. Registrar plan verificable para trabajo no trivial.
4. Ejecutar gates aplicables.
5. Actualizar lecciones cuando un error de usuario revele patron repetible.
6. Commit/push solo con diff coherente y validado.

## Excepciones

Una excepcion debe registrar alcance, riesgo, fecha, owner, gate afectado, compensacion y condicion de salida en `eees/audits/exceptions/`.
