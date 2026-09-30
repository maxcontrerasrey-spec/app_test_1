# Matriz de referencia funcional Fleetbase

Esta matriz captura conceptos de dominio/UX descritos por el requerimiento. No incluye código Fleetbase ni traducción mecánica de sus frameworks.

| Concepto Fleetbase | Necesidad Atlas | Implementación Atlas propuesta | Reutilización conceptual | Riesgo de licencia |
|---|---|---|---|---|
| Orders / operaciones | Programar ocurrencias fechadas | Nuevo agregado de dispatch enlazado a plantillas Atlas vacías y `contracts` | Sí: ciclo de vida explícito y asignaciones | Bajo si diseño/código independiente |
| Fleet assignment | Selección y disponibilidad de vehículo | Padrón nuevo `atlas_ops_vehicles`, inicialmente vacío; validar en backend | Sí: asociación temporal y conflicto | Bajo |
| Driver assignment | Conductor elegible por fecha | Reutilizar búsqueda BUK/roster y persistir ID BUK exacto | Sí: identidad separada del usuario de Atlas | Bajo |
| Scheduler / workbench | Planificar y despachar por fecha/contrato | Vista nativa dentro de Operaciones | Sí: densidad operativa y filtros | Bajo |
| Navigator | Recibir y confirmar el servicio | PWA React Atlas una vez resuelta identidad autenticada | Sí: vista móvil y acciones mínimas | Bajo |
| Activity / status events | Timeline auditable | Eventos append-only en Supabase Atlas | Sí: actor/source y correlación | Bajo |
| Tracking | Posición vehicular | Gateway provider-neutral y adapter TrackTec documentado | Sí: normalización e idempotencia | Bajo |
| Geofencing | Entrada/salida y hitos | Reglas geométricas propias sobre telemetría validada | Sí: antijitter y evidencia | Bajo |

No se incorporaron dependencias, fragmentos de código ni assets Fleetbase. Antes de cualquier reutilización literal futura, revisar licencia comercial/AGPL con autorización y análisis legal apropiado.
