# Privacidad Psych AI

## Datos excluidos del proveedor

- Nombre del candidato.
- RUN.
- Correo.
- Teléfono.
- Dirección.
- Respuestas crudas por ítem.
- Texto libre ajeno a resultados calculados.

## Payload permitido

- Referencia pública truncada de evaluación.
- Cargo y contrato como contexto laboral.
- Perfil de cargo versionado.
- Resultados estructurados ya calculados por el ERP.
- Calidad de respuesta calculada por el ERP.
- Hashes de resultado.
- Restricciones de uso: no decisión, no diagnóstico, no recalcular scores.

## Custodia

Las tablas IA viven en `private`, RLS habilitado y sin grants directos a `anon` ni `authenticated`. Las acciones interactivas pasan por RPCs que revalidan `user_can_access_psycholaboral`; el payload de proveedor solo lo obtiene `service_role`.

## Retención

La implementación conserva input saneado, salida original, revisión profesional, auditoría y runs. La política de retención final debe definirse antes de uso masivo con Psicología/Legal.
