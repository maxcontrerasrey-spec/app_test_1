# Atlas — Contrato conceptual AI Gateway

Status: ACTIVE
Document Type: ACTIVE_CONTRACT
Owner: Engineering Governance
Version: 1.0.0
Effective Date: 2026-09-22
Last Reviewed: 2026-09-22
Next Review: 2026-10-22
Source of Truth: contrato conceptual; implementación vigente en cada provider
Supersedes: acoplamiento normativo a un único proveedor
Related Controls: AI_GOVERNANCE, PSYCH_AI_CONTRACT, privacy
Change Approval: Engineering + dueño del dominio

El contrato de gateway debe poder representar provider, model, model_version, prompt_version, schema_version, methodology_version, pipeline_version, request_id, correlation_id, input_hash, output_hash, latency_ms, input_tokens, output_tokens, reasoning_tokens, cost, status y fallback_reason.

Este contrato no afirma que todos los campos existan hoy en todas las tablas o providers. Los campos faltantes se agregan de manera compatible y trazable; no se hacen migraciones destructivas ni se cambia el provider productivo como parte de la documentación.
