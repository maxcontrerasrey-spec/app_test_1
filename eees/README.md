---
document_id: EEES-README
title: Indice operativo EEES
version: 1.0.0
status: Activo
language: es-CL
owner: Engineering Governance
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# EEES

EEES es la norma tecnica ejecutable del ERP. La fuente operativa sigue siendo el codigo, SQL, scripts, CI y documentacion viva del repositorio; EEES clasifica esa evidencia y define el estandar que debe gobernar cambios futuros.

## Carpetas

- `foundation/`: principios estables, ADN ERP, gobierno y glosario.
- `baselines/`: fotografia auditada de arquitectura, seguridad, base de datos y calidad.
- `books/`: reglas normativas por disciplina.
- `guardian/`: reglas machine-readable, politica anti-regresion y validador ejecutable.
- `certification/`: modelo de certificacion y checklists.
- `playbooks/`: respuesta operacional ante incidentes reales del ERP.
- `knowledge/`: ADRs y conocimiento de decisiones.
- `codex/`: secuencia obligatoria para agentes.
- `audits/`: auditorias de implementacion, consistencia, complejidad y reportes finales.

## Comando canonico

```bash
npm run guardian
```

## Autoridad documental

- EEES define norma y gates.
- `docs/` describe arquitectura/operacion vigente.
- `tasks/` conserva ejecucion viva, resultados y lecciones.
