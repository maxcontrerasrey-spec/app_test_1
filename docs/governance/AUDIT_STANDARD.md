# Atlas — Estándar de auditoría

Status: ACTIVE
Document Type: ACTIVE_POLICY
Owner: Engineering Governance
Version: 1.0.0
Effective Date: 2026-09-22
Last Reviewed: 2026-09-22
Next Review: 2026-10-22
Source of Truth: tablas de auditoría de dominio, triggers, RPCs y tests
Supersedes: afirmaciones de auditoría global no demostradas
Related Controls: logs de reclutamiento, movilidad, acreditación, seguridad y onboarding
Change Approval: Engineering Governance + dueño del dominio

## Cobertura actual

Atlas tiene auditoría federada por dominio: reclutamiento, solicitudes, movilidad interna, acreditación, seguridad y alta operacional. No existe todavía una tabla global única que cubra todos los módulos.

## Contrato para nuevos eventos

Los nuevos eventos deben procurar event_id, timestamp, actor_id, actor_type, domain, action, resource_type, resource_id, correlation_id, request_id, source, result, metadata, before_hash y after_hash, sin exponer secretos ni datos innecesarios.

## Reglas

El actor proviene de auth.uid() o de un contexto backend controlado. Los logs no son editables desde frontend. Las lecturas se someten a RLS/helpers. No se reescriben históricos para completar campos que no existían.

## Evolución

Mantener los logs de dominio actuales y agregar una envolvente transversal de forma incremental para nuevos eventos críticos, sin crear una migración global riesgosa como parte de esta normalización.
