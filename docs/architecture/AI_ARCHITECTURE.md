# Atlas — Arquitectura de IA

Status: ACTIVE
Document Type: ACTIVE_ARCHITECTURE
Owner: Engineering + Psicología
Version: 1.0.0
Effective Date: 2026-09-22
Last Reviewed: 2026-09-22
Next Review: 2026-10-22
Source of Truth: supabase/functions/_shared/psychAi y tablas private de Psych
Supersedes: PSYCH_AI_ARCHITECTURE.md y diseños V4/V5 no vigentes
Related Controls: AI Governance, PSYCH_AI_CONTRACT, privacy
Change Approval: Engineering + Psicología

## Pipeline vigente

Scoring determinístico → sanitización → FACTS compactos → homologaciones funcionales → Analyst → Structured Output → validación semántica → guardrails → reviewer patch-only cuando aplica → consistencia → persistencia → telemetría → revisión/informe.

## Runtime confirmado

- Pipeline: gpt56-luna-medium-v6.3.
- Modelo: gpt-5.6-luna.
- Prompt: psych-ai-prompt-v6.3.
- Schema: psych-ai-schema-v6.3.
- Metodología: psych-methodology-v6.3.

El provider se abstrae en código, con Mock/fallback y OpenAI disponibles según configuración. El modelo no recalcula scoring ni toma decisiones administrativas.
