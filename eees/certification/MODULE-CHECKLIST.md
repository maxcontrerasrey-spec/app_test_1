---
document_id: EEES-CERT-MODULE
title: Module Checklist
version: 1.0.0
status: Activo
language: es-CL
owner: QA
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Module Checklist

- [ ] Modulo registrado en `AppModuleCode`.
- [ ] Ruta protegida por `RoleProtectedRoute` o `AdminProtectedRoute`.
- [ ] Navegacion alineada con permisos.
- [ ] `app_modules` y `role_module_access` revisados.
- [ ] Hooks y servicios de dominio separados.
- [ ] RPCs con RLS/grants.
- [ ] Estados loading/error/empty definidos.
- [ ] Smoke o auditoria agregada cuando el flujo sea critico.
