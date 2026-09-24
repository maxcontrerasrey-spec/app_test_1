# Atlas — Política de protección de datos

Status: ACTIVE
Document Type: ACTIVE_POLICY
Owner: Data Governance + Security
Version: 1.0.0
Effective Date: 2026-09-22
Last Reviewed: 2026-09-22
Next Review: 2026-10-22
Source of Truth: esquema, RLS, Storage, contratos de integración y logs de dominio
Supersedes: afirmaciones generales no respaldadas por controles verificables
Related Controls: privacidad Psych, audit standard, incident response
Change Approval: Data Governance + Legal/Compliance

## Principios

Atlas debe aplicar finalidad, minimización, acceso limitado, exactitud, retención definida, trazabilidad y protección reforzada para datos sensibles. Las solicitudes de acceso, rectificación, supresión, oposición, portabilidad y bloqueo deben diseñarse según el caso y la base jurídica aplicable.

## Estado técnico

El repositorio demuestra separación de datos sensibles Psych, RLS, Storage privado y auditoría por dominio. No demuestra una tabla de auditoría global ni que toda lectura y escritura quede auditada. La política no promete controles ausentes.

## Integraciones y proveedores

BUK es fuente de verdad de trabajadores donde el contrato operativo vigente así lo define; caches y snapshots son derivados y trazables. Los proveedores externos deben recibir el mínimo necesario, con finalidad, retención, transferencia y encargado documentados.

## Chile y aprobación legal

La transición regulatoria chilena debe reflejarse en base jurídica, derechos, datos sensibles, transferencias, incidentes, eliminación y anonimización. Este documento es un control técnico de preparación y no una interpretación jurídica definitiva; requiere revisión Legal/Compliance antes de uso normativo externo o cambios de tratamiento.
