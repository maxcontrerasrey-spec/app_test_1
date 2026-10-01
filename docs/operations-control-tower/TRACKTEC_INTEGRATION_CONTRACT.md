# Contrato de integración TrackTec — estado previo a documentación privada

## Estado

No se encontró en el repositorio documentación API, credenciales, endpoints, esquema webhook, autenticación, límites ni SDK de TrackTec GAS. Por tanto, este archivo define solamente el límite interno Atlas; no describe ni inventa el protocolo del proveedor. La integración real permanece deshabilitada.

## Contrato interno normalizado propuesto

El adaptador, al activarse con especificación oficial, deberá producir eventos validados con:

- `provider`: constante `tracktec`;
- `external_event_id`: identificador estable del proveedor si existe;
- `external_vehicle_id`: identificador del vehículo/dispositivo del proveedor;
- `observed_at`: instante con zona/huso interpretado según documentación TrackTec;
- `received_at`: hora UTC en que Atlas recibió el payload;
- `latitude`, `longitude`: coordenadas numéricas con rangos validados;
- `speed`, `heading`, `ignition`: opcionales solo si el proveedor los informa;
- `correlation_id`: identificador de ingesta Atlas;
- `payload_digest`: huella no reversible para deduplicación/auditoría; el raw completo no se conserva por defecto.

Atlas resolverá `external_vehicle_id` mediante un binding explícito a `atlas_ops_vehicles.id`. Sin binding único y activo, el evento queda en cuarentena y no automatiza hitos.

## Adaptadores

- `MockTelematicsProvider`: solo para pruebas/desarrollo; el esquema admite proveedor `mock` e ingesta idempotente protegida para superadmins. No hay UI de simulación ni adapter TrackTec real todavía.
- `TrackTecProvider`: se implementará después de recibir documentación oficial, confirmar autenticación, webhook/polling, rate limits, identificadores, timestamps y política de reintentos.

## Contrato de recepción Atlas preparado para producción

Atlas expone un receptor server-to-server por lote en `POST https://gestion.busesjm.cl/api/atlas/telemetry/ingest`. El contrato público normalizado para el proveedor/adapter es:

```json
{
  "events": [
    {
      "external_event_id": "identificador-estable-del-fix",
      "external_vehicle_id": "identificador-del-dispositivo-o-vehiculo",
      "observed_at": "2026-09-30T23:15:00-03:00",
      "latitude": -22.4544,
      "longitude": -68.9294,
      "speed_kph": 42.5,
      "heading_degrees": 180,
      "ignition": true,
      "odometer_km": 12345.6,
      "accuracy_m": 8,
      "event_type": "position"
    }
  ]
}
```

Cada llamada acepta hasta 1.000 posiciones (cuerpo máximo 2 MiB), exige `Authorization: Bearer <token>` y requiere timestamps ISO-8601 con zona horaria. El endpoint valida el lote, lo comprime y lo guarda en el bucket privado R2 con una clave determinista por contenido; después ejecuta la ingesta privilegiada de Supabase, detecta geocercas, actualiza la última posición por vehículo y elimina el punto temporal de Postgres tras completar el archivado. Repetir el mismo lote es seguro. Los eventos de geocerca conservan una instantánea del punto, aunque la fila GPS temporal se elimine.

La fuente nativa de TrackTec aún no está mapeada a este contrato. Antes de activar el envío, TrackTec debe confirmar que puede entregar lotes con IDs estables, identificador de vehículo, hora con zona, coordenadas y credencial en header; después se valida el mapeo con una unidad real. No se debe enviar `service_role` al proveedor. El token TrackTec y `SUPABASE_SERVICE_ROLE_KEY` son secretos distintos de uso server-side en Cloudflare Pages; `SUPABASE_URL` y `R2_BUCKET` reutilizan la configuración existente. Si falta cualquiera, el endpoint permanece deshabilitado y devuelve `503`.

La respuesta `202` confirma que el lote quedó archivado y procesado; `401` identifica credencial inválida, `400` un payload inválido y `503` una falla temporal para que el proveedor reintente. No se aceptan payloads crudos del proveedor, credenciales en el cuerpo ni acceso de lectura a los objetos R2 desde este endpoint.

## Seguridad y operación requeridas

Secretos solo server-side; verificación de firma/token según protocolo oficial; límites de tamaño/frecuencia; validación de timestamps/coordenadas; idempotencia; reintento con backoff; no exponer payloads/credenciales en logs; retención mínima acordada; métricas de latencia, errores y última sincronización.

## Checklist para activar TrackTec real

- [ ] Documentación técnica/contractual oficial vigente recibida.
- [ ] Método de autenticación y rotación aprobados.
- [ ] Semántica de identificadores de vehículo y evento confirmada.
- [ ] Huso horario, frecuencia, límites y retención confirmados.
- [ ] Binding de al menos un equipo contrastado físicamente.
- [ ] Prueba de no duplicación, posición e idempotencia.
- [ ] Secretos configurados en backend; health/alertas visibles.
- [ ] Prueba de geocerca real validada por Operaciones.

## Simulador

La futura suite deberá emitir secuencias determinísticas (posición/hito/repetición/reordenación), todas etiquetadas `mock`. En la implementación actual solo existe el contrato de persistencia e ingesta mock; la UI del simulador y el adaptador TypeScript quedan pendientes. Ningún evento mock constituye evidencia TrackTec real.
