---
document_id: EEES-CODEX-BOOT
title: Codex Boot Sequence
version: 1.0.0
status: Activo
language: es-CL
owner: Engineering Governance
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Codex Boot Sequence

## Lectura obligatoria

1. `tasks/todo.md`
2. `tasks/lessons.md`
3. `eees/INDEX.md`
4. Books aplicables al dominio modificado.
5. `docs/architecture.md`, `docs/module-map.md`, `docs/permissions-matrix.md` si hay rutas, modulos o permisos.
6. Migraciones/RPC/Edge Functions vivas si hay Supabase.

## Trabajo no trivial

- Registrar plan verificable en `tasks/todo.md`.
- Inspeccionar contratos reales antes de editar.
- Mantener cambios acotados.
- Agregar lesson si una correccion del usuario revela patron repetible.

## Gates minimos

- `npm run guardian` para cambios enterprise.
- `npm run build:frontend-check` para frontend.
- `npm run audit:migrations` y `npm run audit:supabase-security` para SQL.
- `git diff --check` siempre antes de cerrar.

## Criterio de cierre

No cerrar sin resultado, validaciones ejecutadas o blocker clasificado con evidencia.
