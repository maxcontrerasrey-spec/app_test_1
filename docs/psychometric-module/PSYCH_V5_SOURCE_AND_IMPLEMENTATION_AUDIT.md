# Auditoría V5 de fuentes, implementación y uso metodológico psicolaboral

Fecha: 2026-08-14  
Estado: implementación V5 productiva planificada  
Alcance: capa interpretativa IA, no scoring ni decisión de reclutamiento

## Principio operativo

El ERP calcula scores, calidad, hashes, estados y trazabilidad. GPT-5 mini interpreta únicamente facts pseudonimizados ya calculados. La IA no recalcula, no decide contratación, no diagnostica, no inventa baremos y no atribuye instrumentos libres a marcas propietarias.

## Matriz fuente → ERP

| Instrumento fuente | Instrumento ERP | Estado legal/metodológico | Scoring | Interpretación | Baremos | Uso IA V5 |
|---|---|---|---|---|---|---|
| 16PF propietario recibido como referencia funcional | Evaluación de Personalidad IPIP-16 / `IPIP16_105` | Reemplazo/adaptación interna basada en ítems IPIP de uso libre. No se presenta como 16PF. | Media 1-5 por 16 dimensiones calculada por backend. | Descriptiva por dimensión y clusters laborales internos: autorregulación, disciplina, interacción y adaptabilidad. | Sin baremos 16PF ni percentiles poblacionales. Solo rangos teóricos del ERP. | Interpretación activa, prudente, contextual al cargo; prohibido atribuir factores/baremos 16PF. |
| DISC/corrector propietario como necesidad funcional | Evaluación Interpersonal IPIP-IPC / `IPIP_IPC_32` | Reemplazo funcional con IPIP-IPC y macroestilos internos. No es DISC ni Everything DiSC. | Octantes, calidez/dominancia y macroestilos internos calculados por ERP. | Estilo relacional, influencia, cooperación, comunicación, iniciativa y presión. | Sin baremo DISC ni equivalencias propietarias. | Interpretación activa desde IPIP-IPC; mantener disclaimer discreto. |
| Barratt BIS-11 recibido para digitalización | `BARRATT_BIS11_30` | Instrumento implementado según material fuente del correo. | Puntaje total y clasificación documentada. | Contextual laboral; se conserva literal la intensidad documentada. | Solo clasificación implementada. | Integración activa con normas, cautela, estabilidad, PRP y cargo. Prohibido escalar `SOBRE_EL_PROMEDIO` a alto/crítico/severo. |
| PRP documento/corrector recibido por correo | `PRP_EMAIL_FORM_A_30` | Implementación del material recibido; requiere cautela en nombres de factores/baremos. | 30 ítems, dirección positiva/negativa, score total y factores técnicos F1-F6 calculados por backend. | Descriptiva del patrón preventivo y relación con seguridad laboral. | No se activan percentiles, eneatipos ni grupos normativos si no están explícitamente disponibles en payload. | Interpretación descriptiva habilitada. No inventar nombres de factores F1-F6 ni clasificaciones de riesgo no documentadas. |
| Consentimientos F-RH-061 y F-RH-062 | Consentimientos versionados del módulo | Evidencia de aceptación y hash documental versionado. | No aplica. | No aplica. | No aplica. | No enviar texto completo a OpenAI; solo usar evidencia backend de aceptación cuando corresponda. |

## Diferencias relevantes frente a V4

- V4 todavía forzaba una lectura por bloques de instrumento; V5 exige integración narrativa en un perfil laboral único.
- V4 mantenía PRP como bloqueo global `PROFESSIONAL_ONLY`; V5 permite interpretación descriptiva del score total y patrón preventivo, sin inventar nombres de factores ni baremos.
- V4 pedía evidencia visible (`evidence_ids`) en el output; V5 separa auditoría técnica de informe profesional. La evidencia queda en payload/logs, no en el texto del informe.
- V4 repetía limitaciones; V5 conserva una advertencia metodológica breve al cierre.

## Restricciones duras conservadas

- No APTO/NO APTO.
- No contratar/rechazar/descartar.
- No diagnóstico clínico.
- No PII ni respuestas crudas hacia OpenAI.
- No atribuir IPIP-16 a 16PF propietario.
- No atribuir IPIP-IPC a DISC/Everything DiSC.
- No escalar clasificación BIS-11.
- No inventar factores PRP, baremos, percentiles, eneatipos ni grupos normativos.

## Implementación elegida

Se implementa V5 en la capa interpretativa compartida:

- prompt Analyst/Reviewer V2 en Edge Function;
- `psych-ai-schema-v5` como Structured Output;
- payload enriquecido con `methodology.version = psych-methodology-v5`;
- normalización compatible con UI/PDF existentes;
- PDF interno reorganizado como Informe Psicolaboral Integrado.

No se crean tablas metodológicas nuevas en esta fase porque el repositorio ya cuenta con versiones de instrumentos, prompt, perfil de cargo, scoring y auditoría. Crear una taxonomía completa ahora aumentaría superficie de RLS/migraciones sin mejorar el canario inmediato. La metadata V5 queda versionada en código, documentación y prompt activo; si se requiere administración dinámica de metodología, debe implementarse como fase separada con permisos propios.
