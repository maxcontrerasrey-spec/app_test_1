# Auditoría de timeouts en generación BUK

Fecha: 2026-09-24
Alcance: `sync-buk-candidates`, Solicitud de Contratación, documentos aprobados del candidato y carga a BUK.

## Conclusión ejecutiva

El cuello de botella no está en la generación del PDF de Solicitud de Contratación. Está en el proceso síncrono completo que realiza una sola Edge Function:

1. prepara y verifica la ficha BUK;
2. crea o actualiza plan y trabajo;
3. genera y carga la Solicitud de Contratación;
4. descarga y carga todos los documentos aprobados, uno por uno;
5. elimina los archivos locales y cierra el job.

La Solicitud queda correctamente checkpointed antes de continuar con los adjuntos, pero la pantalla recibe el resultado global del job. Por eso un timeout de un documento posterior puede parecer un fallo de la Solicitud, aunque la Solicitud ya esté en BUK.

La solución sostenible requiere separar la provisión de la ficha BUK y la carga documental en trabajos idempotentes independientes. No se recomienda resolverlo solamente aumentando el timeout ni limitar artificialmente la cantidad de contrataciones del negocio.

## Evidencia productiva

- Solicitudes de Contratación: 109 registros exitosos y 0 errores persistentes al momento de la auditoría.
- Duración de carga BUK de la Solicitud: promedio 1,36 s; p50 1,33 s; p95 2,27 s; máximo 5,10 s.
- Jobs BUK recientes: 36 exitosos, 25 con error y 1 en procesamiento durante la primera lectura; el job en procesamiento terminó exitosamente al volver a consultar.
- Duración total de jobs exitosos: promedio 80,20 s en los últimos 30 días; existen ejecuciones de 166,61 s, 178,22 s y 192,68 s.
- Con 16 documentos aprobados, el promedio histórico es 165,00 s, p95 192,10 s y máximo 1.617,49 s.
- Se registró un timeout explícito de carga BUK el 2026-09-21. Ese job conservó un checkpoint de Solicitud exitoso (`SC-2026-000107`) y el error ocurrió después durante la carga documental.
- Los demás errores recientes no son timeouts: mapping BUK inexistente, cargo no habilitado, reserva de ficha no conciliada y ficha bancaria incompleta.

## Causas técnicas

### 1. Trabajo síncrono de duración variable

La interfaz envía todos los candidatos seleccionados a `sync-buk-candidates`. La función acepta hasta 50 jobs y los procesa en un `for` secuencial. Una sola respuesta HTTP queda abierta durante toda la operación.

### 2. Documentos aprobados en serie

`processDocuments` descarga y carga cada archivo con `await` dentro de un `for`. Cada carga tiene un timeout de 30 segundos; si BUK responde con ciertos códigos, se ejecuta además un segundo transporte Base64. Con 16 archivos, una degradación moderada del proveedor escala linealmente y puede superar el presupuesto de la Edge Function.

### 3. Timeouts incompletos en llamadas BUK

La carga documental tiene `AbortController`, pero `fetchBukJson` no impone un timeout general por defecto. Varias lecturas y escrituras BUK pueden quedar esperando hasta que expire la Edge Function o la conexión externa.

### 4. Error global engañoso

El job queda en `error` si falla un adjunto posterior, aunque el checkpoint de la Solicitud ya sea `success`. El resultado es correcto para auditoría, pero insuficientemente expresivo para la operación.

### 5. Concurrencia no controlada a nivel de proveedor

El ERP protege el mismo candidato con un índice único de jobs activos y usa claims, pero no existe un límite explícito de concurrencia global para llamadas documentales a BUK. Varios candidatos seleccionados pueden generar ráfagas simultáneas desde distintas invocaciones.

## Qué no explica el problema

- El tamaño del PDF de Solicitud no es la causa observada.
- No hay evidencia de una falla sistemática de generación PDF.
- No corresponde aumentar indiscriminadamente el timeout ni reintentar automáticamente cargas ambiguas: BUK puede haber aceptado el archivo aunque la respuesta no haya llegado.

## Recomendación aprobable

### Corrección inmediata de bajo riesgo

- Mantener la Solicitud y cada adjunto con checkpoint idempotente.
- Incorporar timeout explícito a todas las llamadas BUK de lectura y escritura.
- Registrar duración por etapa (`preflight`, `employee`, `plan`, `job`, `hiring_document`, `candidate_documents`, `finalization`).
- Mostrar en la UI el estado separado: “Solicitud cargada; quedan documentos pendientes”, en vez de reportar un fallo genérico.
- Invocar como máximo un candidato por ejecución interactiva mientras se implementa la cola documental.

### Corrección estructural

Separar en dos procesos:

1. `provision-buk-employee`: ficha, plan, trabajo y Solicitud de Contratación. Cierra cuando la Solicitud tiene checkpoint BUK confirmado.
2. `upload-buk-candidate-documents`: cola independiente por documento, con claim por documento, conciliación antes de reintentar y concurrencia limitada de 2 a 3 cargas por worker.

La contratación no debe bloquearse por la carga de todos los adjuntos, pero el estado contractual debe conservar un indicador auditable de documentación pendiente o fallida.

## Decisión

El problema es solucionable desde código, pero no con un único ajuste de timeout. Se requiere desacoplar la carga documental y limitar la concurrencia contra BUK. La limitación debe aplicarse a las llamadas al proveedor, no a la cantidad de personas que la empresa puede contratar.

No se modificaron datos productivos durante esta auditoría.
