# Auditoria general post-separacion documental BUK

Fecha: 2026-09-24
Alcance: generacion BUK de candidatos, Solicitud de Contratacion, cola de documentos aprobados, reintentos, permisos, concurrencia y continuidad operativa.

## Resultado ejecutivo

La arquitectura queda operable para produccion despues de corregir cuatro debilidades detectadas en la revision posterior al primer despliegue y en la simulacion runtime:

1. La RPC de encolado tenia una referencia incorrecta a la columna `v_source_document_id` y usaba el parametro de salida `source_document_id` como valor. La migracion podia desplegarse, pero el primer encolado documental podia fallar en runtime. Se corrigio con migraciones forward-only `20260924133000` y `20260924143000`.
2. La cola dependia del navegador para continuar. Se agrego un worker de GitHub Actions cada cinco minutos, con ejecucion no solapable y limite de tres documentos por invocacion.
3. Una respuesta `2xx` sin `id` ni `url` remota podia marcar un documento como exitoso y purgar el archivo local. Ahora se exige evidencia remota y, si falta, el documento queda para conciliacion.
4. La primera ejecucion real de la RPC de encolado revelo una ambiguedad de PostgreSQL entre el parametro de salida `source_document_id` y el `ON CONFLICT` por columnas. Se corrigio con `20260924151000`, usando la restriccion unica por nombre y verificando el cuerpo vivo de la funcion.

## Controles verificados

- La Solicitud de Contratacion y los adjuntos tienen checkpoints independientes.
- La clave unica `(buk_sync_job_id, source_document_id)` evita duplicados.
- `claim_buk_candidate_document_jobs` usa lock de control, `FOR UPDATE SKIP LOCKED`, recuperacion de `processing` envejecido y maximo global de 3.
- La cola y sus RPC no son ejecutables por `anon` ni `authenticated`; solo `service_role` tiene ejecucion.
- Los reintentos posteriores a una respuesta ambigua concilian primero contra BUK.
- Los estados `failed` y `reconciliation_required` usan `next_attempt_at` con backoff exponencial de 5 minutos, 10 minutos y hasta 1 hora, evitando martillar BUK ante errores persistentes.
- El frontend mantiene estados diferenciados para Solicitud confirmada, documentos pendientes, conciliacion requerida y fallos terminales.
- El worker programado no muta directamente la base: invoca la Edge Function autorizada con `service_role` y conserva los checkpoints existentes.

## Evidencia productiva

- Migraciones `20260924110000`, `20260924133000`, `20260924143000`, `20260924150000` y `20260924151000` aplicadas y sincronizadas.
- `sync-buk-candidates` redeployada despues de incorporar la validacion de metadata remota.
- Definicion viva de `enqueue_buk_candidate_document_jobs` confirmada con `source_document_id` como columna de salida, `v_source_document_id` como valor, guard de tipo JSON y `ON CONFLICT ON CONSTRAINT` para evitar ambiguedad PL/pgSQL.
- Privilegios vivos: `anon = false`, `authenticated = false`, `service_role = true`.
- La cola productiva no tenia filas pendientes, en procesamiento, fallidas ni en conciliacion al momento de la revision.
- La simulacion runtime invoco la RPC contra el job productivo `9fbb10b0-e854-45ed-a930-5dff80c57bcd` con 16 documentos y un payload JSON no-array; devolvio `16/16` en ambos casos y se revirtio deliberadamente mediante una excepcion controlada. La cola continuo en cero y el job permanecio `success`.
- No se ejecutaron cargas BUK ni se modificaron candidatos durante la auditoria.

## Validacion tecnica

- `npm run test:integrity`: 94 pruebas aprobadas.
- `npm run test:concurrency`: 16 pruebas aprobadas.
- `npm run test:idempotency`: 18 pruebas aprobadas.
- `npm run check:edge:sync-buk-candidates`: aprobado.
- `npm run build:frontend-check`: aprobado.
- `npm run audit:migrations`: aprobado; la migracion runtime de la cola quedo incluida en el canon.
- `npm run audit:supabase-security`: 87 advertencias historicas preexistentes del repositorio; no corresponden a las tablas/RPC nuevas de esta implementacion.

## Riesgos residuales controlados

- La continuidad automatica depende de que el workflow de GitHub Actions permanezca habilitado y conserve sus variables `VITE_SUPABASE_URL` o equivalente y `SUPABASE_SERVICE_ROLE_KEY`.
- Los rechazos funcionales de BUK permanecen visibles como `failed` y no se reintentan infinitamente; requieren correccion de datos o accion operativa.
- Una respuesta remota ambigua queda en `reconciliation_required` y no se purga Storage hasta confirmar el documento en BUK.
