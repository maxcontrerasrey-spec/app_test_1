# Guía Piloto Psych AI

## Precondiciones

- Módulo `gestion_psicolaboral` activo.
- Evaluación psicolaboral completada.
- `PSYCH_AI_ENABLED=false` para primer piloto Mock/fallback.
- Sin envío masivo automático.

## Flujo piloto

1. Abrir `/gestion-psicolaboral`.
2. Expandir un candidato con estado `Terminado`.
3. Ejecutar `Generar IA`.
4. Abrir `Revisar IA`.
5. Comparar salida original IA contra resultados y entrevista.
6. Guardar revisión, observar o validar.
7. Ejecutar `Actualizar informe` para regenerar PDF interno.
8. Descargar informe y revisar visualmente sus 4 páginas.

## Go/No-Go

Go solo si Psicología valida que el texto es prudente, no decisorio, no clínico y útil para entrevista. No activar generación automática hasta cerrar piloto.
