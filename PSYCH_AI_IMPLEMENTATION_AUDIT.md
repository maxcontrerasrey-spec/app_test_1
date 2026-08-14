# Auditoría de implementación IA psicolaboral

Fecha: 2026-08-13  
Alcance: integración incremental OpenAI `gpt-5-mini` para interpretación descriptiva.

## Resumen ejecutivo

El módulo psicolaboral ya calcula de forma determinística IPIP-16/105, IPIP-IPC/32, Barratt BIS-11 y PRP. También conserva respuestas, hashes, calidad básica, consentimientos versionados, roles, RLS, Storage privado y generación de certificados/informes. No se debe reconstruir ese flujo.

La brecha está en una capa interpretativa separada: no existe proveedor abstracto, payload pseudonimizado, schema estricto, guardrail posterior, cache por hash, perfiles de cargo versionados ni revisión profesional separada de la salida automática.

## Estado actual confirmado

| Área | Estado | Evidencia |
| --- | --- | --- |
| Scoring | Implementado y privado | `private.score_psychometric_instrument`, resultados por instrumento |
| Calidad | Implementada en `quality-v1` | `private.psychometric_response_quality` |
| IPIP-IPC | Octantes, calidez, dominancia y macroestilos internos | `private.psycholaboral_ipc_profile` |
| PRP | Puntaje y factores numéricos; interpretación normativa pendiente | `norm_status = pending_professional_review` |
| Certificado/informe | PDF privado, certificado + informe integrado | `generate-psycholaboral-certificate` |
| Autorización | Módulo independiente para `admin` y `reclutamiento` | `user_can_access_psycholaboral` |
| Datos sensibles | Tablas privadas, Storage no público, URLs firmadas | migraciones psicolaborales vigentes |
| IA | No existe | sin proveedor, tablas ni Edge Function |
| Perfiles por cargo | No existe versión parametrizada | el cargo solo llega como texto del caso |
| Revisión profesional | No existe separación `ai_original` / revisión | el informe actual no tiene workflow de revisión |

## Riesgos que deben permanecer bloqueados

1. La IA no puede recalcular scores, crear percentiles, inventar baremos ni modificar respuestas.
2. No se enviará nombre, RUN, email, teléfono, dirección ni respuestas crudas a OpenAI.
3. PRP no expondrá factores sin significado documentado.
4. La IA no podrá emitir `APTO`, `NO APTO`, `CONTRATAR`, `NO CONTRATAR`, diagnóstico ni rechazo.
5. Un fallo, timeout, rate limit o ausencia de `OPENAI_API_KEY` debe producir informe determinístico, no bloquear el proceso.
6. La salida IA será un borrador `AI_DRAFT`, nunca un informe profesional validado.
7. El informe completo seguirá restringido a los roles autorizados y no será accesible al candidato.

## Cambios propuestos

### Backend/Supabase

- Añadir perfiles de cargo versionados para `CONDUCCION`, `SUPERVISION`, `MANTENIMIENTO`, `HSEC`, `ADMINISTRACION` y `LIDERAZGO`, como hipótesis configurables y no como baremos.
- Añadir tablas privadas `psych_ai_interpretations`, `psych_ai_runs` y `psych_prompt_versions` con RLS, sin grants directos a `anon`/`authenticated`.
- Añadir estado IA al assessment y RPCs de lectura, generación piloto, revisión, observación y validación.
- Persistir `input_hash`, payload saneado, salida original, salida validada, proveedor, modelo, prompt/schema/profile versions y métricas de ejecución.
- Mantener idempotencia por assessment + hash de entrada; no llamar nuevamente a OpenAI si existe una interpretación válida.

### Edge Functions

- Crear proveedor abstracto `PsychInterpretationProvider`.
- Implementar `OpenAIPsychInterpretationProvider` contra `https://api.openai.com/v1/chat/completions`, con `gpt-5-mini`, sin streaming ni tools y JSON Schema estricto.
- Implementar `MockPsychInterpretationProvider` para CI.
- Aplicar sanitización, validación de schema, límites de longitud y guardrails de contenido.
- Dejar fallback determinístico cuando la IA no esté disponible.

### Informe y frontend

- Separar en el PDF los datos observados, interpretación automática, evidencia y revisión profesional.
- Incorporar interpretación laboral de IPIP-16, IPIP-IPC, BIS-11 y PRP solo cuando corresponda.
- Añadir fortalezas, aspectos a profundizar, preguntas de entrevista, conclusión descriptiva y limitaciones.
- Añadir botón piloto `Generar interpretación IA`, estado de ejecución y revisión profesional sin sobrescribir `ai_original`.

## Orden incremental y rollback

1. Migración de tablas, perfiles y RPCs: rollback eliminando solo tablas/funciones nuevas; no toca scoring.
2. Prompt versionado, schema y proveedores Mock/OpenAI: rollback desactivando `PSYCH_AI_ENABLED`.
3. Edge Function de interpretación: rollback retirando la función; el generador usa fallback determinístico.
4. Integración PDF/frontend: rollback ocultando las acciones IA y conservando el informe numérico actual.
5. Piloto manual con evaluaciones ya completadas, sin generación automática masiva.

## Configuración requerida

```text
OPENAI_API_KEY               # secreto únicamente en Supabase Edge
PSYCH_AI_PROVIDER=openai
PSYCH_AI_MODEL=gpt-5-mini
PSYCH_AI_ENABLED=false       # se activa después del piloto controlado
PSYCH_AI_PROMPT_VERSION=psych-v1
PSYCH_AI_SCHEMA_VERSION=1
```

La implementación puede desplegarse con la IA apagada. No se debe activar producción hasta configurar el secreto y revisar una muestra profesional.

## Criterios de aceptación

- Scoring y hashes antes/después son idénticos.
- Payload saliente no contiene PII ni respuestas crudas.
- OpenAI no se invoca cuando no hay API key, feature flag apagado o cache válido.
- Falla de OpenAI deja fallback determinístico revisable y no bloquea el proceso.
- Salida inválida o prohibida nunca llega al PDF como interpretación validada.
- Ningún texto automático contiene diagnóstico, percentil inventado o decisión de contratación.
- El profesional puede observar/editar/validar sin perder la salida original.
- Tests unitarios, contractuales, seguridad, PDF, build, Guardian y smoke Supabase pasan.

## Decisión de implementación

Se implementará primero la base auditable y el piloto manual. La generación automática para todos los candidatos queda explícitamente fuera hasta cumplir el criterio Go/No-Go del prompt maestro.

## Estado de implementación

Implementación iniciada en Fase 2 el 2026-08-13:

- Migración `20260814005242_psych_ai_interpretation_foundation.sql`.
- Proveedores `MockPsychInterpretationProvider` y `OpenAIPsychInterpretationProvider`.
- Sanitización de payload, schema estricto, guardrails y fallback determinístico.
- UI de generación y revisión profesional.
- Informe interno PDF de 4 páginas con IA/fallback.

La activación real de OpenAI queda pendiente de configurar `OPENAI_API_KEY` y cambiar `PSYCH_AI_ENABLED=true`.
