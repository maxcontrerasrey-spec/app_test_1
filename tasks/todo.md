# Tareas y Roadmap de Desarrollo

> **REGLA FUNDACIONAL (Lección 56):** Antes de proponer, planificar o ejecutar cualquier cambio sobre este repositorio, se debe leer `tasks/todo.md` y `tasks/lessons.md` completos. Esta es la primera acción obligatoria de cada sesión de trabajo, sin excepción.

## Corrección estructural del widget de clima para ubicación real

- [x] Auditar el flujo actual del widget y confirmar por qué seguía degradando a Santiago o quedando sin ciudad válida
- [x] Reescribir la degradación de ubicación para eliminar el fallback fijo engañoso y endurecer la resolución de ciudad
- [x] Validar build, registrar resultado y capturar la lección nueva

## Resultado de corrección estructural del widget de clima para ubicación real

- La regresión ya no estaba en `getCurrentPosition(...)` solamente. El mayor problema era de contrato: el widget seguía considerando a `Santiago, CL` como fallback “válido”, por lo que cualquier timeout o error menor terminaba mostrando una ubicación falsa como si fuera real.
- [`src/modules/dashboard/components/DashboardInfoCards.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/components/DashboardInfoCards.tsx:36) dejó de usar coordenadas fijas para fallback. Ahora el estado degradado es realmente `Ubicación no disponible`, sin latitud/longitud inventadas; si no hay geolocalización real, el clima no se calcula con una ciudad falsa.
- La resolución de nombre de ciudad quedó endurecida con dos proveedores secuenciales de reverse geocoding. Primero intenta `BigDataCloud` y, si no entrega ciudad usable, reintenta con `Nominatim` antes de caer al label por coordenadas.
- La aproximación por red mediante `ipwho.is` ahora queda marcada correctamente como fallback (`isFallback = true`) y visible como `Aproximada por red (...)`, en vez de mezclarse con ubicación exacta.
- También se amplió la tolerancia del navegador: el intento preciso subió a `20s` y el intento relajado a `30s`, con caché más amplia, para evitar degradaciones prematuras en Safari y navegadores más lentos con permisos.
- En UI, cuando la ubicación siga aproximada o no resuelta, el card expone `Reintentar ubicación exacta` para disparar un nuevo intento explícito sin refrescar toda la app.
- La validación técnica cerró con `npm run build` y `git diff --check`.

## Corrección integral de clima, cierre de folios y warning BUK por RUT

- [x] Confirmar la causa raíz de la geolocalización degradada y endurecer el widget para que no caiga prematuramente a Santiago
- [x] Mantener visibles los candidatos descartados de folios cerrados dentro de `Control de candidatos`
- [x] Corregir el cierre del resumen/pipeline de candidato para que no se reabra solo y cierre al hacer click afuera
- [x] Reemplazar la verificación frágil contra Edge Function por una validación backend contra la sync BUK, incluyendo fecha de salida cuando exista
- [x] Validar build, documentar resultados en `todo` y capturar lección nueva en `lessons`

## Resultado de corrección integral de clima, cierre de folios y warning BUK por RUT

- La persistencia del panel de candidato no estaba en `HiringCandidatesView`, sino en la auto-selección del primer candidato desde [`src/modules/recruitment/pages/HiringStatusPage.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/pages/HiringStatusPage.tsx:113). Esa lógica fue recortada para que un cierre manual no vuelva a abrir solo el pipeline.
- Además del ajuste anterior, [`src/modules/recruitment/components/HiringCandidatesView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/HiringCandidatesView.tsx:65) ahora cierra el resumen al hacer click fuera del layout completo, no solo sobre un hueco exacto del grid.
- Los candidatos descartados de folios cerrados desaparecían por backend: `get_recruitment_control_dashboard_v2()` filtraba `rc.status not in ('filled', 'closed_unfilled', 'cancelled')` y por eso expulsaba también descartados históricos. La migración [`20260608_235500_fix_candidate_visibility_and_buk_rut_lookup.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260608_235500_fix_candidate_visibility_and_buk_rut_lookup.sql:1) mantiene visibles en `candidate_control` los candidatos `rejected/withdrawn` de casos `cancelled` cuyo folio quedó `closed`.
- El warning por RUT en BUK dejó de depender de una Edge Function opaca al repo. Ahora el frontend usa la RPC `find_buk_employee_status_by_rut(...)`, soportada por la sync local `public.employees`, con salida de estado, nombre y fecha de salida cuando la data existe en `raw_payload`.
- La verificación de BUK quedó respaldada con datos reales de producción: la sync contiene `1586` activos y `3607` inactivos, y hay registros inactivos con fechas derivables desde `active_until` / `current_job.end_date`, lo que habilita mostrar salida histórica en la advertencia.
- En clima, la regresión venía de aceptar lecturas de navegador demasiado permisivas o antiguas y degradar rápido a fallback. [`src/modules/dashboard/components/DashboardInfoCards.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/components/DashboardInfoCards.tsx:315) volvió a un flujo secuencial verificable: intento preciso sin caché, luego intento tolerante, y solo después fallback.
- La migración fue aplicada directamente en Supabase productivo con nombre `fix_candidate_visibility_and_buk_rut_lookup`.
- La validación técnica cerró con `npm run build`, arranque local de Vite en `127.0.0.1:5173` y respuesta `HTTP/1.1 200 OK` del servidor local.

## Corrección definitiva de ciclo de geolocalización del widget de clima

- [x] Aislar por qué el widget seguía colgándose en `Resolviendo ubicación...` o degradando a Santiago bajo `gestion.busesjm.cl`
- [x] Reescribir el ciclo del widget para evitar auto-reintentos provocados por el mismo `statusLabel`
- [x] Validar build y dejar la corrección documentada

## Resultado de corrección definitiva de ciclo de geolocalización del widget de clima

- La nueva causa raíz no era Cloudflare ni reverse geocoding. El propio `useEffect` del widget dependía de `location.statusLabel`, `location.isResolved` y `location.isFallback`, pero dentro del mismo flujo hacía `setLocation(... statusLabel: "Resolviendo ubicación...")`. Eso disparaba otra vez el efecto y abría ciclos de geolocalización solapados.
- El widget quedó reestructurado en [`src/modules/dashboard/components/DashboardInfoCards.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/components/DashboardInfoCards.tsx:328): ahora inicializa desde caché si existe, mantiene refs para evitar requests concurrentes, consulta permisos cuando el navegador lo soporta y ejecuta un solo ciclo de resolución por intento.
- También se endureció la degradación: primero intenta alta precisión sin caché, luego un intento tolerante, y solo después usa fallback por red o el fallback fijo. Si ya existe última ubicación válida, la conserva como respaldo en vez de reiniciar el estado de forma agresiva.
- Se verificó además que el origen `https://gestion.busesjm.cl` no está enviando `Permissions-Policy` que bloquee geolocalización; por lo tanto el problema corregido era interno del widget.
- La validación cerró con `npm run build`.

## Corrección de pantallas en blanco al cambiar de módulo

- [x] Revisar router, guards y estrategia de carga de páginas para aislar por qué la app quedaba completamente en blanco
- [x] Implementar una defensa estructural para fallos de `lazy import` y excepciones de render de módulos
- [x] Validar build y dejar la corrección lista para deploy

## Resultado de corrección de pantallas en blanco al cambiar de módulo

- El problema más probable no estaba en `ProtectedRoute` ni en `RoleProtectedRoute`: ambos muestran loading o redirect, pero no devuelven una pantalla vacía. El punto débil estaba en el router con `React.lazy(...)` puro y sin `ErrorBoundary` global.
- Cuando un módulo lazy falla al cargar en producción, por ejemplo por `chunk` desactualizado después de un deploy o por excepción al montar una vista, React derriba el árbol si no existe un boundary de recuperación. Eso explica el síntoma de “todo en blanco hasta refrescar”.
- Se agregó el helper [`src/shared/lib/lazyWithRetry.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/lib/lazyWithRetry.ts:1), que detecta errores típicos de chunks dinámicos y fuerza una sola recarga controlada antes de propagar el error.
- Se incorporó además [`src/shared/ui/AppErrorBoundary.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/ui/AppErrorBoundary.tsx:1) como boundary global en [`src/main.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/main.tsx:1), con acciones explícitas de `Recargar app` e `Ir al inicio` en vez de dejar la SPA muerta.
- Finalmente, [`src/app/router/AppRouter.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/app/router/AppRouter.tsx:1) dejó de usar `lazy(...)` directo y ahora carga todas las páginas de ruta mediante `lazyWithRetry(...)`.
- La validación cerró con `npm run build`.

## Limpieza profunda de repo y compactación de arquitectura base

- [x] Auditar archivos sueltos, hotspots del repo y referencias rígidas al dominio antiguo
- [x] Eliminar scripts/test ad-hoc sin valor productivo en la raíz del proyecto
- [x] Compactar contratos repetidos de runtime y caché en módulos operativos activos
- [x] Validar build, documentar limpieza y dejar `main` listo para deploy

## Resultado de limpieza profunda de repo y compactación de arquitectura base

- Se limpió la raíz del repo eliminando la batería de archivos ad-hoc de prueba/debug que no pertenecían a la arquitectura del ERP. Salieron `check_maria.mjs`, `run_test.mjs`, `test_0008.*`, `test_approvers.mjs`, `test_dashboard_rpc.mjs`, `test_fetch_rpc.mjs`, `test_function_def.mjs`, `test_get_dashboard_tasks*`, `test_get_detail.mjs`, `test_maria_rpc.mjs`, `test_profiles.mjs`, `test_rls.mjs`, `test_tasks_rpc*` y también el archivo trackeado [`test_db.mjs`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/test_db.mjs:1), que era un stub incompleto sin uso real.
- Se centralizó la resolución de la URL pública de la app en [`src/shared/config/runtime.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/config/runtime.ts:1), eliminando lógica dispersa de host en auth. `AuthContext` ahora construye redirects como `/reset-password` desde una única fuente y el ejemplo de entorno ya apunta al subdominio real [`gestion.busesjm.cl`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/.env.example:4).
- Se compactó la invalidación de caché en módulos operativos activos: reclutamiento ahora reutiliza `invalidateRecruitmentControlQueries(...)` desde [`src/modules/recruitment/hooks/useRecruitmentQueries.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/hooks/useRecruitmentQueries.ts:86) e incentivos reutiliza `invalidateHrIncentiveQueries(...)` desde [`src/modules/incentives/hooks/useIncentivesQueries.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/hooks/useIncentivesQueries.ts:104). Con esto se eliminó duplicación entre vistas, mutaciones y realtime invalidation.
- También quedó normalizada la raíz de query keys para incentivos en [`src/shared/lib/queryKeys.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/lib/queryKeys.ts:10), evitando arrays literales repetidos como `['incentives', 'requests']` en varios componentes.
- La limpieza cerró con `npm run build` y `git diff --check`.

## Reparación del dashboard de Control de Contrataciones tras regresión SQL

- [x] Revisar `tasks/lessons.md`, migraciones recientes y logs productivos para aislar la causa raíz de los errores en `folios` y `control de candidatos`
- [x] Restaurar el contrato real de `get_recruitment_control_dashboard_v2()` y eliminar referencias a columnas inexistentes
- [x] Corregir el orden local de migraciones para evitar replay roto en entornos nuevos
- [x] Aplicar la corrección en Supabase productivo, validar el RPC autenticado y compilar frontend

## Resultado de reparación del dashboard de Control de Contrataciones tras regresión SQL

- La causa raíz no estaba en React sino en SQL: `public.get_recruitment_control_dashboard_v2()` había quedado con dos regresiones simultáneas. Primero, referenciaba `rcc.is_contracted`, columna que no existe en `public.recruitment_case_candidates`. Segundo, al “normalizar” claves a snake_case se redujo el payload y se rompió el contrato que consumen `Control de candidatos`, `Personal a Contratar` y `Resumen de procesos de contratación`.
- En repo quedó restaurada la versión final del RPC en [`supabase/migrations/20260608_181000_fix_dashboard_snake_case_keys.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260608_181000_fix_dashboard_snake_case_keys.sql:1), manteniendo claves snake_case pero devolviendo nuevamente todos los campos que espera el frontend (`recruitment_case_id`, `folio`, `contract_name`, `owner_name`, conteos, locks contractuales, etc.).
- Se corrigió además una deriva de historial local: había dos archivos con timestamp `20260608_180000`. El de dashboard quedó renombrado a [`supabase/migrations/20260608_180100_fix_dashboard_closed_cases.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260608_180100_fix_dashboard_closed_cases.sql:1) y convertido en no-op controlado para no reintroducir un estado intermedio inválido.
- Para reparar el estado vivo sin depender del replay completo de migraciones locales, se agregó además [`supabase/migrations/20260608_191500_repair_recruitment_control_dashboard_payload.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260608_191500_repair_recruitment_control_dashboard_payload.sql:1) y se aplicó en Supabase productivo mediante el conector.
- La verificación remota autenticada volvió a responder correctamente el tablero: `pending_approvals_count = 1`, `active_cases_count = 3`, `candidate_control_count = 5`, `personnel_to_hire_count = 0`, sin error SQL.
- La validación local cerró con `npm run build` y `git diff --check`.

## Corrección de advisors Supabase sobre reclutamiento y permisos

- [x] Fijar `search_path` mutable y limpiar grants expuestos solo en helpers internos no usados por frontend
- [x] Reescribir policies RLS activas de reclutamiento/solicitudes/documentos para usar `(select auth.uid())` y eliminar duplicidad de `hiring_request_approvals`
- [x] Eliminar duplicados seguros de índices/constraints detectados por advisors sin tocar piezas inciertas de producción
- [ ] Aplicar migración en Supabase, reconsultar advisors, validar `build` y documentar resultado

## Resultado parcial de corrección de advisors Supabase sobre reclutamiento y permisos

- Quedó creada en repo la migración [`supabase/migrations/20260608_180000_fix_advisors_rls_and_helper_exposure.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260608_180000_fix_advisors_rls_and_helper_exposure.sql:1), enfocada solo en cambios seguros: `search_path`, RLS `initplan`, `drop policy` redundante, revocación de helpers no expuestos por UI y limpieza puntual de duplicados claros.
- La migración reescribe las policies activas que hoy impactan reclutamiento, solicitudes, Who, documentos y `employees` para usar `(select auth.uid())`, que es exactamente la recomendación del advisor de performance.
- También deja listo el saneamiento de duplicados remotos más evidentes: `hiring_request_approvals_select_app`, `idx_hiring_request_approvals_approver_status`, `idx_recruitment_case_candidates_profile` y la constraint legacy `recruitment_case_candidates_recruitment_case_id_candidate_p_key`.
- La validación local cerró correctamente con `npm run build` y `git diff --check`.
- La única parte pendiente no es del SQL sino del entorno: la ejecución remota vía conector Supabase fue rechazada por límite de uso del propio conector, por lo que la migración aún no quedó aplicada en la base ni fue posible reconsultar advisors post-cambio desde esta sesión.

## Corrección de bloqueo del widget de clima

- [x] Reemplazar el flujo secuencial de geolocalización por una estrategia que entregue ubicación rápida sin quedarse colgada
- [x] Evitar que el fallback a Santiago se dispare antes de agotar una lectura rápida y una refinada
- [x] Validar build y documentar la corrección

## Ajuste de aprobación Who sin hallazgos

- [x] Revisar el flujo actual `Lead -> Who` para identificar dónde nace la aprobación pendiente
- [x] Permitir que un candidato sin hallazgos avance por Who sin crear tarea pendiente de autorización
- [x] Ajustar la UI para explicar el comportamiento sin hallazgos, validar build y documentar el resultado

## Sincronización de usuarios, roles y módulos desde matriz Excel

- [x] Normalizar la matriz `usuarios_busesjm.xlsx` a códigos canónicos de rol y módulos vigentes en la app
- [x] Sincronizar roles, capacidades, módulos visibles y perfiles en Supabase preservando a Maximiliano como `admin` total
- [x] Crear en Auth las cuentas faltantes con clave inicial controlada sin alterar claves existentes
- [x] Verificar resultado real en base, compilar frontend y documentar el cierre

## Análisis de enlace contable entre contratos/cecos y BUK

- [x] Inspeccionar `bbdd-cecos.xlsx`, identificar la nueva columna `Proyecto BUK` y medir cobertura/calidad del dato
- [x] Contrastar la matriz con `public.contracts` y con los campos de proyecto/área presentes en la sync BUK
- [x] Definir el modelo de enlace recomendado entre visión contable y visión BUK, con riesgos y siguiente implementación sugerida

## Catálogo backend BUK -> contabilidad para contratación e incentivos

- [x] Persistir en repo una migración que crea el catálogo backend `buk_contract_mappings` y sincroniza contratos faltantes/actualizados desde la matriz maestra
- [x] Reamarrar `Solicitud de contrataciones` para mostrar como fuente visible el área BUK, manteniendo el `contract_id` contable como llave operativa
- [x] Reemplazar en SQL de incentivos la dependencia de áreas libres de `employees` por el catálogo backend curado y 1:1
- [ ] Aplicar la migración en Supabase productivo y verificar consultas reales

## Resultado de análisis de enlace contable entre contratos/cecos y BUK

- `bbdd-cecos.xlsx` en `Hoja2` trae `95` filas y `9` columnas. La nueva columna `Area_Buk` viene completa en `95/95` filas y no presenta ambigüedad interna: cada fila sigue siendo 1:1 entre `Proyecto`, `Descripcion Proyecto`, `Centro de Costo` y `Area_Buk`.
- Contra `public.contracts`, la cobertura es alta: `92/95` proyectos del Excel ya existen en Supabase por `contract_number` y además `92/95` descripciones contables siguen calzando exactamente con `contract_name`.
- Los `3` proyectos nuevos que todavía no están en `public.contracts` son: `SERCOING - DRT` (`7606991001:0001`), `CODELCO - DSAL` (`6170400011:0001`) y `ARAMARK - DCH` (`7611769636:0001`).
- La nueva columna no replica simplemente el nombre contable. Hay `29` filas donde `Area_Buk` difiere de `Descripcion Proyecto`; varios son renombres menores (`JM SERV ESPECIALES` -> `JM SERVICIOS ESPECIALES`, `TESORERIA` -> `TESORERIA JM`), pero otros son equivalencias de negocio reales (`INDIRECTOS ZONA II` -> `ADMINISTRACION CALAMA`, `CODELCO DMH` -> `SERVICIO CODELCO DMH`, `INTERURBANO VALPARAISO` -> `VALPARAISO`).
- En la sync viva de BUK, `employees_active_current.area_name` no viene limpio: llega como `Area BUK (Proyecto_BUK_versionado)`, por ejemplo `SERVICIO CODELCO DMH (6170400006:0004)` o `VALPARAISO (7850277002:0001)`. Por eso no conviene usar coincidencia textual directa contra el string completo.
- Si se limpia el nombre del área y se ignora el sufijo versionado del proyecto, el cruce mejora bastante: `73/95` filas del Excel encuentran correspondencia en el histórico completo `public.employees`. El cruce contra solo empleados activos sube menos porque varias áreas no tienen dotación activa hoy.
- La diferencia clave es el sufijo del `Proyecto BUK`: en BUK muchas áreas operan con el mismo prefijo del proyecto pero con versiones distintas (`:0004`, `:0005`, etc.). Eso hace que `Proyecto` contable y `Proyecto BUK` no deban tratarse como igualdad rígida de string completo.
- Conclusión operativa: el Excel ya puede actuar como tabla puente maestra entre la visión contable (`contracts`, cecos, unidades de costo) y la visión operativa BUK (`area_name`, `project code`). Pero debe persistirse explícitamente; inferir este enlace desde `employees_active_current` o desde `area_name` libre no es suficientemente estable para producción.

## Resultado parcial de catálogo backend BUK -> contabilidad

- Quedó creada en repo la migración [`supabase/migrations/20260607_230000_add_buk_contract_mapping_catalog.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260607_230000_add_buk_contract_mapping_catalog.sql:1), que introduce `public.buk_contract_mappings`, normaliza nombres de área BUK, sincroniza contratos contables faltantes y reescribe las RPCs críticas de incentivos para usar esta fuente curada.
- La migración también ajusta `submit_hiring_request(...)` para que los nuevos folios guarden como `contract_name` el nombre BUK visible, no la descripción contable interna, manteniendo intacta la llave `contract_id`.
- En frontend, [`src/modules/recruitment/services/hiringCatalogs.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/services/hiringCatalogs.ts:1) ya dejó de leer `public.contracts` como fuente visible y ahora apunta al catálogo puente backend.
- La validación local cerró con `npm run build` y `git diff --check`.
- La única parte pendiente no es técnica del repo sino operativa del conector: la aplicación remota en Supabase fue rechazada por límite de uso del connector, por lo que todavía falta ejecutar la migración en la base productiva y luego verificar conteos/consultas reales antes de enviar esto a `main`.

## Resultado de sincronización de usuarios, roles y módulos desde matriz Excel

- La matriz `usuarios_busesjm.xlsx` quedó aterrizada a códigos canónicos de la app. Se incorporaron al frontend los roles `director_eje`, `director_op`, `gerente_general`, `operaciones_l_1`, `operaciones_l_2` y `administrativo` para evitar que Auth los degradara a `guest`.
- Se aplicó en Supabase la migración `sync_users_roles_modules_from_excel`, que además aseguró la existencia del catálogo mínimo de `app_modules` y `app_capabilities` antes de sincronizar accesos.
- Maximiliano Contreras Rey quedó como único `admin` total con `is_super_admin = true`. Maria Jesus Lagos dejó de heredar permisos de admin y quedó solo con `control_contratos`, tal como define la matriz.
- Se creó el script reutilizable `scripts/provision-users-from-matrix.mjs` y con él se dieron de alta `21` cuentas faltantes en Supabase Auth con contraseña inicial `Bjm2026*`, sin modificar contraseñas de las `13` cuentas ya existentes.
- Luego del alta, se reejecutó el bloque de sincronización de perfiles y `user_roles` para que las nuevas fichas heredaran su rol efectivo inmediatamente. La verificación final confirmó `34/34` usuarios presentes, `0` faltantes, y módulos/capacidades alineados con la hoja `modulos` y la parte de aprobaciones que hoy sí gobierna por rol (`Who` y acceso documental).
- La validación técnica cerró con `npm run build`, `git diff --check` y consultas directas sobre Supabase.

## Resultado de ajuste de aprobación Who sin hallazgos

- La rigidez estaba en backend: `normalize_candidate_who_causes(...)` rechazaba listas vacías y `request_candidate_stage_who(...)` siempre abría una aprobación pendiente.
- La lógica quedó alineada al negocio: si el reclutador no registra hallazgos, la validación Who se autoaprueba internamente, el candidato pasa a `who_approved` y no aparece ninguna tarea pendiente de autorización.
- Si existen hallazgos, el flujo sigue igual: se crea registro en `candidate_stage_approvals`, el candidato queda en `who_pending` y la aprobación aparece en las bandejas correspondientes.
- Para no romper la trazabilidad posterior, incluso el caso sin hallazgos deja registro estructurado: se inserta una fila Who ya aprobada, sin causas y con metadata `auto_approved = true`.
- La UI ahora lo explica en la ficha del candidato y muestra mensaje distinto según el resultado real: `Solicitud Who enviada a aprobación` o `Sin hallazgos: validación Who aprobada automáticamente`.
- La migración quedó aplicada en Supabase como `20260608004750 autoapprove_who_without_findings`.
- La validación técnica cerró con `npm run build` y `git diff --check`.

## Resultado de corrección de bloqueo del widget de clima

- El segundo problema no estaba en la API de ciudad ni en Open-Meteo, sino en la orquestación local del navegador.
- El experimento con múltiples lecturas de geolocalización terminó siendo inestable en uso real: primero dejó la tarjeta colgada y luego siguió cayendo a `Santiago, CL`.
- Se retiró esa complejidad y se volvió al contrato simple y verificable: una sola lectura real del navegador con `getCurrentPosition(...)` y reverse geocoding posterior para traducir las coordenadas reales.
- El fallback fijo vuelve a quedar reservado solo al error real del navegador (`permiso denegado`, `posición no disponible`, `timeout`), no a carreras internas del componente.
- La validación técnica cerró con `npm run build`.

## Corrección de regresión en resolución real del clima

- [x] Reproducir por código por qué el widget vuelve a `Santiago, CL` aunque el usuario esté fuera de Santiago
- [x] Endurecer el flujo de geolocalización para que no caiga prematuramente al fallback fijo cuando aún exista una lectura real recuperable
- [x] Validar build y documentar la corrección sin tocar otros widgets del Inicio

## Resultado de corrección de regresión en resolución real del clima

- La API de reverse geocoding no era la culpable: para coordenadas de Los Andes (`-32.83`, `-70.59`) devuelve correctamente `Los Andes, CL`.
- La regresión estaba en el flujo del navegador. El widget pedía una lectura de alta precisión y, si esa llamada fallaba por timeout o disponibilidad, caía directo al fallback fijo `Santiago, CL`.
- Se corrigió el flujo para degradar en dos pasos: primero intenta geolocalización de alta precisión y, si eso falla sin denegación explícita, reintenta con una lectura más tolerante (`enableHighAccuracy: false`, timeout mayor y caché más amplia) antes de declarar fallback.
- El fallback fijo a Santiago ahora queda reservado a casos reales de permiso denegado, falta de soporte o doble fallo de geolocalización, no como salida prematura de un solo intento estricto.
- La validación técnica cerró con `npm run build` y `git diff --check`.


## Corrección crítica del bundle del Inicio

- [x] Confirmar la causa real del dashboard vacío revisando RPC `get_dashboard_home_bundle(...)` y logs productivos
- [x] Corregir la función SQL defectuosa sin alterar permisos ni payloads válidos del resto del inicio
- [x] Validar el bundle autenticado, compilar frontend y dejar resultado/lección documentados

## Resultado de corrección crítica del bundle del Inicio

- El problema no era caché ni falta de datos: el RPC `public.get_dashboard_home_bundle(...)` estaba rompiendo completo el Inicio con error SQL `column b.days_until does not exist`.
- La causa raíz fue una regresión en la agregación del widget de cumpleaños. `get_dashboard_home_bundle(...)` trataba `public.get_upcoming_birthdays(...)` como si devolviera filas (`from ... b`), pero esa función devuelve `jsonb`.
- Se corrigió el bundle para consumir directamente el `jsonb` de `get_upcoming_birthdays(...)`, manteniendo intactos los demás payloads (`tasks_data`, `approval_tracking_data`, `active_folios_data`).
- La corrección quedó aplicada en producción y además registrada en el repo con la migración `20260607_081211_fix_dashboard_home_bundle_birthdays_payload.sql`.
- La validación autenticada sobre Supabase cerró con datos reales: `approval_tracking_data = 2`, `active_folios_data = 3`, `birthdays_data = 6`. En esa muestra `tasks_data = 0`, por lo que el vacío de tareas no era fallo técnico sino estado actual del flujo.
- La validación local cerró con `npm run build`.


## Segunda pasada controlada sobre RLS

- [x] Auditar warnings vigentes de security/performance advisors enfocados en funciones y políticas que afectan flujos activos de la app
- [x] Seleccionar solo correcciones RLS/grants/search_path no destructivas y con verificación directa
- [x] Aplicar una migración nueva, separada y reversible, sin mezclar limpieza de índices/constraints destructivos
- [x] Verificar con consultas remotas, advisors y build; dejar resultado y lecciones documentadas

## Resultado de segunda pasada controlada sobre RLS

- La primera propuesta amplia fue rechazada por el conector de Supabase por riesgo productivo. En vez de forzarla, la pasada se degradó a un corte seguro sobre auth/config compartido y performance de claves foráneas.
- Se aplicó en producción la migración `20260607_075617_controlled_rls_second_pass.sql`, registrada remotamente como `20260607120109 controlled_rls_second_pass`.
- La migración corrigió policies RLS compartidas de `profiles`, `user_roles`, `document_types`, `cost_center_approvers` y `workflow_approvers`, reemplazando el patrón directo `auth.uid()` por `(select auth.uid())` donde correspondía y separando policies `ALL` en policies por operación para evitar evaluación redundante.
- También creó siete índices faltantes sobre claves foráneas activas: `candidate_profiles.created_by`, `hiring_request_audit_log.approval_id`, `hiring_request_snapshots.created_by`, `hiring_requests.final_decided_by`, `role_module_access.module_code`, `user_roles.assigned_by` y `workflow_approvers.approver_user_id`.
- La verificación posterior confirmó que desaparecieron las alertas `auth_rls_initplan` para `profiles`, `user_roles`, `cost_center_approvers` y `workflow_approvers`, y también las alertas `multiple_permissive_policies` sobre `document_types` y `user_roles`.
- Los warnings de RLS más pesados ligados a reclutamiento, solicitudes y documentos siguen pendientes y no se tocaron en esta iteración para no reescribir políticas operativas masivas sobre tablas vivas.
- La validación local cerró con `git diff --check` y `npm run build`.

## Endurecimiento productivo sobre Supabase Pro

- [x] Reintroducir un RPC resumido del dashboard para reducir roundtrips del inicio a una sola llamada
- [x] Incorporar invalidación por Realtime en Inicio, Reclutamiento e Incentivos para reducir dependencia de polling y `F5`
- [x] Corregir avisos críticos/útiles del advisor de Supabase en seguridad y performance que sí impactan la app actual
- [x] Validar build, advisors y documentar el resultado operativo

## Resultado de endurecimiento productivo sobre Supabase Pro

- El inicio dejó de depender de cuatro RPCs separadas y ahora consume un bundle único desde `public.get_dashboard_home_bundle(...)`, reduciendo roundtrips del dashboard principal.
- Se agregó invalidación por Realtime en tres superficies operativas: `Inicio`, `Control de Contrataciones` e `Incentivos`. Con esto, la app deja de descansar principalmente en polling corto y gana refresco reactivo ante cambios reales en base.
- En frontend se subió el intervalo de respaldo del dashboard a `180s`; la actualización principal ahora la hace Realtime y el polling queda como fallback de resiliencia, no como motor principal.
- En Supabase productivo quedó aplicada la migración `20260606_234500_supabase_pro_hardening_dashboard_and_rls.sql`, que añadió el RPC bundle, fijó `search_path` en helpers de sindicato, cerró exposición `anon` en RPCs sensibles y creó índices faltantes sobre tablas activas del flujo.
- La verificación remota confirmó que `advance_recruitment_candidate_stage`, `reject_candidate_stage_who` y `find_candidate_profile_with_history_by_rut` ya no exponen `EXECUTE` a `anon`, y que `get_dashboard_home_bundle(...)` quedó publicado para `authenticated`.
- El `build` local cerró correctamente con `npm run build`.
- Se intentó además una pasada más agresiva sobre RLS y limpieza destructiva de duplicados, pero el conector de Supabase la rechazó por riesgo productivo. Ese recorte quedó deliberadamente fuera de esta entrega para no introducir regresiones de acceso en vivo.

## Submódulo RRHH: Incentivos operativos

- [x] Reemplazar el placeholder de `Recursos Humanos` por un módulo real con ruta interna `/recursos-humanos/incentivos`
- [x] Crear backend Supabase para incentivos: tablas de tipos, cargos elegibles, reglas de monto, solicitudes e historial
- [x] Publicar RPCs seguras para buscar trabajadores BUK elegibles, obtener contexto del trabajador y contratos alternativos, calcular monto y registrar/anular incentivos
- [x] Implementar frontend con tres superficies iniciales: listado, registro con cálculo automático y configuración base
- [x] Aplicar migración en Supabase, validar build y registrar resultado/lecciones

## Enlace BUK en Configuración base de Incentivos

- [x] Revisar por qué `Configuración base` no exponía cargos sincronizados desde BUK
- [x] Exponer en backend el catálogo real de cargos BUK activos dentro de `get_hr_incentive_setup_catalogs()`
- [x] Reemplazar inputs manuales de cargo en `Configuración base` por selectores alimentados desde BUK
- [x] Aplicar migración en Supabase, validar build y registrar resultado

## Compactación de configuración base y sindicato BUK en incentivos

- [x] Revisar por qué la tarjeta de cargos elegibles quedaba estirada y no compacta
- [x] Identificar el dato real de sindicato disponible en BUK sincronizado
- [x] Extender reglas de incentivo para considerar sindicato y exponerlo en frontend/backend
- [x] Aplicar migración, validar build y documentar resultado

## Corrección de búsqueda de trabajador en incentivos

- [x] Identificar la causa del error `column reference "job_title" is ambiguous`
- [x] Reemplazar la función RPC afectada y validar búsqueda de trabajadores elegibles

## Limpieza estructural profunda de Supabase

- [x] Auditar base productiva contra código vivo para distinguir objetos operativos de superficie legacy o sin contrato actual
- [x] Cerrar deuda estructural segura: helpers/RPCs expuestos de más, sobrecargas legacy y duplicados exactos verificables
- [x] Aplicar la limpieza en Supabase y dejar migración espejo en repo con validación posterior
- [x] Verificar consultas críticas, `build`, y documentar hallazgos/resultados en `tasks/lessons.md`

## Resultado de limpieza estructural profunda de Supabase

- La revisión se hizo contra la base productiva real y no solo contra migraciones locales. Se contrastaron tablas, funciones y grants vivos con los consumidores efectivos del código (`src/`, `scripts/`) para separar objetos con contrato actual de superficie legacy.
- Se aplicó en Supabase la migración espejo [`supabase/migrations/20260608_230500_structural_supabase_cleanup.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260608_230500_structural_supabase_cleanup.sql:1), con un alcance deliberadamente seguro: `unaccent` salió del esquema `public`, se eliminaron sobrecargas obsoletas de `add_hr_incentive_rate_rule(...)` y `resolve_hr_incentive_rate_rule(...)`, y se borraron duplicados exactos de índices (`idx_profiles_email`, `idx_candidate_profiles_national_id`, `idx_job_positions_name`, `idx_shifts_name`).
- También quedó aplicado y versionado [`supabase/migrations/20260608_231500_drop_unused_find_candidate_profile_by_rut.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260608_231500_drop_unused_find_candidate_profile_by_rut.sql:1), retirando el RPC legacy `find_candidate_profile_by_rut(text)` ya reemplazado por `find_candidate_profile_with_history_by_rut(text)`.
- La verificación remota confirmó el estado final esperado: `find_candidate_profile_by_rut` ya no existe, solo queda una sobrecarga vigente para `add_hr_incentive_rate_rule(...)`, solo una para `resolve_hr_incentive_rate_rule(...)`, y no queda ninguno de los cuatro índices duplicados exactos.
- Se auditó además el inventario real de tablas `public`. No se eliminaron tablas con `0` filas como `candidate_documents`, `candidate_worker_files` o `hr_incentive_requests`, porque sí tienen contrato funcional vigente en la app y removerlas habría roto módulos vivos aunque hoy no tengan volumen.
- Los advisors siguen marcando funciones `SECURITY DEFINER` ejecutables por `authenticated`, pero en este sistema eso no es basura residual sino el patrón operativo actual de RPCs protegidas por validación interna y RLS. Esa superficie no se tocó en esta pasada porque mezclar limpieza estructural con recontratación de permisos productivos aumenta riesgo de regresión.
- La validación técnica cerró con `npm run build`. El estado remoto de migraciones ya refleja `structural_supabase_cleanup_safe_pass` y `drop_unused_find_candidate_profile_by_rut`.

## Reparación del widget de clima tras cambio de subdominio

- [x] Confirmar si el problema venía del subdominio/headers o de una regresión en la estrategia de geolocalización
- [x] Restaurar una resolución robusta de ubicación real antes del fallback por IP/Santiago
- [x] Validar build y documentar el criterio para cambios de origen (`pages.dev` -> subdominio propio)

## Resultado de reparación del widget de clima tras cambio de subdominio

- Se descartó un bloqueo por headers del subdominio. `https://gestion.busesjm.cl` y `https://app-test-1-2ao.pages.dev` responden sobre `https` y no exponen `Permissions-Policy` que deshabilite geolocalización.
- La causa real estaba en frontend: el widget había vuelto a una versión degradada que hacía un solo `getCurrentPosition(...)` con `enableHighAccuracy: true` y, ante cualquier fallo, caía directo al fallback por IP o `Santiago, CL`.
- Eso explicaba el síntoma observado tras el cambio de dominio: al cambiar de `pages.dev` a `gestion.busesjm.cl`, el navegador trata la geolocalización como permiso por origen nuevo. Si ese primer intento preciso falla o todavía no se resuelve bien el permiso, el widget se iba demasiado rápido a ubicación aproximada.
- Se corrigió [`src/modules/dashboard/components/DashboardInfoCards.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/components/DashboardInfoCards.tsx:1) para lanzar dos lecturas reales del navegador en paralelo (rápida/coarse y precisa), aceptar la mejor precisión disponible, y solo usar IP/Santiago cuando ambas fallen de verdad.
- Además, la última ubicación real válida del navegador queda cacheada localmente por 12 horas. Si el permiso tarda o falla temporalmente, la tarjeta ya no salta directo a Santiago; reutiliza primero la última ubicación conocida y vuelve a intentar al enfocar la app.
- La validación técnica cerró con `npm run build`.

## Sindicato nominal BUK como variable real de montos

- [x] Verificar si el nombre específico del sindicato existe en la sync BUK
- [x] Sustituir el uso de estado sindical genérico por sindicato nominal en reglas, contexto y cálculo
- [x] Aplicar migración, validar y documentar resultado

## Resultado de sindicato nominal BUK como variable real de montos

- Se confirmó que el dato correcto para la lógica de montos no era el proxy binario de sindicalización, sino `raw_payload.current_job.union`.
- La sync activa trae `1571` trabajadores con sindicato nominal y `18` valores distintos, incluyendo casos reales como `No Sindicalizados`, `Sindicato Codelco DMH` y `Sindicato Interempresa de trabajadores de transporte buses JM, Minardi S.A. (Inter calama)`.
- El módulo ahora expone `buk_unions` en configuración base, permite crear reglas por sindicato específico y muestra ese valor exacto en la ficha operativa del trabajador.
- Las nuevas columnas `hr_incentive_rate_rules.union_name` y `hr_incentive_requests.employee_union_name` quedaron aplicadas en Supabase mediante la migración `20260606_223500_use_exact_buk_union_name_for_incentives.sql`.

## Resultado de compactación de configuración base y sindicato BUK en incentivos

- La separación vertical exagerada de `Cargos elegibles BUK` no venía del selector, sino del comportamiento por defecto del grid de dos columnas: la tarjeta izquierda se estiraba a la altura de la derecha. Se corrigió estructuralmente con `align-items: start` y densidad más compacta en la tarjeta/lista.
- En esa etapa se incorporó una primera capa de estado sindical derivado (`unionized`, `non_unionized`, `unknown`) usando atributos sincronizados desde BUK.
- Ese criterio quedó posteriormente reemplazado por sindicato nominal exacto (`raw_payload.current_job.union`) como variable principal de cálculo, manteniendo el estado derivado solo como respaldo técnico.
- `Reglas de monto` ya permite condicionar por `Sindicato BUK (opcional)` y el formulario operativo muestra el sindicato exacto del trabajador en modo solo lectura.
- La migración `20260606_220000_add_union_status_to_hr_incentives.sql` quedó aplicada en Supabase. La verificación remota confirmó `121` cargos BUK disponibles, los tres estados sindicales en catálogo y las columnas nuevas persistidas en `hr_incentive_rate_rules` y `hr_incentive_requests`.

## Resultado de enlace BUK en Configuración base de Incentivos

- `Configuración base` dejó de depender de texto libre para cargos BUK y ahora consume el catálogo real de cargos activos sincronizados en `employees_active_current`.
- `get_hr_incentive_setup_catalogs()` fue extendida para devolver `buk_job_titles`, reusando la misma lógica de resolución de cargo que ya ocupaba la búsqueda de trabajadores elegibles.
- La UI administrativa ahora muestra un selector de cargos sincronizados tanto para `Cargos elegibles BUK` como para la restricción opcional por cargo en `Reglas de monto`.
- La migración `20260606_130000_link_hr_incentive_setup_to_buk_job_titles.sql` fue aplicada en Supabase y la validación técnica local cerró con `npm run build`.

## Resultado de submódulo RRHH: Incentivos operativos

- `Recursos Humanos` dejó de ser placeholder y ahora expone un módulo real en `/recursos-humanos/incentivos`, con navegación interna para `Registrar incentivo`, `Historial` y `Configuración base`.
- Supabase quedó extendido con tablas propias de incentivos (`hr_incentive_allowed_job_titles`, `hr_incentive_types`, `hr_incentive_rate_rules`, `hr_incentive_requests`, `hr_incentive_request_history`) y RPCs seguras para búsqueda de trabajadores BUK elegibles, contexto del trabajador, cálculo server-side, alta y anulación.
- La lógica crítica quedó en backend: el monto no se puede editar desde frontend, se resuelve por regla vigente según tipo, cargo y contrato; además el formulario solo muestra trabajadores cuyo cargo BUK esté permitido en la configuración base.
- La UI inicial ya permite operar end to end sobre la base nueva: buscar trabajador, autocompletar RUT/cargo, elegir contrato activo u otros contratos históricos detectados en BUK, calcular incentivo y registrar la solicitud; además existe bandeja de historial con anulación y pantalla administrativa para mantener cargos, tipos y reglas.
- La migración se aplicó directamente en Supabase productivo y la verificación técnica cerró con `npm run build`, `git diff --check` y comprobación remota de tablas/RPCs (`hr_incentive_requests`, `get_hr_incentive_setup_catalogs`, `search_hr_incentive_eligible_workers`, `create_hr_incentive_request`).

## Corrección productiva del widget de cumpleaños

- [x] Verificar si la última sync BUK realmente escribió datos nuevos en `employees`
- [x] Contrastar la fuente del widget de cumpleaños con la vista `employees_active_current` y la función `get_upcoming_birthdays(...)`
- [x] Corregir la lógica SQL del próximo cumpleaños para que no desplace fechas al día 1 del mes
- [x] Aplicar migración en Supabase y validar el top real de cumpleaños

## Resultado de corrección productiva del widget de cumpleaños

- La sync BUK sí quedó persistida en producción: `public.employees` subió a `5212` filas con `max(updated_at) = 2026-06-06 02:04:11+00`.
- La diferencia entre `activeCount = 1605` del job y `employees_active_current = 1593` en la vista es consistente con la deduplicación de fichas activas múltiples; el dashboard consume la vista canónica, no la tabla cruda.
- El problema real no era caché ni falta de actualización, sino la función `get_upcoming_birthdays(...)`: el cálculo del último día del mes estaba mal parentizado y terminaba truncando cumpleaños válidos al día `1`.
- Eso hacía que la tarjeta pudiera saltarse cumpleaños inmediatos de junio y priorizar erróneamente personas de julio, aun con datos correctos ya sincronizados.
- La corrección quedó versionada en una migración dedicada para que el dashboard de producción dependa de una lógica determinista y auditable, no de un hotfix manual.
- La validación final confirmó que casos reales de junio vuelven a salir primero: por ejemplo, `Patricio Edgardo Villalobos Villarreal` recuperó `next_birthday = 2026-06-06` y el top vuelve a ordenar correctamente `06/06`, `07/06` y `08/06`.

## Endurecimiento de caching para Inicio y Reclutamiento

- [x] Auditar qué superficies críticas siguen usando fetch imperativo y estado duplicado en vez de caché compartido
- [x] Centralizar query keys y hooks de TanStack Query para Dashboard Home, catálogos de contratación y detalle/tablero de Control de Contrataciones
- [x] Reemplazar recargas manuales por invalidación explícita tras mutaciones del flujo de reclutamiento
- [x] Validar compilación y documentar la estrategia

## Resultado de endurecimiento de caching para Inicio y Reclutamiento

- La app ya no mezcla dos contratos de refresco distintos en el flujo principal: Inicio sigue con TanStack Query y Reclutamiento quedó alineado al mismo modelo para dashboard, detalle por caso y catálogos.
- Se creó una capa explícita de `queryKeys` y hooks reutilizables (`useRecruitmentControlDashboard`, `useRecruitmentCaseDetail`, `useHiringCatalogs`) para evitar arrays ad hoc y recargas duplicadas dispersas en componentes.
- `HiringStatusPage` dejó de disparar `loadDashboard()` / `loadCaseDetail()` manualmente después de cada acción; ahora invalida solo las queries afectadas, lo que reduce fetches redundantes y mantiene la UI coherente sin depender de `F5`.
- `HiringProcessesView` ya no mantiene un caché local paralelo del detalle expandido; reutiliza la misma query compartida del caso, evitando drift entre vistas del mismo dato.
- `HiringRequestPage` dejó de recargar catálogos en cada montaje con `useEffect`; los catálogos activos quedan cacheados con TTL largo, apropiado para datos maestros de baja volatilidad.

## Refresh automático del dashboard operativo

- [x] Verificar si `Inicio` refresca solo o depende de `F5` / recarga manual
- [x] Corregir `useDashboard` para que el estado operativo se actualice automáticamente sin intervención del usuario
- [x] Validar compilación y documentar la regla

## Restricción de Control de candidatos por capacidad documental

- [x] Separar `Control de candidatos` con una capability exclusiva para Reclutamiento y `system_admin`
- [x] Ocultar la vista y navegación del subflujo para usuarios sin esa capability
- [x] Endurecer los RPCs del subflujo candidato/documental para bloquear acceso forzado desde cliente
- [x] Validar compilación y dejar resultado documentado

## Separación de "Control de candidatos" y "Personal a Contratar"

- [x] Ajustar `get_recruitment_control_dashboard_v2()` para que los candidatos `hired` salgan de `candidate_control` y entren a una bandeja propia
- [x] Crear la vista `Personal a Contratar` junto a `Control de candidatos`, reutilizando ficha y documentos ya cargados
- [x] Ocultar acciones de avance de etapa en la nueva bandeja y validar build + migración aplicada

## Corrección de cierre de folios y visibilidad operativa

- [x] Corregir backend para que `close_hiring_request` permita cierre solo a `admin`, `reclutamiento` y gerente de área
- [x] Eliminar la ambigüedad de nombres dentro de `close_hiring_request` evitando colisión entre columnas de salida y columnas reales
- [x] Exponer en el payload de procesos si el usuario actual puede cerrar cada folio y usar esa señal para ocultar el botón en frontend
- [x] Validar build y documentar el comportamiento final de candidatos al cerrar un folio

## Resultado de corrección de cierre de folios y visibilidad operativa

- Se agregó la migración [`supabase/migrations/20260608_130000_harden_close_hiring_request_permissions.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260608_130000_harden_close_hiring_request_permissions.sql:1), que introduce `public.user_can_close_hiring_request(...)` como fuente única de autorización para cierres.
- `close_hiring_request(...)` dejó de permitir cierre por simple acceso al módulo o por ser solicitante original. Ahora solo cierra `admin`, `reclutamiento` y el aprobador activo del centro de costo.
- La colisión de nombres dentro de la RPC quedó eliminada al renombrar las columnas de salida a `request_id` y `request_status`, evitando ambigüedad con columnas reales de tablas operativas.
- El dashboard de `Control de Contrataciones` ahora recibe `can_close_request` por cada caso, por lo que el botón `Cerrar Folio` solo se renderiza cuando el backend confirma que el usuario actual sí puede cerrar ese folio.
- Se corrigió además el efecto colateral sobre `Personal a Contratar`: los candidatos `hired` de folios cerrados manualmente siguen visibles en esa bandeja para permitir completar ficha y documentación posterior al cierre del folio.
- La validación local cerró con `npm run build` y `git diff --check`.

## Resultado de separación de "Control de candidatos" y "Personal a Contratar"

- `Control de candidatos` ya no mezcla el estado terminal `hired`; la bandeja quedó enfocada solo en pipeline operativo previo a contratación.
- Se creó la nueva vista `Personal a Contratar` dentro de `Control de Contrataciones`, al lado de `Control de candidatos`, reutilizando el mismo detalle lateral para revisar trazabilidad, checklist documental y ficha del candidato.
- En la nueva bandeja se ocultaron explícitamente los controles de avance de etapa y aprobación Who; queda como superficie de revisión y preparación contractual, no como pipeline de reclutamiento.
- Supabase quedó alineado con una migración nueva que reescribe `get_recruitment_control_dashboard_v2()` para exponer `candidate_control` sin `hired` y un nuevo payload `personnel_to_hire` solo con candidatos contratados.
- La validación técnica cerró con `git diff --check`, `npm run build`, migración aplicada en Supabase y verificación del cuerpo de la función remota mediante `pg_get_functiondef(...)`.

## Resultado de restricción de Control de candidatos por capacidad documental

- `Control de candidatos` dejó de depender solo del acceso al módulo `control_contrataciones`; ahora usa la capability explícita `candidate_control_access`.
- El frontend ya no renderiza la pestaña ni permite permanecer en la vista de candidatos si el usuario no tiene esa capability.
- `get_recruitment_control_dashboard_v2()` ya no entrega el payload `candidate_control` a usuarios sin permiso, reduciendo exposición de datos sensibles incluso si inspeccionan la respuesta de red.
- Se agregó una migración de endurecimiento que asigna `candidate_control_access` a `reclutamiento` y bloquea por backend los RPCs del subflujo candidato/documental para cualquier usuario sin esa capacidad, manteniendo bypass administrativo por `user_is_admin(...)`.
- Al aplicar el endurecimiento sobre Supabase apareció drift real de firmas en funciones remotas; la migración se ajustó con `drop function if exists ...` explícitos antes de recrear las funciones sensibles, evitando fallos por cambio de `RETURNS TABLE`.
- La validación técnica quedó cerrada con `git diff --check` y `npm run build`.

## Resultado de refresh automático del dashboard operativo

- El dashboard no era realmente vivo: usaba TanStack Query, pero sin `refetchInterval`, con `refetchOnWindowFocus: false` heredado por defecto y sin ninguna suscripción en tiempo real.
- En la práctica, una solicitud de aprobación nueva podía no aparecer hasta refrescar la página o remount de la vista.
- `useDashboard` ahora fuerza un contrato operativo más correcto: `staleTime: 15s`, `refetchInterval: 30s`, `refetchOnWindowFocus: true` y `refetchOnReconnect: true`.
- Con esto, `Tareas Pendientes`, `Seguimiento de aprobaciones`, `Folios en curso` y `Cumpleaños` dejan de depender de `F5`, aunque no son instantáneos al segundo. Para inmediatez absoluta, el siguiente salto sería suscripción en tiempo real.

## Limpieza estructural de dashboard y vestigios muertos

- [x] Detectar widgets del dashboard sin uso real ni futuro operativo inmediato
- [x] Eliminar abstracciones genéricas del dashboard que solo encubrían un único caso real
- [x] Reducir comentarios y vestigios de transición que ya no agregan valor
- [x] Validar compilación y build después de la limpieza

## Resultado de limpieza estructural de dashboard y vestigios muertos

- Se eliminaron los componentes muertos `QuickActionsWidget.tsx` y `TimelineWidget.tsx`; no tenían referencias activas ni contrato operativo vigente.
- `DashboardGrid` dejó de usar un bus genérico `onAction(actionType, payload)` para un solo caso real; ahora recibe un `onRefresh()` explícito, más simple y menos acoplado.
- `TasksWidget` ya no dispara strings de comando (`REFRESH_DATA`) para refrescar el dashboard; invoca un callback directo y tipado.
- Se retiró ruido residual en `HomePage.tsx`, manteniendo el módulo como un contenedor limpio hacia `DashboardHome`.

## Corrección de regresión en geolocalización del widget de clima

- [x] Revisar por qué el widget de clima dejó de resolver ubicación real aunque el navegador entregara coordenadas
- [x] Corregir el fallback para que no vuelva a `Santiago, CL` cuando solo falle el reverse geocoding
- [x] Reintentar resolución de ubicación al recuperar foco si la sesión quedó sin permiso o sin respuesta inicial
- [x] Validar compilación y build

## Resultado de corrección de regresión en geolocalización del widget de clima

- El widget sí obtenía coordenadas reales, pero si fallaba la llamada de reverse geocoding caía visualmente a `Santiago, CL`; eso hacía parecer que no resolvía ubicación aunque el clima ya no estuviera usando el fallback.
- Ahora el flujo es más robusto: primero se guardan y usan las coordenadas reales, luego se intenta traducirlas a ciudad; si esa traducción falla, el widget conserva una etiqueta basada en coordenadas reales en vez de mentir con Santiago.
- También se expuso un estado más preciso para errores de geolocalización (`permiso denegado`, `ubicación no disponible`, `timeout`) y se reintenta al recuperar foco mientras la ubicación siga sin resolverse.

## Corrección de fallback inicial falso en clima

- [x] Verificar por qué el widget seguía mostrando `Santiago, CL` y clima de Santiago mientras declaraba `Resolviendo ubicación...`
- [x] Separar estado inicial pendiente de estado fallback real
- [x] Evitar que Open-Meteo consulte coordenadas de Santiago antes de recibir ubicación o error explícito
- [x] Evitar que el estado intermedio de coordenadas aborte la resolución del nombre de ciudad
- [x] Agregar timeout propio de aplicación para salir de estados pendientes colgados
- [x] Validar `tsc` y build de Vite

## Resultado de corrección de fallback inicial falso en clima

- El estado inicial del widget usaba `DEFAULT_LOCATION`, que ya contenía coordenadas de Santiago. Eso hacía que la tarjeta consultara clima de Santiago aunque la geolocalización siguiera pendiente.
- Ahora existe `INITIAL_LOCATION` sin coordenadas; mientras el navegador resuelve ubicación, no se consulta clima con fallback falso.
- La ubicación real se confirma después de resolver la etiqueta humana; si esa resolución falla, se muestran coordenadas reales, no Santiago.
- `Santiago, CL` queda reservado para error real, falta de soporte de geolocalización o timeout explícito de la app.
- Se agregó un timeout propio de 12 segundos para que la UI no quede indefinidamente en `Resolviendo ubicación...` si el navegador no llama ni éxito ni error.

## Endurecimiento de parser de ciudad para clima

- [x] Verificar si la regresión restante venía del parser del payload de geocodificación inversa
- [x] Extraer ciudad también desde `localityInfo.administrative` cuando el proveedor no entregue `city` o `locality` planos
- [x] Validar compilación y build

## Resultado de endurecimiento de parser de ciudad para clima

- BigDataCloud sí entrega ciudad para Los Andes, pero la app estaba preparada solo para campos planos (`city`, `locality`, `principalSubdivision`).
- El parser ahora también revisa `localityInfo.administrative` y toma la localidad administrativa más específica disponible antes de degradar a región o coordenadas.
- Con esto, el widget deja de caer innecesariamente a coordenadas cuando el proveedor entregue la ciudad en estructura anidada.

## Reparación de build roto por dependencia de TanStack Query

- [x] Reproducir el fallo real de `vite build`
- [x] Aislar si el problema venía del código del dashboard o de una dependencia publicada defectuosa
- [x] Fijar `@tanstack/react-query` y `@tanstack/query-core` a una versión estable que exponga correctamente su entrypoint
- [x] Validar con `git diff --check`, `tsc -b` y `vite build`

## Resultado de reparación de build roto por dependencia de TanStack Query

- El error de Vite no venía del cambio de auto-refresh ni de la app: la versión `5.100.14` de `@tanstack/react-query` instalada en este entorno quedó con `exports` apuntando a `build/modern/index.js`, pero ese archivo no existía en `node_modules`.
- La señal definitiva fue reproducible fuera de Vite: `import("@tanstack/react-query")` fallaba con `ERR_MODULE_NOT_FOUND` porque faltaba el entrypoint moderno del paquete.
- Se fijaron `@tanstack/react-query` y `@tanstack/query-core` en `5.90.20`, versión estable que vuelve a exponer correctamente el entrypoint ESM esperado por Vite.
- Tras el ajuste, `tsc -b` y `vite build` vuelven a pasar y el build quedó restablecido.

## Verificación de sync BUK y corrección de layout en Solicitud de Contrataciones

- [x] Verificar en Supabase si la sincronización BUK realmente actualizó `employees` después del fix del workflow
- [x] Revisar la estructura y estilos de `HiringRequestPage` para aislar la causa del solapamiento reportado
- [x] Aplicar un ajuste de layout defensivo para evitar compresión horizontal entre formulario y resumen sticky
- [x] Validar con `git diff --check`, `npx tsc -b` y `npm run build`

## Resultado de verificación de sync BUK y corrección de layout en Solicitud de Contrataciones

- La base confirma que la sync BUK no quedó al día: `employees.updated_at` y `employees_active_current` siguen congelados en `2026-05-30T03:54:02.283802+00:00`, por lo que todavía no hubo actualización efectiva posterior al arreglo del workflow.
- El problema del workflow ya no es de código local sino de ejecución: hace falta disparar una corrida manual o esperar la próxima ventana programada y luego volver a verificar la base.
- En `Solicitud de Contrataciones`, el riesgo más alto estaba en la compresión horizontal del layout: el formulario seguía compartiendo ancho con el resumen sticky hasta un breakpoint demasiado bajo.
- Se endureció el comportamiento responsivo para que `hiring-layout-grid` colapse a una sola columna desde `1320px` y `summary-panel` deje de ser sticky en ese rango, evitando montajes entre bloques cuando el ancho intermedio ya no sostiene ambos paneles con holgura.

## Corrección de compatibilidad de variables en Sync BUK GitHub Actions

- [x] Revisar la regresión introducida por el hardening del workflow tras un nuevo fallo en GitHub Actions
- [x] Restaurar compatibilidad con `NEXT_PUBLIC_SUPABASE_URL` en el workflow, porque el script ya seguía soportando ese nombre
- [x] Validar sintaxis YAML y registrar la lección

## Resultado de corrección de compatibilidad de variables en Sync BUK GitHub Actions

- El workflow endurecido dejó de ser compatible con una configuración histórica válida del repo: `vars.NEXT_PUBLIC_SUPABASE_URL`.
- El script `sync-buk-employees.mjs` sí seguía aceptando `NEXT_PUBLIC_SUPABASE_URL`, pero `sync-buk.yml` solo inyectaba y validaba `VITE_SUPABASE_URL`/`SUPABASE_URL`; eso podía provocar un fallo temprano del job aunque la configuración previa siguiera siendo la única presente en GitHub.
- Se restauró compatibilidad completa: el workflow ahora exporta y valida `NEXT_PUBLIC_SUPABASE_URL` además de `VITE_SUPABASE_URL` y `SUPABASE_URL`.

## Corrección de fallback de URLs BUK vacías en GitHub Actions

- [x] Inspeccionar el log real del run fallido de `Sync BUK Employees`
- [x] Corregir el script para que trate `BUK_EMPLOYEES_URL` y `BUK_AREAS_URL` vacías como ausentes en vez de valores válidos
- [x] Validar sintaxis del script y publicar el fix

## Resultado de corrección de fallback de URLs BUK vacías en GitHub Actions

- El log real del run fallido mostró la causa exacta: `BUK_EMPLOYEES_URL` y `BUK_AREAS_URL` llegaban a GitHub Actions como string vacío, no como `undefined`.
- `sync-buk-employees.mjs` usaba `??` para decidir fallback, por lo que `""` seguía considerándose un valor “presente”; eso rompía `new URL("")` con `TypeError: Invalid URL` antes de comenzar la sincronización real.
- El script ahora normaliza variables opcionales de entorno y convierte strings vacíos en `null`, permitiendo que el fallback seguro a `https://busesjm.buk.cl/api/v1/chile/employees` y su endpoint derivado de áreas funcione también en GitHub Actions.

## Revisión de alerta en integración BUK

- [x] Revisar el estado documentado de la integración BUK y el contrato actual de sincronización
- [x] Auditar el workflow `.github/workflows/sync-buk.yml` y el script `scripts/sync-buk-employees.mjs` para detectar puntos frágiles que expliquen updates fallidos
- [x] Endurecer la validación de variables críticas y la instalación de dependencias del job programado
- [x] Hacer que el script deje un resumen más explícito de la sincronización ejecutada
- [x] Corregir la lógica de ventana horaria para que un run programado no se salte la sync por retraso de GitHub Actions
- [x] Validar sintaxis del script, consistencia del workflow y registrar la lección

## Resultado de revisión de alerta en integración BUK

- El flujo de sincronización BUK no mostraba un contrato explícito de variables en GitHub Actions: si faltaba `VITE_SUPABASE_URL` o `SUPABASE_SERVICE_ROLE_KEY`, el job fallaba tarde y con diagnóstico ambiguo.
- El workflow ahora usa `npm ci --omit=dev` con cache de npm, en vez de instalar solo `@supabase/supabase-js`, dejando una ejecución más determinista y alineada con `package-lock.json`.
- Se agregó una etapa `Validate required sync variables` en `.github/workflows/sync-buk.yml` que falla temprano si faltan `BUK_AUTH_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY` o una URL válida de Supabase (`VITE_SUPABASE_URL` o `SUPABASE_URL`).
- `scripts/sync-buk-employees.mjs` ahora valida explícitamente `SUPABASE_SERVICE_ROLE_KEY`, normaliza el contrato de URL de Supabase y deja un resumen final más útil (`pagesProcessed`, `synced`, `finalCount`, `activeCount`) para auditoría operativa.
- La causa raíz de los “runs verdes” sin actualización real era la validación por `LOCAL_HOUR=20`: si GitHub ejecutaba el cron con retraso, el job quedaba en éxito pero omitía la sincronización. La lógica ahora decide por `github.event.schedule` + offset real de `America/Santiago`, no por la hora tardía de arranque del runner.

## Revisión y consolidación de documentación post-auditoría

- [x] Verificar que `todo.md` refleje todos los cambios aplicados por la auditoría de otro modelo
- [x] Verificar que `lessons.md` tenga las lecciones correctas sin duplicados ni corrupción
- [x] Confirmar que los archivos creados por la auditoría (`logger.ts`, `transformers.ts`, `types/index.ts`) existen en el repo
- [x] Registrar la Lección 56 como regla fundacional permanente: revisar ambos documentos antes de cualquier acción
- [x] Validar compilación y build

## Resultado de revisión y consolidación post-auditoría

- Los cambios aplicados por el otro modelo son coherentes con el estado del repo: `logger.ts` existe en `src/shared/lib/`, los tipos de Operaciones están en `src/modules/operaciones/types/index.ts` y los transformadores en `src/modules/operaciones/lib/transformers.ts`.
- `lessons.md` quedó limpio: 56 lecciones numeradas sin duplicados, sin líneas corruptas y sin referencias rotas.
- `todo.md` tiene una referencia histórica a `DashboardNewsRow` en el resultado de saneamiento (línea 14); es válida como registro de lo que se hizo en ese momento, aunque el archivo ya no exista.
- La Lección 56 queda como regla fundacional: todo agente, modelo o sesión debe leer ambos documentos antes de tocar cualquier parte del repositorio.

## Saneamiento guiado por auditoría: logs, tipos y encapsulamiento UI

- [x] Contrastar la auditoría externa con el estado real del repo y descartar hallazgos ya resueltos
- [x] Introducir un logger seguro compartido y reemplazar logs crudos en Auth y Dashboard
- [x] Extraer tipos y transformadores de Operaciones para reducir `any` en la página principal
- [x] Reemplazar el bloque más repetitivo de estilos inline en `CandidateDetailSidebar.tsx` por clases CSS reutilizables
- [x] Validar con `git diff --check`, `npx tsc -b` y `npm run build`

## Resultado de saneamiento guiado por auditoría

- La auditoría externa estaba parcialmente desfasada: el riesgo original de múltiples `useEffect` sin caché global en dashboard ya no aplica como estaba descrito, porque `useDashboard` ya opera sobre TanStack Query.
- Se agregó `src/shared/lib/logger.ts` y se reemplazaron logs crudos en `AuthContext`, `dashboardService`, `DashboardNewsRow` y `CandidateIntakeForm`, evitando exponer objetos de error completos en producción.
- Operaciones ahora tiene contratos explícitos en `src/modules/operaciones/types/index.ts` y transformadores reutilizables en `src/modules/operaciones/lib/transformers.ts`, reduciendo `any` en `OperacionesDashboard.tsx`, `OperationsSummary.tsx`, `OperationsExport.tsx` y `OperationsBaseRegister.tsx`.
- `validateServiceEntryPayload(...)` dejó de aceptar `any` y ahora trabaja sobre `unknown` + narrowing explícito.
- `CandidateDetailSidebar.tsx` dejó de concentrar el bloque más repetitivo de estilos inline: edición de licencia, entrevista e historial ahora usan clases reutilizables en `src/styles/global.css`.
- `DashboardInfoCards.tsx` también dejó de usar estilos inline residuales en la tarjeta de cumpleaños; el patrón de layout ahora queda centralizado en `dashboard.css`.

## Fila superior del Dashboard: tarjetas informativas útiles

- [x] Auditar la integración actual con BUK y formalizar el contrato local de `employees` para próximos cumpleaños
- [x] Extender la sincronización BUK para persistir fecha de nacimiento cuando exista en el payload
- [x] Crear una RPC `get_upcoming_birthdays(...)` basada en la tabla local `employees`
- [x] Implementar una fila superior de 4 tarjetas reales en Inicio, sin placeholders
- [x] Validar build, revisar contraste/responsive y documentar el patrón

## Resultado de fila superior del Dashboard: tarjetas informativas útiles

- El inicio ahora tiene una fila superior compacta con cuatro tarjetas reales: clima operativo, tareas personales pendientes, aprobaciones en curso y cumpleaños próximos.
- Los cumpleaños no salen directo de BUK desde el navegador; se leen desde la tabla local `employees`, que ahora queda formalizada en el repo y alimentada por la sincronización existente.
- `scripts/sync-buk-employees.mjs` se extendió para capturar `birth_date` desde el payload de BUK cuando esté disponible, evitando crear una integración paralela solo para cumpleaños.
- La RPC `get_upcoming_birthdays(...)` centraliza permisos y cálculo de próximos cumpleaños en backend, manteniendo el dashboard liviano y sin lógica duplicada en React.
- La validación técnica quedó cerrada con `git diff --check`, `npx tsc -b` y `npm run build`; la validación funcional final depende de aplicar la migración y volver a correr la sincronización de BUK en el ambiente real.

## Endurecimiento BUK: ficha activa, sincronización diaria y paginación de cumpleaños

- [x] Formalizar una fuente canónica de empleados activos para evitar duplicidad por múltiples fichas
- [x] Hacer que cumpleaños y otros consumos operativos lean solo la ficha activa vigente
- [x] Ajustar la automatización BUK para ejecutarse diariamente a las 20:00 hora Chile
- [x] Convertir la tarjeta de cumpleaños en una tarjeta paginable por persona dentro del mismo módulo
- [x] Validar build y dejar el contrato registrado en lecciones

## Resultado de endurecimiento BUK: ficha activa, sincronización diaria y paginación de cumpleaños

- Se formalizó `employees_active_current` como fuente canónica de ficha activa, deduplicando por identidad documental y conservando solo la ficha activa más vigente.
- `get_upcoming_birthdays(...)` y el consumo operativo de conductores en Operaciones ya no leen la tabla cruda `employees`, sino la fuente canónica activa.
- La automatización de BUK existente en GitHub Actions se ajustó para dispararse diariamente a las 20:00 hora Chile, resolviendo explícitamente la diferencia entre UTC y `America/Santiago`.
- La tarjeta de cumpleaños dejó de estar fija en una sola persona: ahora rota automáticamente y permite navegar manualmente entre cumpleañeros dentro de la misma tarjeta.

## Mejora de tarjeta de clima: extremos térmicos y ubicación real

- [x] Replantear la fuente de ubicación del clima para que use geolocalización real del navegador y no datos maestros del ERP
- [x] Extender la tarjeta de clima para mostrar máxima y mínima diaria
- [x] Mostrar la ubicación física detectada en tiempo real y definir fallback explícito si el permiso falla
- [x] Validar build y registrar el contrato operativo del fallback

## Resultado de mejora de tarjeta de clima: extremos térmicos y ubicación real

- La tarjeta de clima ahora muestra temperatura actual, máxima y mínima diaria.
- La ubicación del clima ya no depende de BUK ni de tablas del ERP; se resuelve desde `navigator.geolocation` en el navegador del usuario.
- Si el permiso de ubicación está disponible, la tarjeta muestra la ciudad real detectada y consulta el clima para esas coordenadas. Si el permiso falla o no existe, el sistema cae de forma explícita a `Santiago, CL`.

## Refinamiento de tarjeta de clima: geocodificación inversa y feedback visual

- [x] Reemplazar la geocodificación inversa de Open-Meteo por BigDataCloud para asegurar la resolución confiable de ciudad y código de país
- [x] Exponer la ciudad real detectada en la cabecera del widget, reservando "Santiago, CL" solo para fallbacks de permiso
- [x] Incorporar temas visuales dinámicos sutiles (cálido, frío, lluvioso) basados en la temperatura y código de condición
- [x] Ajustar la respiración visual de la tarjeta elevando el contenedor inferior

## Resultado del refinamiento de tarjeta de clima

- El frontend ahora resuelve la ubicación sin errores de API mediante BigDataCloud.
- El título del widget refleja la ciudad detectada en lugar de quedar estático.
- La tarjeta cambia sutilmente de temperatura visual (frío, calor, lluvia) manteniendo la paleta de colores del ERP.

## Fase 2B.1: capacidades efectivas backend para `Who`

## Limpieza estructural completa de SQL y Supabase

- [x] Inventariar objetos SQL versionados en `supabase/migrations` y scripts sueltos fuera del historial
- [x] Contrastar el consumo real de tablas, vistas, buckets, RPCs y permisos desde el frontend actual
- [x] Inspeccionar el estado vivo de Supabase para detectar objetos huérfanos, redundantes o ya desligados del producto
- [x] Diseñar una limpieza segura que preserve solo el contrato usado por la app actual
- [x] Ejecutar la limpieza en código versionado: migración destructiva para objetos muertos y poda de archivos SQL locales no vigentes
- [x] Validar que el frontend siga compilando y que las RPCs/contratos críticos permanezcan alineados
- [x] Documentar resultado y lecciones nuevas

## Resultado de limpieza estructural completa de SQL y Supabase

- Se auditó el consumo real del frontend y se confirmó que el dashboard ya no usa el catálogo SQL de widgets ni preferencias por usuario; solo mantenía esa dependencia por inercia.
- En Supabase seguían vivos `dashboard_widgets` (5 filas), `user_dashboard_preferences` (0 filas), `notifications` (0 filas) y RPCs no consumidas como `get_dashboard_widgets_for_current_user`, `get_dashboard_alerts`, `get_dashboard_kpis`, `get_home_dashboard_summary` y `get_hiring_control_dashboard`.
- Se simplificó el frontend del inicio para operar con layout estático real, eliminando la lectura de `dashboard_widgets` y `user_dashboard_preferences`.
- Se creó la migración [20260603_170000_drop_unused_dashboard_catalog.sql](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260603_170000_drop_unused_dashboard_catalog.sql:1) para borrar el circuito SQL muerto del dashboard.
- Se eliminaron scripts SQL sueltos no versionados en [supabase](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase): `check_approvals.sql`, `dashboard_admin_fix.sql` y `fix_approval_data.sql`.
- La limpieza fue validada con `git diff --check`, `tsc -b` y `vite build`.

## Corrección de security definer en view de empleados activos

- [x] Corregir `public.employees_active_current` para que use `security_invoker = true`
- [x] Dejar migración versionada sin alterar el contrato funcional de cumpleaños ni Operaciones
- [x] Validar consistencia del cambio

## Resultado de corrección de security definer en view de empleados activos

- El warning de Supabase es válido: `employees_active_current` había quedado como view con semántica de `security definer`, lo que hace que evalúe permisos con el contexto del creador en vez del usuario que consulta.
- Se creó la migración [20260603_175500_fix_employees_active_current_security.sql](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260603_175500_fix_employees_active_current_security.sql:1), que recrea la view con `with (security_invoker = true)` manteniendo exactamente el mismo `SELECT` y el mismo `grant select`.
- Este cambio no altera el contrato funcional del inicio ni de Operaciones: la app sigue consultando `employees_active_current`, solo que ahora la view queda alineada con el modelo de seguridad esperado por Supabase.

## Hardening seguro de grants y RLS en Supabase

- [x] Identificar hallazgos de seguridad que sí eran deuda accidental y no parte deliberada del diseño RPC autenticado
- [x] Corregir grants sobrantes a `anon/public` sobre funciones del schema `public`
- [x] Cerrar helpers internos para que no queden ejecutables por usuarios autenticados cuando no corresponde
- [x] Definir política RLS explícita para `public.employees` sin romper `employees_active_current`
- [x] Aplicar el ajuste en la base viva y revalidar advisors

## Resultado de hardening seguro de grants y RLS en Supabase

- Se aplicó la migración [20260604_103000_harden_function_grants_and_employees_rls.sql](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260604_103000_harden_function_grants_and_employees_rls.sql:1) tanto en el repo como en la base viva.
- `public.set_updated_at()` y `public.normalize_candidate_who_causes(jsonb)` quedaron con `search_path = public`, eliminando los warnings por `function_search_path_mutable`.
- Se revocó `EXECUTE` a `public` y `anon` sobre todas las funciones del schema `public`, cerrando la exposición accidental de RPCs internas por recreaciones sucesivas de funciones.
- Se revocó además `EXECUTE` a `authenticated` sobre helpers internos que la app no invoca directamente (`set_updated_at`, `normalize_candidate_who_causes`, `handle_new_auth_user`, `sync_auth_user_profile`, `protect_profiles_sensitive_columns`, `find_active_candidate_contract_lock`, `open_recruitment_case_from_hiring_request`, `sync_recruitment_case_status`).
- `public.employees` quedó con RLS explícita para `SELECT` autenticado solo en módulos que realmente consumen empleados y sin permisos de escritura para `authenticated`; `anon` perdió todos los permisos sobre esa tabla.
- Tras revalidar Supabase, desaparecieron los hallazgos de `RLS Enabled No Policy`, `Function Search Path Mutable` y todos los `anon_security_definer_function_executable`.
- Los warnings restantes ya son estructurales al diseño actual: RPCs `SECURITY DEFINER` que la app autenticada sí usa, la extensión `unaccent` en `public` y `Leaked Password Protection` desactivado en Auth.

- [x] Diseñar una fuente backend de capacidades sin amarrar la UI a roles duros
- [x] Crear catálogo de capacidades y asignación por rol en Supabase
- [x] Extender `get_my_effective_permissions()` para devolver `capabilities`
- [x] Consumir `capabilities` desde `AuthContext` y exponer helper `hasCapability(...)`
- [x] Validar compilación y dejar el patrón documentado

## Resultado de Fase 2B.1: capacidades efectivas backend para `Who`

- El sistema ya no necesita inferir futuras autorizaciones de `Who` desde nombres de rol en React.
- La base ahora soporta `app_capabilities` y `role_capabilities`, y `get_my_effective_permissions()` devuelve `capabilities` junto con roles y módulos.
- `AuthContext` expone `capabilities` y `hasCapability(...)`, dejando listo el terreno para la aprobación `Who` en el pipeline de candidatos.

## Fase 2B.2: aprobación Who y nuevo pipeline de candidatos

- [x] Confirmar el estado real de candidatos en producción antes de definir el mapeo de etapas
- [x] Crear tabla `candidate_stage_approvals` con trazabilidad y RLS
- [x] Migrar etapas antiguas al nuevo pipeline y crear solicitudes `Who` pendientes donde corresponda
- [x] Modificar `advance_recruitment_candidate_stage(...)` para bloquear saltos no válidos y exigir aprobación `Who`
- [x] Crear `approve_candidate_stage_who(...)`
- [x] Exponer el resumen `Who` en `get_recruitment_case_detail(...)`
- [x] Ajustar frontend mínimo para nuevas etapas y aprobación `Who` desde el sidebar
- [x] Validar compilación y build

## Resultado de Fase 2B.2: aprobación Who y nuevo pipeline de candidatos

- El pipeline de candidatos ya soporta `who_pending`, `who_approved`, `medical_exams` y `document_review` con bloqueo backend real, no solo visual.
- La tabla `candidate_stage_approvals` deja trazabilidad formal de solicitud y aprobación `Who`.
- La aprobación `Who` ya se puede ejecutar desde el sidebar del candidato por un usuario que tenga la capability efectiva correspondiente.
- El detalle del candidato ahora muestra el resumen de la aprobación `Who`, evitando que el estado quede opaco dentro del flujo.

## Corrección de migración Fase 2B.2: orden de endurecimiento del pipeline

- [x] Corregir la migración `20260526_160000_add_candidate_who_approval_pipeline.sql` para no endurecer `stage_code` antes del backfill
- [x] Verificar que el orden seguro sea: liberar constraint antiguo, migrar datos vivos, insertar aprobaciones pendientes y recién entonces agregar el nuevo check
- [x] Validar consistencia del repo y dejar la lección registrada

## Resultado de corrección de migración Fase 2B.2

- La falla `23514` venía de endurecer el `CHECK` de `recruitment_case_candidates.stage_code` antes de remapear filas históricas con etapas antiguas (`contacted`, `screening`, `shortlisted`, `documents_pending`).
- La migración ahora sigue el orden correcto: primero elimina el constraint anterior, luego hace el backfill de datos y al final crea el nuevo `recruitment_case_candidates_stage_code_check`.
- Con este orden, la misma migración puede correr sobre datos vivos sin romperse por estados intermedios incompatibles.
- Se detectó además un segundo constraint legacy activo en algunos ambientes, `recruitment_case_candidates_stage_check`, que también debe eliminarse antes del backfill porque rechaza etapas nuevas como `who_pending`.

## Integración de aprobaciones Who en dashboard

- [x] Confirmar si `Tareas Pendientes` y `Seguimiento de aprobaciones` estaban leyendo `candidate_stage_approvals`
- [x] Extender `get_dashboard_tasks(...)` para incluir aprobaciones `Who` pendientes cuando el usuario tenga la capability correspondiente
- [x] Extender `get_dashboard_approval_tracking()` para incluir `Who` pendiente como parte del seguimiento global
- [x] Ajustar los widgets del dashboard para mostrar y aprobar `Who` desde Inicio
- [x] Validar compilación y build

## Resultado de integración de aprobaciones Who en dashboard

- El dashboard ya no trata `Who` como un detalle escondido solo dentro de Reclutamiento.
- `Tareas Pendientes` ahora incluye `candidate_stage_approvals` en estado `pending` para usuarios con `can_approve_who_stage`.
- `Seguimiento de aprobaciones` también muestra las solicitudes `Who` pendientes junto con las aprobaciones de folio.
- La aprobación `Who` ya se puede resolver desde el propio Inicio, sin obligar al usuario a navegar a otra pantalla para una tarea que ya apareció como pendiente.

## Estructuración de causas Who y limpieza del detalle operativo

- [x] Reemplazar el comentario plano de solicitud `Who` por una estructura de hasta 4 causas con tipo, año y comentario
- [x] Capturar las causas en `Control de Contrataciones` antes de enviar a `who_pending`, en un bloque compacto
- [x] Guardar las causas en backend y exponerlas en el detalle del candidato y en el dashboard
- [x] Ajustar `Tareas Pendientes` y `Seguimiento de aprobaciones` para que una aprobación `Who` muestre el resumen de causas, no la solicitud completa del folio
- [x] Validar compilación y build

## Resultado de estructuración de causas Who y limpieza del detalle operativo

- `Who` ya no depende de un comentario libre para describir hallazgos; ahora guarda hasta 4 causas estructuradas con tipo (`laboral`, `penal`, `civil`), año y comentario.
- La captura de esas causas vive pegada a la acción de mover a `Who Pendiente`, en un cuadro compacto y colapsable para no ensuciar el sidebar.
- El detalle expandido en `Inicio` ahora diferencia correctamente entre aprobaciones de folio y aprobaciones `Who`: mantiene la fila resumen arriba, pero al desplegar `Who` muestra el resumen de causas y la observación general, no la solicitud contractual completa.

## Deuda visible del dashboard: affordances muertas

- [x] Auditar los botones sin función visibles en `Inicio` (`Acciones Rápidas`, kebab de widgets y affordances equivalentes)
- [x] Retirar del layout principal cualquier botón o menú que hoy no tenga contrato operativo real
- [x] Reemplazar esas entradas por un único botón flotante colapsable en la esquina superior derecha del dashboard
- [x] Dejar las opciones futuras visibles como backlog no operativo, sin clicks rotos
- [ ] Validar en Cloudflare el layout final antes de retomar Fase 2C

## Resultado de deuda visible del dashboard: affordances muertas

- El dashboard dejó de exponer botones clickeables sin comportamiento, que los testers venían reportando como fallas del sistema.
- `Acciones Rápidas` salió del layout principal y las opciones futuras quedaron consolidadas en un único menú flotante colapsable en la esquina superior derecha.
- Las opciones del menú quedaron visibles como backlog operativo, pero no ejecutables, evitando nuevas falsas expectativas en QA mientras se programa su lógica real.

## Refinamiento visual del launcher de acciones rápidas

- [x] Reemplazar el botón flotante textual por un launcher compacto tipo asistente flotante
- [x] Hacer que el menú se abra por hover o clic, anclado al icono en la esquina superior derecha
- [ ] Validar visualmente en Cloudflare que el launcher no compita con el encabezado ni tape navegación

## Resultado de refinamiento visual del launcher de acciones rápidas

- El dashboard ya no muestra un botón textual de backlog en la cabecera; ahora usa un launcher compacto de icono único.
- El panel de acciones rápidas se despliega al pasar el cursor o hacer clic sobre el icono, alineándose mejor con la referencia visual pedida por el usuario.

## Aterrizaje de plan externo Fase 2B y 2C

- [x] Revisar `implementation_plan.md` contra la arquitectura real del repo y del backend activo
- [x] Corregir supuestos falsos del plan externo (`Kanban`, modal inexistente, permisos por rol duro)
- [x] Dejar un plan implementable en `docs/reclutamiento-operaciones-fase2-plan.md`

## Resultado de aterrizaje de plan externo Fase 2B y 2C

- El plan de `Who` y `Ficha del Trabajador` quedó reescrito sobre las piezas reales del sistema: `HiringCandidatesView`, `CandidateDetailSidebar`, `advance_recruitment_candidate_stage(...)` y `get_my_effective_permissions()`.
- Se descartó explícitamente construir superficies paralelas que hoy no existen, como un Kanban nuevo o un modal de detalle alternativo.
- El aterrizaje fija una secuencia técnica realista: primero capabilities backend, luego aprobación `Who`, luego ficha del trabajador.

## Paquete de saneamiento ERP: datos útiles y rendimiento

- [x] Auditar desalineaciones reales entre código, esquema y datos vivos de contrataciones/reclutamiento
- [x] Crear una migración de saneamiento segura para normalizar requester data, recuperar `travel_methodology` desde auditoría cuando exista y agregar índices útiles
- [x] Reducir trabajo inútil del dashboard eliminando fetches no usados y código muerto asociado
- [x] Validar con consultas reales, TypeScript y build; dejar reglas permanentes en lecciones

## Resultado de paquete de saneamiento ERP: datos útiles y rendimiento

- La base viva se auditó contra el código y se confirmó que la suciedad real actual es acotada: un `requester_name` no canónico (`folio 0005`) y un histórico aprobado con `pasajes=true` pero sin `travel_methodology` (`folio 0007`).
- La migración `20260526_140000_erp_data_hygiene_and_dashboard_perf.sql` normaliza `requester_name/requester_email` desde `profiles`, intenta recuperar `travel_methodology` solo desde auditoría real, agrega índices útiles para aprobaciones y casos, y desactiva widgets operativos que ya no se usan (`AlertsWidget`, `KPIWidget`, `TimelineWidget`) limpiando además sus preferencias huérfanas.
- El dashboard dejó de arrastrar contrato y código muerto para notificaciones, alertas y KPIs no renderizados. Se simplificó `DashboardDataBundle`, se removieron fetches sin consumidor y se eliminaron componentes frontend sin uso.
- La validación quedó cerrada con consulta real a Supabase, `git diff --check`, `npx tsc -b` y `npm run build`.

## Exposición de error real en recuperación de contraseña

- [x] Revisar por qué la pantalla de login oculta el mensaje real de fallo al pedir recuperación
- [x] Mostrar el error devuelto por `sendPasswordReset` en vez de un mensaje genérico
- [x] Validar compilación y documentar la regla en lecciones

## Corrección de metodología de pasajes por etapa de aprobación

- [x] Revisar por qué el selector de metodología de pasajes aparece también en aprobaciones de área
- [x] Corregir el contrato de tareas y detalle de aprobación para exponer la etapa real (`step_code`)
- [x] Restringir la UI de metodología de pasajes solo a `contracts_control`
- [x] Validar compilación y documentar la regla en lecciones

## Seguimiento global de aprobaciones en dashboard

- [x] Diseñar una sección separada para folios pendientes de aprobación, ubicada entre `Tareas Pendientes` y `Folios en curso`
- [x] Publicar una RPC de seguimiento global de aprobaciones con acceso controlado desde backend
- [x] Integrar el nuevo bloque en el dashboard, con búsqueda y estado visible del folio en aprobación
- [x] Validar compilación y dejar la regla documentada en lecciones

## Corrección de bandeja personal de aprobaciones en dashboard

- [x] Revisar por qué un folio aprobado sigue visible en `Tareas Pendientes` para el administrador
- [x] Corregir `get_dashboard_tasks(...)` para que la bandeja muestre solo aprobaciones asignadas al usuario autenticado
- [x] Validar que el dashboard siga compilando y documentar la regla en lecciones

## Corrección de recuperación de contraseña en producción

- [x] Revisar el flujo de recuperación y descartar hardcodes a `localhost` en el repo
- [x] Hacer explícita la URL pública de la app mediante `VITE_PUBLIC_APP_URL`
- [x] Documentar la dependencia entre recuperación de contraseña, Cloudflare Pages y configuración de Supabase Auth

## Resultado de corrección de recuperación de contraseña en producción

- `sendPasswordReset` ahora prioriza `VITE_PUBLIC_APP_URL` para construir la URL de recuperación.
- Se documentó el despliegue con la variable `VITE_PUBLIC_APP_URL` y la validación de `Authentication > URL Configuration` en Supabase.
- El problema observado con `localhost:3000` queda identificado como desalineación de ambiente y no como una ruta hardcodeada activa en el repo.

## Resultado de corrección de bandeja personal de aprobaciones en dashboard

- La causa raíz identificada fue semántica: `get_dashboard_tasks(...)` mezclaba la bandeja personal con el bypass administrativo, por lo que un admin seguía viendo en pendientes el siguiente paso del mismo folio después de aprobar.
- La corrección mueve `Tareas Pendientes` a un contrato explícitamente personal: solo devuelve aprobaciones con `approver_user_id = p_user_id`.
- El bypass administrativo se mantiene para otras lecturas/acciones seguras, pero deja de contaminar la bandeja diaria del usuario.

## Resultado de seguimiento global de aprobaciones en dashboard

- El dashboard ahora separa explícitamente tres dominios: trabajo personal pendiente, seguimiento global de aprobaciones y folios ya abiertos en reclutamiento.
- `Seguimiento de aprobaciones` queda entre `Tareas Pendientes` y `Folios en curso`, con búsqueda propia y estado visible del paso actual.
- La nueva vista global no reusa la RPC personal de tareas; usa un contrato backend específico para evitar volver a mezclar bandeja personal con seguimiento transversal.

## Resultado de corrección de metodología de pasajes por etapa de aprobación

- La causa raíz fue un contrato incompleto: la UI solo recibía `pasajes = true`, pero no la etapa real de aprobación.
- `step_code` ahora queda expuesto en tareas y en el detalle de aprobación para que el frontend pueda distinguir `area_manager` de `contracts_control`.
- La selección de `metodología de pasajes` solo se muestra y exige en la etapa `contracts_control`, que es el comportamiento de negocio correcto.

## Resultado de exposición de error real en recuperación de contraseña

- La pantalla de login dejaba ciego el diagnóstico al reemplazar cualquier error de Supabase por un texto fijo.
- Ahora el flujo muestra el mensaje real devuelto por `sendPasswordReset`, lo que permite distinguir entre problemas de configuración de URLs, templates, correo o límites del proveedor.

## Resultado de paquete de saneamiento ERP: datos útiles y rendimiento

- Se normaliza `requester_name` y `requester_email` desde `profiles` cuando existe un vínculo real por `requester_id` o `submitted_by`, eliminando valores inconsistentes de baja calidad.
- `travel_methodology` solo se backfillea cuando ya existe en auditoría; no se inventan valores de negocio para históricos.
- Se agregan índices para las consultas críticas del flujo de aprobaciones y casos de reclutamiento, reduciendo scans evitables.
- El dashboard deja de consultar notificaciones que hoy no se muestran, reduciendo carga remota y líneas sin valor operativo.

## Ajuste puntual de acceso administrativo

- [x] Revisar el modelo actual de acceso administrativo (`profiles.is_super_admin` + `user_roles`)
- [x] Crear una migración de datos para equiparar el acceso de Maria Jesus con el administrador del sistema

## Resultado del ajuste puntual de acceso administrativo

- Se creó la migración [20260526_000100_grant_maria_jesus_admin_parity.sql](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260526_000100_grant_maria_jesus_admin_parity.sql:1).
- La migración busca el perfil fuente de `Maximiliano Contreras Rey`, localiza el perfil destino de `Maria Jesus Lagos` o `Maria Jesus Lagos Minardi`, activa su perfil y replica sus roles activos.
- También iguala el flag `is_super_admin` para que el acceso efectivo quede en paridad con el administrador del sistema.

## Fase 2C: Ficha del Trabajador

- [x] Extender `candidate_profiles` solo con datos permanentes útiles para operación y pago
- [x] Crear `candidate_worker_files` ligada a `recruitment_case_candidates` para datos del ingreso actual
- [x] Publicar RPCs separadas para actualizar datos permanentes y ficha transaccional con validación por caso
- [x] Extender `get_recruitment_case_detail(...)` para devolver la ficha completa del candidato seleccionado
- [x] Agregar tercera pestaña `Ficha del candidato` en `CandidateDetailSidebar`
- [x] Validar compilación, build y dejar lecciones registradas

## Validación en vivo de historial de candidatos en BUK

- [x] Crear Supabase Edge Function `check_buk_candidate` para proteger `BUK_AUTH_TOKEN`.
- [x] Ajustar Frontend para consumir Edge Function y parsear respuestas correctamente.
- [x] Mostrar alerta visual automática 🔴/🟡 según estado del candidato en BUK.

## Mejoras de Rechazo e Historial en Control de Candidatos

- [x] **Alerta Histórica:** Crear función `find_candidate_profile_with_history_by_rut` para mostrar descartes previos en `CandidateIntakeForm`.
- [x] **Comentario Obligatorio:** Bloquear transición de base de datos y UI hacia etapa "Descartado" sin proveer un motivo claro en `HiringCandidatesView`.
- [x] **Rechazo Who Activo:** Crear `reject_candidate_stage_who` para permitir a gerencia rechazar antecedentes y descartar automáticamente con "Rechazado por Gerencia por antecedentes Who" en `TasksWidget` y el Sidebar de Detalle.

## Resultado de validación en vivo de historial de candidatos en BUK

- El alta de candidatos ya no depende solo del maestro local: `CandidateIntakeForm` consulta en paralelo el perfil interno por RUT y la Edge Function `check_buk_candidate`.
- La verificación contra BUK quedó encapsulada del lado servidor en [check_buk_candidate](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/check_buk_candidate/index.ts:1), protegiendo `BUK_AUTH_TOKEN` y evitando cualquier llamada directa del navegador a la API privada.
- Si el RUT ya existe en BUK, el formulario muestra una alerta visual inmediata diferenciando estado activo/inactivo, para que Reclutamiento detecte reingresos o riesgos antes de crear la participación.

## Resultado de mejoras de rechazo e historial en Control de Candidatos

- La búsqueda por RUT ahora usa `find_candidate_profile_with_history_by_rut(...)`, de modo que el reclutador ve descartes y retiros previos del mismo candidato antes de ingresarlo nuevamente al proceso.
- El descarte manual dejó de aceptar comentarios vacíos: la regla vive en la RPC `advance_recruitment_candidate_stage(...)` y cubre tanto `rejected` como `withdrawn`.
- La aprobación `Who` ya no solo se puede aprobar; también se puede rechazar desde la UI operativa mediante `reject_candidate_stage_who(...)`.
- El fix final del flujo `Who` corrigió dos puntos críticos de backend: el audit log ahora registra `candidate_stage_approval_rejected` en vez de reciclar el action type de aprobación, y el movimiento a `rejected` ocurre dentro de la propia RPC, sin delegar a una transición genérica que exigía otro dominio de permisos.

## Resultado de Fase 2C: Ficha del candidato

- La ficha quedó separada en dos capas útiles: datos personales persistentes en `candidate_profiles` y datos del ingreso actual en `candidate_worker_files`.
- La escritura se hace por dos RPCs seguras (`upsert_candidate_person_profile(...)` y `upsert_candidate_worker_file(...)`) usando `p_case_candidate_id` para validar acceso real al caso.
- El detalle del caso ahora devuelve toda la ficha del candidato dentro del mismo `get_recruitment_case_detail(...)`, evitando una segunda fuente de verdad para el sidebar.
- `CandidateDetailSidebar` ahora tiene una tercera pestaña `Ficha del candidato`, con guardado independiente para ficha personal y ficha del ingreso actual.
- La parte transaccional no crea filas vacías: si el bloque del ingreso actual se guarda completamente en blanco, la ficha asociada no persiste basura en `candidate_worker_files`.

## Plan de trabajo vigente: Reclutamiento y Operaciones Fase 2

- [x] Contrastar el plan externo con la arquitectura real del repo
- [x] Versionar un plan técnico corregido en [docs/reclutamiento-operaciones-fase2-plan.md](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/docs/reclutamiento-operaciones-fase2-plan.md:1)
- [x] Ejecutar Fase 2A: metodología de pasajes en aprobación final
- [ ] Ejecutar Fase 2B: nuevo pipeline de candidatos con aprobación `Who`
- [ ] Ejecutar Fase 2C: tercera pestaña `Ficha del Trabajador`

## Resultado de alineación del plan Fase 2

- El plan externo se mantuvo como intención funcional, pero se corrigió para aterrizarlo sobre la arquitectura real del sistema.
- No se implementarán componentes paralelos inexistentes como `CandidateBoard.tsx` o `CandidateDetailModal.tsx`; los cambios se montarán sobre `TasksWidget`, `ApprovalModal`, `HiringCandidatesView` y `CandidateDetailSidebar`.
- Se definió que `ready_for_hire` y `hired` siguen existiendo como etapas terminales, y que la aprobación `Who` debe llevar trazabilidad formal en backend.
- La `Ficha del Trabajador` quedó separada conceptualmente entre datos persistentes de persona y datos específicos de la postulación o ingreso actual.

## Resultado de Fase 2A: metodología de pasajes

- Se creó la migración [20260525_233500_add_travel_methodology_to_hiring_approval.sql](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260525_233500_add_travel_methodology_to_hiring_approval.sql:1).
- `hiring_requests` ahora soporta `travel_methodology` con códigos estables de negocio.
- `decide_hiring_request_approval_v2(...)` exige metodología de pasajes cuando Control de Contratos aprueba un folio con `pasajes = true`.
- La exigencia quedó reflejada tanto en `ApprovalModal` como en `TasksWidget`, evitando bypass entre superficies de aprobación.
- La metodología también quedó expuesta en el detalle de aprobación y en el payload de tareas pendientes.

## Fase ERP Core 2: Permisos efectivos desde backend

- [x] Diseñar un contrato único de permisos efectivos basado en `auth.uid()`
- [x] Publicar una RPC que devuelva perfil, roles y módulos accesibles en una sola respuesta
- [x] Migrar `AuthContext` para consumir la RPC y dejar de reconstruir permisos con lecturas separadas
- [x] Remover derivaciones redundantes de permisos en el dashboard donde el backend ya resuelve acceso

## Resultado de Fase ERP Core 2: Permisos efectivos desde backend

- `AuthContext` ya no consulta `profiles`, `user_roles`, `app_modules` y `role_module_access` por separado para armar acceso.
- La nueva RPC [20260525_231500_get_my_effective_permissions.sql](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260525_231500_get_my_effective_permissions.sql:1) devuelve el contrato efectivo de autorización para el usuario autenticado, usando `auth.uid()` como única identidad válida.
- El frontend conserva `access.ts` como capa de tipado y normalización, pero la autoridad operativa de roles y módulos queda centralizada en backend.
- El dashboard dejó de filtrar widgets por roles en cliente cuando la RPC ya entrega el catálogo resuelto para el usuario actual.

## Fase ERP Core 1: Estado remoto del dashboard

- [x] Instalar TanStack Query como base de estado asíncrono compartido
- [x] Envolver la aplicación con `QueryClientProvider`
- [x] Migrar `useDashboard` desde `useState + refresh()` manual a queries/mutations con invalidación
- [x] Dejar preparado el siguiente paso de permisos efectivos desde backend sin tocar todavía la lógica de acceso

## Resultado de Fase ERP Core 1: Estado remoto del dashboard

- El dashboard ya no depende de un ciclo manual de `useState + Promise.all + refresh()` para su carga principal.
- `useDashboard` ahora usa TanStack Query para resolver widgets, tareas, folios activos y notificaciones en una sola query con caché.
- Las preferencias de visibilidad de widgets ya usan mutation con update optimista e invalidación posterior.
- `main.tsx` quedó preparado con `QueryClientProvider` para extender el patrón a Reclutamiento, Operaciones y Certificados.

## Reparación ERP de Dashboard, Roles y Gobernanza

- [x] Alinear roles reales del frontend con los roles usados por dashboard y migraciones
- [x] Endurecer RPCs del dashboard para que validen `auth.uid()` y no acepten consultas impersonadas
- [x] Corregir el motor SQL del dashboard al esquema real de candidatos y documentos
- [x] Reemplazar estilos inline críticos y tipados laxos en widgets del dashboard por componentes reutilizables
- [x] Dejar migración versionada con grants y `notify pgrst` para convergencia segura entre ambientes

## Resultado de reparación ERP de Dashboard, Roles y Gobernanza

- `access.ts` ahora reconoce `operaciones` y `gerencia`, alineando el frontend con los roles ya usados por dashboard y por las migraciones.
- Se creó [20260525_140000_harden_dashboard_engine_and_roles.sql](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260525_140000_harden_dashboard_engine_and_roles.sql:1) para:
  - publicar `get_dashboard_widgets_for_current_user()`
  - blindar `get_dashboard_tasks(...)`, `get_dashboard_alerts(...)` y `get_dashboard_kpis(...)` con validación de `auth.uid()`
  - corregir el uso de `candidate_profiles.full_name`
  - reemplazar estados inexistentes como `closed`
  - agregar grants explícitos y `notify pgrst, 'reload schema'`
- El dashboard dejó de depender de estructuras `any` para tareas, alertas e indicadores, y ahora usa contratos tipados en `src/modules/dashboard/types/`.
- Se extrajo `DashboardWidgetFrame` para reutilizar el contenedor y cabecera de widgets, reduciendo duplicación.
- `DashboardGrid` y los widgets críticos dejaron de depender de estilos inline para layout base, vacíos, prioridad y acciones.

## Reparación ERP de detalle de aprobaciones

- [x] Reemplazar lectura directa desde `hiring_request_approvals` por una RPC segura para el modal de detalle del folio
- [x] Publicar la RPC con `grant execute` y `notify pgrst`

## Resultado de reparación ERP de detalle de aprobaciones

- Se creó [20260525_161159_add_get_hiring_approval_detail_rpc.sql](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260525_161159_add_get_hiring_approval_detail_rpc.sql:1) para centralizar el detalle del folio en `get_hiring_approval_detail(...)`.
- `getHiringApprovalDetails(...)` ya no consulta tablas operacionales directo desde el cliente; ahora usa la RPC y conserva el formato de error consistente.

## Ajuste ERP de layout del dashboard operativo

- [x] Expandir `Tareas Pendientes` a ancho completo para eliminar scroll horizontal innecesario
- [x] Reubicar `Alertas Operacionales` debajo de `Acciones Rápidas`
- [x] Eliminar `Actividad Reciente` del layout principal por falta de utilidad operacional directa

## Resultado de ajuste ERP de layout del dashboard operativo

- `Tareas Pendientes` pasa a ser la bandeja dominante del dashboard y usa todo el eje horizontal disponible.
- `Alertas Operacionales` deja de competir en la cabecera con la bandeja principal y baja a la columna secundaria junto a `Acciones Rápidas`.
- `Actividad Reciente` sale del dashboard para evitar ruido visual y widgets sin valor operativo inmediato.

## Ajuste ERP de legibilidad del dashboard operativo

- [x] Eliminar scroll horizontal de `Tareas Pendientes` ajustando el reparto interno de columnas
- [x] Limpiar el modal de aprobación removiendo el correo del solicitante
- [x] Aumentar la separación entre la bandeja principal y los widgets secundarios
- [x] Igualar visualmente la altura de `Indicadores Clave` y `Acciones Rápidas`

## Resultado de ajuste ERP de legibilidad del dashboard operativo

- `Tareas Pendientes` ahora distribuye mejor el espacio y muestra todo el contenido dentro del contenedor sin depender de scroll horizontal.
- El modal flotante del folio quedó más limpio al remover el correo del solicitante del bloque visible.
- La distancia vertical entre la bandeja principal y los widgets secundarios aumentó para reforzar jerarquía visual.
- `Indicadores Clave` y `Acciones Rápidas` se renderizan con una altura base equivalente para evitar desequilibrio visual.

## Ajuste ERP del inicio del dashboard

- [x] Eliminar el bloque superior `Centro Operacional • ...`
- [x] Remover `Alertas Operacionales` del inicio del dashboard

## Resultado de ajuste ERP del inicio del dashboard

- El dashboard abre con un encabezado más limpio, centrado en el saludo y el resumen operativo.
- `Alertas Operacionales` deja de ocupar espacio en el inicio, manteniendo el foco visual en `Tareas Pendientes`, `Indicadores Clave` y `Acciones Rápidas`.

## Reparación ERP de contrato de tareas del dashboard

- [x] Alinear `get_dashboard_tasks(...)` con el payload real que consume la tabla expandible
- [x] Restaurar `Indicadores Clave` en el layout secundario del dashboard
- [x] Tipar la tabla expandible de tareas y sacar estilos inline de las acciones integradas

## Resultado de reparación ERP de contrato de tareas del dashboard

- La bandeja `Tareas Pendientes` vuelve a mostrar la solicitud completa porque la RPC entrega folio, cargo, contrato, solicitante, cupos y fechas reales.
- `Indicadores Clave` reaparece en el dashboard como columna par de `Acciones Rápidas`.
- La tabla expandible de tareas quedó alineada a un contrato tipado y sin depender de estilos inline para el bloque de aprobación.

## Ajuste ERP de foco operativo del dashboard

- [x] Retirar `Indicadores Clave` del dashboard actual por falta de utilidad inmediata

## Resultado de ajuste ERP de foco operativo del dashboard

- El dashboard queda concentrado en `Tareas Pendientes` y `Acciones Rápidas`, sin reservar espacio para KPIs que hoy no soportan una decisión operativa directa.

## Separación ERP entre pendientes y folios activos

- [x] Dejar `Tareas Pendientes` solo con aprobaciones pendientes
- [x] Crear `Folios en curso` con búsqueda y formato expandible consistente
- [x] Reutilizar el detalle de caso real para que un folio aprobado baje de pendientes a la bandeja de activos

## Resultado de separación ERP entre pendientes y folios activos

- `Tareas Pendientes` ahora muestra solo solicitudes pendientes de aprobación.
- `Folios en curso` aparece como sección independiente con búsqueda y usa el mismo lenguaje visual de la bandeja principal.
- Al aprobar un folio, sale de pendientes y pasa a la bandeja de casos activos según el estado operativo que le corresponda.

## Ajuste ERP de jerarquía visual entre pendientes y folios activos

- [x] Mover `Folios en curso` inmediatamente debajo de `Tareas Pendientes`
- [x] Dejar `Acciones Rápidas` después de las dos bandejas operativas para no ocultar seguimiento real

## Resultado de ajuste ERP de jerarquía visual entre pendientes y folios activos

- `Folios en curso` ya no queda escondido debajo de widgets secundarios.
- El dashboard presenta primero trabajo pendiente de decisión y luego seguimiento de folios activos, que es la secuencia operacional correcta.

## Ajuste ERP de utilidad en bandeja de aprobaciones

- [x] Eliminar métricas de candidatos desde `Tareas Pendientes` porque una solicitud no aprobada aún no entra al funnel operativo
- [x] Compactar `Contrato / CC` en una sola línea para mejorar legibilidad de la bandeja
- [x] Exponer en el detalle de `Folios en curso` el comentario y trazabilidad de la decisión de aprobación

## Resultado de ajuste ERP de utilidad en bandeja de aprobaciones

- `Tareas Pendientes` ahora muestra solo información relevante para decidir la aprobación.
- El comentario ingresado al aprobar o rechazar deja de ser un dato oculto: queda visible luego en el detalle del folio activo junto con quién resolvió y cuándo.

## Ajuste ERP de continuidad entre aprobación y selección

- [x] Exponer la decisión de aprobación dentro del detalle de `Resumen de procesos de contratación`

## Resultado de ajuste ERP de continuidad entre aprobación y selección

- Reclutamiento puede ver en `Control de Contrataciones > Resumen de procesos de contratación` la etapa aprobada, la resolución, quién la tomó, cuándo y el comentario asociado, sin salir del flujo operativo.

## Ajuste ERP de aging para folios activos

- [x] Reemplazar la columna de solicitante por `Días Abierto` en `Folios en curso`

## Resultado de ajuste ERP de aging para folios activos

- `Folios en curso` ahora expone cuántos días lleva abierto cada folio desde la aprobación de Control de Contratos, usando `opened_at` como base operativa.

## Ajuste ERP de respiración visual entre módulos del dashboard

- [x] Aumentar la separación vertical entre `Tareas Pendientes`, `Folios en curso` y `Acciones Rápidas`

## Resultado de ajuste ERP de respiración visual entre módulos del dashboard

- El dashboard deja más aire entre bandejas operativas para que cada módulo se lea como bloque independiente y no como una sola masa continua.

## Corrección de separación visible entre módulos del dashboard

- [x] Reemplazar el espaciado sutil basado en variables por una separación explícita y mayor entre módulos principales

## Resultado de corrección de separación visible entre módulos del dashboard

- La separación entre `Tareas Pendientes`, `Folios en curso` y `Acciones Rápidas` ahora depende de un margen explícito entre bloques, para que la distancia se perciba claramente en pantalla.

## Corrección de consistencia de separación entre todos los módulos

- [x] Aplicar la misma clase de separación a `Tareas Pendientes`, `Folios en curso` y `Acciones Rápidas`

## Resultado de corrección de consistencia de separación entre todos los módulos

- Los tres bloques principales del dashboard ahora comparten la misma regla explícita de separación, en vez de depender de comportamiento implícito del grid.

## Corrección final de separación uniforme entre módulos principales

- [x] Reemplazar la separación basada en márgenes por `row-gap` explícito en el contenedor principal del dashboard

## Resultado de corrección final de separación uniforme entre módulos principales

- La distancia entre `Tareas Pendientes`, `Folios en curso` y `Acciones Rápidas` ahora la controla una sola regla de `row-gap`, evitando diferencias visuales entre bloques.

## Refinamientos estéticos y UX en el Dashboard

- [x] Ajustar estética de la tarjeta de Solicitud de Contrataciones reduciendo tamaño y grosor
- [x] Uniformar separación vertical (row-gap y margin-bottom a 18px) entre todos los módulos del Dashboard
- [x] Validar que no hay estilos inline y que CSS es elegante y consistente

## Eliminación completa del módulo de noticias externas

- [x] Eliminar componente frontend `DashboardNewsRow.tsx`
- [x] Eliminar import y uso de `DashboardNewsWidget` en `DashboardInfoCards.tsx`
- [x] Eliminar bloque CSS completo de `.dashboard-news-*` en `dashboard.css`
- [x] Eliminar script de sincronización `scripts/sync-gnews.mjs`
- [x] Eliminar flujo de GitHub Actions `.github/workflows/sync-gnews.yml`
- [x] Crear migración SQL para eliminar tabla `global_news`, función `get_home_news()`, policies e índices
- [x] Validar compilación y build sin vestigios de noticias

## Resultado de eliminación del módulo de noticias externas

- El ERP dejó de depender de una fuente externa (GNews API) para poblar el dashboard, alineándose con la directiva de mostrar solo información operativa interna.
- Se eliminaron los 3 archivos principales del módulo: componente React, script de sincronización y workflow de GitHub Actions.
- Se eliminaron ~145 líneas de CSS exclusivas del widget de noticias.
- La migración `20260530_110500_drop_global_news.sql` elimina la función `get_home_news()`, la policy de lectura, los índices y la tabla `global_news` de Supabase.
- La fila superior del dashboard queda con 2 tarjetas operativas (Clima y Cumpleaños) y espacio libre para futuras tarjetas internas.

Este documento lleva el control de las tareas técnicas orientadas a construir la plataforma según el **Mapa Operacional Maestro**.

## Roadmap Actual: Gobernanza y Estabilización

- [x] **Fase 1**: Refactor de Operaciones (Remover cambio contraseña inerte).
- [x] **Fase 1**: Seguridad Zero Trust (Protección de `public.profiles` en BD).
- [x] **Fase 2**: Higiene de Repositorio y Gobernanza (Documentación, limpieza de `.DS_Store`, orden de archivos en `docs/`).
- [x] **Fase 3**: Dashboard Interactivo (Modal de Aprobaciones aislado, Layout optimizado, Tareas vs Alertas).
- [x] **Fase 3**: Estabilización AuthContext (Control de bloqueos infinitos, timeouts de seguridad, Admin Override).

## Próximos Módulos (Backlog)

- [ ] **Módulo Certificados**: Iniciar refactorización y fragmentación de la vista monolítica `CertificatesPage.tsx` hacia una arquitectura modular (`src/modules/certificates/components/`).
- [ ] **Zero Trust para Operaciones**: Implementar una RPC segura (`submit_service_entry`) en base de datos para restringir la escritura directa a `service_entries` desde el frontend, validando los permisos del contrato en backend.

## Aterrizaje de ficha de candidato contra plantilla BUK

- [x] Auditar la hoja `Empleados` y `Listas` de la plantilla BUK y mapear brechas contra la ficha actual
- [x] Extender modelo y RPCs de ficha del candidato para soportar los campos BUK prioritarios sin romper el flujo actual
- [x] Adaptar la UI de `Ficha del candidato` por secciones coherentes con BUK, usando catálogos desplegables reales
- [x] Validar compilación y documentar el mapeo y restricciones detectadas

## Resultado de aterrizaje de ficha de candidato contra plantilla BUK

- La plantilla BUK quedó aterrizada como contrato operativo real de la ficha del candidato: se extrajeron los encabezados y catálogos del Excel a `src/modules/recruitment/lib/bukEmployeeTemplateData.json` y se expusieron vía `bukEmployeeTemplate.ts`.
- Se creó un flujo de lectura dedicado `get_candidate_buk_profile(...)` para no inflar `get_recruitment_case_detail(...)` con decenas de campos de onboarding y payroll que solo usa la ficha.
- `CandidateWorkerFileForm.tsx` ahora captura identidad, contacto, domicilio, estudios, inclusión, previsión, pagos y datos del ingreso actual en dos bloques claros: perfil persistente del candidato e ingreso transaccional del caso.
- Se versionó la migración `20260604_121500_align_candidate_buk_profile.sql` para extender `candidate_profiles`, `candidate_worker_files` y las RPCs `upsert_candidate_person_profile(...)` / `upsert_candidate_worker_file(...)` con el set BUK priorizado.
- La validación técnica local quedó cerrada con `git diff --check`, `npx tsc -b` y `npm run build`.


## Implementación de Modo Oscuro Premium y Refinamiento de UI

- [x] Agregar capacidad de alternar entre modo claro y oscuro desde la barra de navegación superior, persistiendo la preferencia en `localStorage`.
- [x] Sustituir colores duros globales (blancos puros y negros sólidos) por variables dinámicas semánticas (`--surface`, `--surface-soft`, `--text-muted`, `--title`).
- [x] Corregir la persistencia de widgets "brillantes" (blancos con opacidad o colores fijos) reemplazándolos con reglas de `[data-theme="dark"]` y variables RGB.
- [x] Resolver contrastes de tipografía en el módulo de Reclutamiento (widgets de seguimiento, detalles de fichas, chips de aprobación) que quedaban invisibles bajo fondo nocturno.
- [x] Corregir fallos de "flashes blancos" en efectos de `hover` y ajustar opacidades de componentes anidados.
- [x] Validar que el layout no se desarme por inserción de nuevos controles (solucionado grid layout de `top-shell-right`).

## Resultado de la Implementación de Modo Oscuro Premium

- La plataforma cuenta ahora con un interruptor orgánico para Modo Oscuro, que tiñe toda la interfaz con tonos azules de medianoche y no negro sólido (mejorando la legibilidad en ERP).
- Se auditaron y eliminaron decenas de colores estáticos (`#ffffff`, `#475467`, `rgba(31, 56, 106)`) dispersos en `global.css` y `dashboard.css`, asegurando que cada componente se ilumine o sombree automáticamente según la paleta elegida.
- La pantalla de "Control de Contrataciones" (tarjetas de KPI, panel lateral del candidato y grilla) soporta el tema oscuro manteniendo la estética de los "brillos" y "alertas semafóricas".
- Se documentó como lección que la legibilidad en modo oscuro no debe solucionarse parcheando componentes individuales, sino atacando la raíz de las variables CSS.

## Tab "Rechazados / Cerrados" en Resumen de Procesos

- [x] Identificar por qué folios rechazados y cerrados aparecían mezclados con folios activos en el resumen
- [x] Añadir el filtro "Rechazados / Cerrados" en `caseFilterOptions` de `hiringControlViewUtils.ts`
- [x] Exponer `hiring_request_status` en el payload de `get_recruitment_control_dashboard_v2` para poder filtrar por status en el frontend
- [x] Actualizar `filteredCases` y el rendering de etiquetas de estado en `HiringProcessesView.tsx`
- [x] Crear migración `20260608_000001_fix_dashboard_active_cases_filter.sql` con los cambios SQL correspondientes

## Resultado de Tab "Rechazados / Cerrados"

- El resumen de procesos ahora muestra los folios correctamente separados: activos en sus respectivas columnas y cerrados/rechazados solo en la nueva pestaña "Rechazados / Cerrados".
- La RPC `get_recruitment_control_dashboard_v2` fue actualizada para incluir el campo `hiring_request_status` y permitir que el frontend filtre por él.
- Los folios en estado `closed` o `rejected` solo aparecen en la nueva sección dedicada, y el estado mostrado refleja correctamente si es un rechazo del aprobador o un cierre.
- Migración aplicable en Supabase: `20260608_000001_fix_dashboard_active_cases_filter.sql`.

## Restricción estricta de cierre de folio con candidatos activos + Módulo de Traslado

- [x] Añadir bloqueo en `close_hiring_request` para impedir cerrar un folio que tenga candidatos activos (no contratados, no rechazados, no desistidos)
- [x] Crear RPC `transfer_candidate_to_case(p_case_candidate_id, p_target_case_id, p_comment)` para trasladar candidatos entre folios
- [x] Incluir en el traslado la migración de documentos (`candidate_documents`) y el registro de auditoría en ambos folios
- [x] Ampliar el `CHECK` constraint de `recruitment_case_audit_log.action_type` para incluir todos los tipos de acción del sistema
- [x] Añadir validaciones de seguridad: permisos sobre ambos casos, candidato no en etapa terminal, candidato no duplicado en destino, documentos sin conflicto de unicidad
- [x] Crear servicio frontend `transferCandidateToCase` en `hiringControl.ts`
- [x] Crear componente `TransferCandidateModal.tsx` con selector de folio destino y motivo opcional
- [x] Integrar el modal y el botón "Trasladar" en `HiringCandidatesView.tsx` y `CandidateDetailSidebar.tsx`
- [x] Corregir errores de la migración original antes de aplicar
- [x] Validar `npx tsc --noEmit` sin errores

## Resultado de Módulo de Traslado de Candidatos

- El sistema ahora bloquea a nivel de base de datos el cierre de un folio si existen candidatos activos, retornando un mensaje explícito que exige trasladarlos o descartarlos primero.
- La RPC `transfer_candidate_to_case(...)` mueve al candidato de un folio a otro de forma completamente atómica: cambia el `recruitment_case_id` en `recruitment_case_candidates` y en todos sus `candidate_documents`, preservando revisiones y aprobaciones documentales.
- La ficha del trabajador (`candidate_worker_files`) viaja automáticamente porque está enlazada por `recruitment_case_candidate_id`, sin requerir código adicional.
- Se registra trazabilidad completa: `candidate_transferred_out` en el folio origen y `candidate_transferred_in` en el folio destino.
- En la UI, el botón "Trasladar" aparece en el panel derecho del candidato siempre que este no esté en etapa terminal (contratado, rechazado, desistido).
- Las migraciones aplicables son `20260608_000001_fix_dashboard_active_cases_filter.sql` y `20260608_000002_add_transfer_candidate_rpc.sql`, en ese orden.
- Error crítico corregido antes de aplicar: el `CHECK` constraint de `action_type` no incluía los nuevos valores `candidate_transferred_out/in` ni los valores de migraciones anteriores como `document_uploaded`, `candidate_person_profile_updated`, etc.
