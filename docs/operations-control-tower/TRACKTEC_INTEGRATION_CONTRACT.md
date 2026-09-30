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
