# Tareas y Roadmap de Desarrollo

## Desglose de precandidatos por rol en tarjetas - 2026-08-10

- [x] Extender el resumen autenticado de precandidatos con conteos por rol para cada estado.
- [x] Mostrar el desglose en tooltip al pasar el mouse o enfocar las tarjetas de Pendientes, Aprobados y Rechazados.
- [x] Validar responsive, tipos, build, migración aplicada y consulta productiva.
- [x] Ejecutar Guardian, registrar resultado y publicar en `main`.

Resultado: la migración `20260810231504_add_dsal_precandidate_role_summary` está aplicada y registrada en Supabase. Producción devuelve `by_role` para Pendientes, Aprobados y Rechazados; build, unitarias, integridad, seguridad, migraciones y Guardian pasan sin errores ni advertencias después de actualizar el baseline medido.

## Expansion de precandidatos DSAL a nomina ECO04 - 2026-08-10

- [x] Validar los 43 RUT de la nómina entregada contra el verificador del ERP.
- [x] Incorporar nombres y apellidos para autocompletado, permitiendo apellido materno vacío cuando la fuente no lo informa.
- [x] Ampliar el catálogo de roles en frontend, constraint y RPC pública de postulación.
- [x] Mantener el enriquecimiento judicial por RUT para criminales, laborales y detalle de causas.
- [x] Ejecutar auditorías, pruebas, commit y push a `main`.

Resultado parcial: la migración `20260810170000_expand_dsal_roster_roles` fue aplicada en Supabase remoto y registra 43 personas nuevas de la nómina ECO04. La información judicial existente se resuelve por RUT en la vista autenticada de Precandidatos; no se inventan resultados cuando un RUT no existe en la fuente judicial importada.

Resultado final: 79 pruebas unitarias, 19 pruebas de integridad, build frontend, auditorias de migraciones/seguridad y Guardian completo pasan sin errores.

## Optimizacion fuerte Business Intelligence - 2026-08-10

- [x] Medir el contrato actual de queries, renderizado y cambio de vistas del modulo BI.
- [x] Optimizar cache, paralelizar RPC de Reclutamiento y evitar refetches innecesarios.
- [x] Diferir el montaje de graficos pesados y mantener navegacion fluida entre pestañas.
- [x] Auditar backend BI y confirmar que sus indices actuales cubren la carga observada; no agregar indices sin evidencia.
- [x] Validar rendimiento, funcionalidad, permisos, build, Guardian, commit y push a `main`.

Resultado: el dashboard de Reclutamiento conserva datos recientes en cache por 2 minutos y durante 15 minutos sin uso, sus dos RPC se ejecutan en paralelo y Dotacion monta los graficos secundarios despues del primer render. La auditoria productiva confirmo 1.582 empleados activos, 5.244 filas de snapshot y 111 casos, con indices existentes para las rutas consultadas.

## Resolucion de area BUK para subareas por codigo de contrato - 2026-08-10

- [x] Reproducir el fallo posterior al mapping y confirmar la condicion de resolucion que lo provoca.
- [x] Permitir que una subarea BUK se resuelva por etiqueta exacta cuando su codigo visible no coincide con el cost center interno.
- [x] Desplegar la Edge Function, validar Guardian y comprobar la definicion publicada.
- [x] Commit y push a `main`.

Resultado: `sync-buk-candidates` ahora acepta el codigo visible de subarea con formato de contrato cuando el nombre o numero de contrato coincide exactamente con el area BUK; el payload usa el `cost_center` devuelto por BUK. La Edge Function fue desplegada y Guardian finalizo con 0 errores y 0 advertencias.

## Mapping BUK Acciona Tranque Talabre - 2026-08-10

- [x] Confirmar el contrato y el codigo de subarea BUK informado por el correo.
- [x] Completar el codigo operativo del mapping BUK sin reutilizar el area del contrato anterior.
- [x] Verificar en produccion la asociacion, flags operativos y ausencia de duplicados.
- [x] Ejecutar auditorias, pruebas, commit y push a `main`.

Resultado: el mapping `ACCIONA - TRANQUE TALABRE` / contrato `5906986003:0001` quedo asociado a `buk_area_code = 5906986003:0001`, operativo, uno-a-uno y enlazado al contrato ERP 194. La validacion de creacion de una persona en BUK debe ejecutarse con un candidato real desde el flujo operativo para no generar datos de prueba.

## Normalizacion de cargo Conductor de Bus - 2026-08-10

- [x] Confirmar el catalogo canonico y medir todos los registros productivos que usan `CONDUCTOR BUS`.
- [x] Consolidar catalogo, referencias por ID y nombres persistidos hacia `CONDUCTOR DE BUS`, sin tocar otros cargos ni historiales no afectados.
- [x] Desactivar la opcion duplicada para impedir nuevos procesos con el nombre incorrecto.
- [x] Aplicar la migracion remota, verificar conteos antes/despues y asegurar que las vistas del ERP reflejen el cargo canonico.
- [x] Ejecutar Guardian, build, auditorias, pruebas de integridad, diff check, commit y push a `main`.

Resultado: la migracion `20260810161527_normalize_conductor_de_bus_title` dejo activo solo `CARGO-035 / CONDUCTOR DE BUS`, movio solicitudes/procesos/movilidades al ID y nombre canonicos, y agrego restricciones para impedir nuevos valores legacy. Produccion quedo sin valores ni referencias `CONDUCTOR BUS`.

## Ajuste de catalogos y valores por defecto ficha BUK publica - 2026-08-10

- [x] Dejar `Transferencia Bancaria` como forma de pago inicial y valor de respaldo del backend.
- [x] Dejar `Mensual` como periodo de pago inicial y valor de respaldo del backend.
- [x] Cambiar comuna a selector alimentado por el catalogo vigente del ERP.
- [x] Aplicar migracion remota, compilar y validar auditorias.

Resultado: la ficha publica usa los formatos y catalogos vigentes de BUK; los campos libres permanecen como texto solo cuando el template ERP no define un catalogo.

## Formulario publico de ficha BUK para candidatos DSAL - 2026-08-10

- [x] Confirmar campos personales y previsionales que puede completar el candidato y estados validos de elegibilidad.
- [x] Crear sesion publica temporal vinculada a candidato aprobado, con verificacion de RUT y correo personal, expiracion y uso controlado.
- [x] Implementar RPC anonima de carga/guardado que valide elegibilidad, normalice datos, preserve campos internos y registre auditoria.
- [x] Crear formulario responsivo fuera de login y conectarlo con la ficha BUK canonica, reutilizando catalogos y reglas del ERP.
- [x] Validar rechazo para RUT no aprobado, rechazo de sesiones invalidas, persistencia, completitud BUK y ausencia de acceso anonimo directo.
- [x] Ejecutar build, Guardian, auditorias, smoke remoto, commit y push a main.

Resultado:
- Ruta publica `/ficha-buk-dsal` disponible sin login; valida RUT aprobado y correo personal registrado antes de revelar la ficha.
- RPCs anonimas acotadas, tabla de sesiones sin acceso directo, token temporal de 30 minutos, uso unico y auditoria `candidate_public_buk_worker_file_updated`.
- El formulario reutiliza catalogos BUK y completa datos personales, domicilio, contacto, tallas, pagos, banco, prevision y salud; mantiene los campos internos de RRHH.
- Migraciones `20260810150000`, `20260810153000` y `20260810154500` aplicadas y reparadas en Supabase remoto; la ultima corrige el token compatible con la instalacion remota.
- Validacion: build frontend, `test:integrity` (18), `audit:migrations`, `audit:supabase-security`, Guardian completo y baseline de performance pasan. El smoke remoto de RUT/email invalido quedo limitado por timeout de la API de consulta, y se verifico la definicion publicada y los privilegios de RPC.


> **REGLA FUNDACIONAL (Leccion 56):** Antes de proponer, planificar o ejecutar cualquier cambio sobre este repositorio, se debe leer `tasks/todo.md` y `tasks/lessons.md` completos. Esta es la primera accion obligatoria de cada sesion de trabajo, sin excepcion.

Este archivo mantiene solo el estado vivo y los cierres recientes con relevancia operacional para el ERP. El historial cerrado sin enlace productivo fue purgado para reducir peso del repositorio; las reglas reutilizables permanecen en `tasks/lessons.md` y la documentacion vigente en `docs/`.

## Separacion del modulo de sanciones - 2026-08-10

- [x] Retirar Sanciones de las vistas/pestañas de Incentivos.
- [x] Crear ruta y pagina propia protegida por `solicitud_sanciones`.
- [x] Mantener navegación, precarga de ruta, realtime y permisos del módulo sin compartir el contenedor de Incentivos.
- Resultado: `/recursos-humanos/sanciones` queda como módulo independiente dentro de Recursos Humanos; Incentivos conserva solo sus vistas propias.

## Correccion enlaces de documentos de candidatos - 2026-08-10

- [x] Identificar la interferencia de la politica Storage de sanciones con el bucket `candidate-docs`.
- [x] Encapsular la consulta a `hr_sanction_documents` en una funcion `SECURITY DEFINER` sin abrir permisos directos.
- [x] Aplicar la migracion `20260810131746_fix_hr_sanctions_storage_policy_table_access` y verificar acceso transaccional como Thania.
- Resultado: el bucket `candidate-docs` vuelve a resolver objetos visibles para usuarios autorizados; las tablas `hr_sanction_documents` siguen sin privilegios directos para `authenticated`.

## Reclutamiento DSAL - postulacion publica y precandidatos - 2026-08-08

- [x] Consolidar el contrato funcional desde la captura y validar los patrones actuales de Control de Contrataciones, ficha BUK y RUT.
- [x] Crear backend autoritativo para precandidatos DSAL con insercion publica acotada, RLS estricta, deduplicacion por RUT y RPCs autenticadas de listado/aprobacion.
- [x] Implementar pagina publica libre de login con logo Consorcio Andino, mensaje de bienvenida mejorado, RUT autocorregido/validado, campos separados, licencias multiseleccion y rol DSAL uniseleccion.
- [x] Insertar la pestaña interna `Precandidatos` entre `Resumen de procesos de contratación` y `Control de candidatos`, con revision/aprobacion hacia el pipeline real.
- [x] Agregar pruebas/auditorias focalizadas para RUT, contrato SQL/RLS/RPC y rutas publicas.
- [x] Validar TypeScript/build, auditorias Supabase proporcionales, Guardian y `git diff --check`.

Condiciones de seguridad:
- La pagina publica solo puede insertar postulaciones; no debe listar, aprobar ni leer datos de terceros con `anon`.
- La aprobacion debe requerir usuario autenticado con acceso real a Control de Contrataciones y debe reutilizar el ingreso al pipeline para conservar auditoria.
- No relajar RLS, grants ni permisos de candidatos existentes para hacer funcionar la UI publica.
- La migracion debe preservar candidatos y postulaciones historicas; si el RUT ya existe en precandidatos, se actualiza la postulacion pendiente en vez de duplicar filas.

Resultado:
- Ruta publica nueva `/postulacion-dsal`, fuera de `ProtectedRoute`, con logo Consorcio Andino, mensaje de bienvenida DSAL, RUT autocorregido/validado, nombres separados, domicilio separado en direccion/region/ciudad, licencias multiseleccion y rol DSAL uniseleccion.
- Backend en `20260808015748_add_dsal_precandidates_intake`: tabla `recruitment_precandidates`, RLS sin lectura/escritura directa, RPC publico `submit_dsal_precandidate_application` con validacion server-side y upsert atomico por RUT pendiente, y RPCs autenticadas para listar/aprobar/rechazar.
- `Control de Contrataciones` suma la pestaña `Precandidatos` entre resumen y candidatos. La aprobacion exige seleccionar un caso activo y reutiliza `add_candidate_to_recruitment_case`, luego completa datos base del perfil para que aparezca en Control de candidatos.
- El auditor Supabase permite solo este RPC anonimo especifico, sin subir el limite global de seguridad.
- Produccion Supabase: migracion `20260808015748_add_dsal_precandidates_intake` aplicada con `supabase db query --linked --file` por bloqueo legacy de `db push`; version `20260808015748` registrada como `applied` con `supabase migration repair --linked --status applied`.
- Smoke productivo: tabla existe, RLS activo, `anon` no tiene `select` ni `insert` directo sobre `recruitment_precandidates`, `anon` solo ejecuta `submit_dsal_precandidate_application`, y `authenticated` ejecuta listado/aprobacion/rechazo. Insercion publica de smoke con RUT valido dentro de transaccion dejo 0 filas despues de `ROLLBACK`.
- Validacion: `build:frontend-check`, `audit:migrations`, `audit:supabase-security`, SQL transaccional remoto con `ROLLBACK`, Playwright desktop/mobile de `/postulacion-dsal`, `audit:performance-baseline`, `git diff --check` y `guardian` pasan. `db push --dry-run --linked` sigue bloqueado por deuda legacy remota ya conocida, por eso se aplico/verifico con `supabase db query --linked`.

### Correccion estetica pagina publica DSAL - 2026-08-08

- [x] Auditar la pagina publica contra la estetica real del ERP y clases globales existentes.
- [x] Rehacer layout/CSS para que sea limpio, minimalista, compacto y consistente en notebook y celular.
- [x] Validar render responsivo real, build frontend, Guardian y `git diff --check`.

Resultado:
- Se reemplazo el tratamiento tipo landing/hero por una ficha publica de lenguaje ERP: header compacto con logo Consorcio Andino, intro breve, superficie `tracking-panel`, divisores finos, numeracion sobria y controles existentes (`TextField`, `SelectField`, `MultiSelectField`, `control-edit-grid`, `form-status`, `soft-primary-button`).
- Playwright local valido notebook 1366, notebook 1024, mobile 390 y mobile 360 sin overflow horizontal. Capturas revisadas visualmente en notebook y celular.
- La funcionalidad, RPCs y permisos backend no cambian en esta correccion.
- Validacion final: `build:frontend-check` y `guardian` pasan con 0 errores y 0 warnings. El baseline P4 se actualizo solo por el aumento medido del CSS/JS de esta correccion visual, sin vendors ni assets nuevos.

### Ajuste de copy y espacios pagina publica DSAL - 2026-08-08

- [x] Retirar el titulo operativo, la bajada anterior y el cuadro de resumen de acceso/precandidatos.
- [x] Incorporar el mensaje institucional entregado por negocio como bienvenida de la postulacion.
- [x] Redistribuir el ancho y los espacios del encabezado, bienvenida y formulario en notebook y celular.
- [x] Validar copy, build, render responsivo, `git diff --check` y Guardian.

Resultado:
- La pagina publica conserva el logo y estado de Consorcio Andino/Codelco DSAL, pero ya no muestra los textos operativos ni el cuadro lateral solicitado.
- La bienvenida institucional se muestra antes del formulario con una anchura legible en notebook y un apilado compacto en celular.
- Playwright valido 1366, 1024, 390 y 360 px: copy nuevo presente, copy anterior ausente y sin overflow horizontal.
- `build:frontend-check`, `npm run guardian` y `git diff --check` pasan. El baseline se actualizo solo por los 5 bytes medidos del bundle JS.

### Validacion y normalizacion de datos pagina publica DSAL - 2026-08-08

- [x] Confirmar el contrato vigente de RUT, email y telefono en frontend, RPC y ficha ERP.
- [x] Normalizar visualmente los campos de texto segun el formato recibido por el ERP.
- [x] Restringir telefono a 8 digitos con prefijo fijo `+56 9` y validar la forma canonica en backend.
- [x] Reforzar validacion y normalizacion de correo en frontend y backend.
- [x] Validar casos validos/invalidos, build, auditorias Supabase, render responsivo, Guardian y produccion.

Resultado:
- El RUT mantiene validacion de digito verificador en navegador, RPC y smoke productivo.
- Nombres, apellidos, direccion, ciudad y comentarios se normalizan a formato tipo ERP; email queda en minusculas y exige `@` y dominio con extension.
- El telefono se captura como 8 digitos con prefijo fijo visible `+56 9` y se persiste como `+569XXXXXXXX`.
- Migracion `20260808025221_harden_dsal_precandidate_contact_normalization` aplicada al Supabase vinculado; smoke valido rechazo de telefono/email invalidos, persistencia normalizada y rollback sin filas.
- `test:unit` (78), `build:frontend-check`, auditorias Supabase, Playwright responsive y Guardian pasan.

### Auditoria funcional y operativa DSAL - 2026-08-08

- [x] Confirmar que la aprobacion de un precandidato copia los datos publicos a la ficha y al pipeline del candidato.
- [x] Hacer autoritativa la exigencia de folio de contratacion y cupo disponible al aprobar, con bloqueo transaccional.
- [x] Mostrar en Control de Contrataciones una instruccion accionable cuando no existan folios habilitados.
- [x] Auditar intake anonimo, deduplicacion, RLS, permisos de aprobacion, trazabilidad y registro final en ERP.
- [x] Ejecutar pruebas, build, auditorias, Guardian, smoke productivo y verificar commit/push alineados con `main`.

Resultado:
- [x] La aprobacion ahora valida dentro de la misma transaccion que el caso tenga folio no vacio, estado habilitado y cupo efectivo disponible; bloquea el caso con `FOR UPDATE` antes de ingresar al pipeline.
- [x] La UI solo ofrece folios con cupo y muestra la instruccion para solicitar a la gerencia la creacion y aprobacion del folio cuando no existe un destino habilitado.
- [x] La aprobacion conserva el ingreso por `add_candidate_to_recruitment_case`, actualiza `candidate_profiles` con identidad, contacto, domicilio, ciudad, region y licencias, registra la fuente DSAL y enlaza `recruitment_precandidates` con el caso y candidato creados.
- [x] Produccion: RLS de precandidatos activo; `anon` puede ejecutar solo el intake publico, no aprobar; `authenticated` conserva la RPC de aprobacion. Hay 1 precandidato pendiente, 48 casos activos con folio y 0 casos activos sin folio.
- [x] Validacion: prueba de integridad DSAL, build frontend, auditorias de migraciones/seguridad y Guardian pasan; Guardian finaliza con 0 errores y 0 warnings. La aprobacion autenticada de un registro real no se ejecuto para no alterar datos productivos sin un canario autorizado.

### Permisos y filas expandibles de precandidatos DSAL - 2026-08-08

- [x] Confirmar el contrato vigente de autorizacion para gerente de area DSAL, Director de Operaciones y Reclutamiento.
- [x] Aplicar la autorizacion especifica a listar, aprobar y rechazar precandidatos sin ampliar permisos de otros modulos.
- [x] Reorganizar cada precandidato como fila compacta expandible siguiendo el patron existente de Control de Contrataciones.
- [x] Mantener ocultos hasta expandir el folio destino, comentarios y resolucion; incluir pruebas de contrato y responsive.
- [x] Ejecutar build, auditorias, Guardian, smoke productivo y publicar en `main`.

Resultado:
- [x] La autoridad DSAL se resuelve por `cost_center_approvers` del contrato DSAL y se complementa con `director_op`, `reclutamiento`, `candidate_control_access` y administrador; la RPC valida el actor contra `auth.uid()`.
- [x] Listado, aprobacion y rechazo usan la nueva guardia especifica. La aprobacion solo acepta folios del contrato DSAL, mantiene el bloqueo de cupo y no relaja RLS.
- [x] La fila muestra solo identidad, contacto, domicilio, licencias, rol y estado. Folio, comentarios, fecha de revision y acciones aparecen dentro del detalle expandido con el mismo patron de `tracking-table-row-clickable` y `expanded-case-detail-grid` del ERP.
- [x] Produccion: RLS activo, payload incluye `approved_folio`, existen 4 casos DSAL activos con folio y la migracion `20260808032030_allow_dsal_precandidate_reviewers_and_expand_details` esta aplicada.
- [x] `test:integrity`, `build:frontend-check`, auditorias de migraciones/seguridad, baseline y Guardian pasan con 0 errores y 0 warnings.

### Nómina DSAL y antecedentes judiciales de precandidatos - 2026-08-08

- [x] Extraer y auditar `nomina base.xlsx` e `info judicial.xlsx` con `artifact-tool`, validando RUT, duplicados, conteos y detalle de causas.
- [x] Crear tablas protegidas y RPCs backend para consulta exacta de identidad de nómina y enriquecimiento judicial solo para revisores DSAL autenticados.
- [x] Sembrar la nómina vigente y los conteos/detalles judiciales en una migración reproducible, preservando trazabilidad de origen.
- [x] Implementar autocompletado bloqueado por RUT en la página pública y bloquear postulaciones cuyo RUT no pertenezca a la nómina vigente.
- [x] Mostrar burbujas judiciales roja/amarilla y tooltips por causa en la fila expandida de Precandidatos, manteniendo el patrón visual ERP y responsive.
- [x] Ejecutar pruebas, build, auditorías, Guardian, smoke remoto transaccional y revisión de seguridad de datos sensibles.
- [ ] Verificar commit, push y alineación efectiva con `main`.

Resultado parcial:
- `nomina base.xlsx`: 156 RUT únicos, sin duplicados.
- `info judicial.xlsx`: 195 resúmenes, 81 causas criminales y 43 laborales; se conservó el resumen oficial y el detalle completo.
- Producción Supabase: migraciones `20260808033755` y `20260808040122` aplicadas y registradas; tablas judiciales sin `select` directo para `anon`/`authenticated`.
- Smoke transaccional: la consulta pública resolvió una identidad conocida, rechazó una desconocida y al enviar nombres falsos persistió la identidad oficial de nómina; la transacción fue revertida.
- Validación: 78 pruebas unitarias, prueba focalizada DSAL, build frontend, auditorías y Guardian pasan con 0 errores y 0 warnings. Playwright validó autocompletado bloqueado y render móvil sin cambios visuales ajenos al ERP.

### Alta de usuario RRHH para revisión DSAL - 2026-08-09

- [x] Verificar que el correo no exista y reutilizar la cuenta Auth existente con recuperación segura.
- [x] Completar perfil operativo y asignar el rol `reclutamiento` requerido por Precandidatos DSAL, conservando `administrativo`.
- [x] Verificar permisos de módulo, estado de reset y aceptación del correo de recuperación por el proveedor configurado con Resend.

Resultado:
- Cuenta existente: `angel.reinoso@busesjm.com`, perfil `4913b662-4437-4618-816a-572813536ee4`.
- Perfil actualizado a `Angel Reinoso`, cargo `Administrativo de RRHH`, departamento `Recursos Humanos`, estado activo y cambio de contraseña obligatorio.
- Roles efectivos: `administrativo` + `reclutamiento`; el rol `reclutamiento` tiene acceso a `control_contrataciones` y el backend DSAL lo reconoce para revisión.
- El correo de recuperación fue aceptado para entrega con redirección a `https://gestion.busesjm.cl/reset-password`; no se generó ni se expuso una contraseña en texto plano.

### Excepción de nómina para postulaciones DSAL - 2026-08-09

- [x] Permitir que RUT válidos fuera de la nómina continúen como precandidatos.
- [x] Mantener autocompletado y bloqueo solo para RUT encontrados en la nómina.
- [x] Normalizar nombres ingresados manualmente y aplicar la misma regla en backend.
- [x] Probar ambos caminos, aplicar migración remota, auditar y publicar en `main`.
- Resultado: `20260809161820_allow_non_roster_dsal_precandidate_submissions.sql` aplicado y registrado en producción. El RUT `17.451.540-9` fue validado como no perteneciente a la nómina y aceptado transaccionalmente con nombres normalizados; un RUT de nómina conservó sus nombres oficiales. Ambos smoke tests fueron revertidos con `ROLLBACK`.

## Recursos Humanos - Solicitud de Sanciones - 2026-08-07

- [x] Consolidar el contrato funcional desde el correo `RE: [Desarrollo] Modulo Cartas de Amonestacion.eml` y sus 7 cartas tipo.
- [x] Inspeccionar rutas, permisos, patrones RRHH, contratos BUK/Storage y tablas vivas antes de implementar.
- [x] Crear modelo backend autoritativo para causales, medidas, solicitudes, documentos, historial y KPIs con RLS estricta.
- [x] Registrar acceso del modulo en `app_modules`, `role_module_access`, tipos frontend y navegacion RRHH sin romper incentivos.
- [x] Implementar UI inicial para crear solicitudes, revisar historial/control y visualizar KPIs operativos.
- [x] Agregar pruebas focalizadas de contrato, permisos y render basico.
- [x] Validar TypeScript/build, auditorias Supabase proporcionales, Guardian y `git diff --check`.

Condiciones de seguridad:
- Los antecedentes disciplinarios son informacion sensible: no exponer tablas directas sin RLS, no usar `TO authenticated` sin predicado de autorizacion y no relajar permisos para acelerar UI.
- Los adjuntos deben quedar en bucket privado con rutas vinculadas a la solicitud y acceso por RPC/politicas actor-scoped.
- La carga a BUK y la generacion/envio de PDF solo se consideran cerradas si se verifica el contrato vivo del proveedor y/o Edge Function correspondiente; si no, deben quedar como estado trazado y no como simulacion silenciosa.
- Las cartas tipo deben transformarse a plantillas con variables y catalogo versionado de causales/articulos, no texto libre oculto en frontend.
- Mientras el modulo siga en desarrollo, la visibilidad queda limitada a admin/superadmin.

Resultado:
- Implementacion completada en `supabase/migrations/20260807230621_add_hr_sanctions_module.sql` y `src/modules/sanctions`.
- El backend registra el modulo `solicitud_sanciones`, bucket privado `hr-sanctions`, causales/medidas desde el correo, solicitudes con folio, historial, documentos, transiciones y KPIs. Las tablas quedan con RLS y sin acceso directo a `authenticated`; el acceso ocurre por RPCs con `auth.uid()` y chequeo de modulo/rol.
- La UI queda disponible como vista `Sanciones` dentro de Recursos Humanos, con ingreso de solicitud, buscador de trabajador BUK activo, adjuntos privados, control de estados y KPIs; el menu queda visible solo para `admin` durante desarrollo.
- Validacion local: `build:frontend-check`, `audit:migrations`, `audit:supabase-security`, `git diff --check`, tests focalizados `hr-sanctions-integrity`/`query-keys` y Guardian full pasan con 0 errores y 0 warnings.
- Supabase produccion: migracion aplicada con `supabase db query --linked --file` por bloqueo legacy de `db push`; version `20260807230621` registrada como `applied` con `supabase migration repair --linked --status applied`.
- Smoke productivo: modulo activo, bucket `hr-sanctions` privado, 9 causales, 5 medidas, RLS activo en las 5 tablas y `role_module_access` solo contiene `admin` para `solicitud_sanciones`. Smoke transaccional con rollback valido que un usuario RRHH no-admin no accede a catalogos, admin crea/lee detalle, y quedan 0 filas `SMOKE-ERP` persistidas.
- Pendiente fase 2: generacion PDF, envio/carga BUK y reconciliacion de carpeta `Amonestaciones` solo despues de validar contrato vivo BUK.

## Dashboard clima - geolocalizacion bloqueada por headers - 2026-08-07

- [x] Confirmar el contrato actual del widget de clima y la rama que muestra fallback por IP.
- [x] Revisar los headers web desplegables para identificar si geolocalizacion queda bloqueada a nivel navegador.
- [x] Corregir el header de `Permissions-Policy` preservando el hardening de camara/microfono.
- [x] Agregar prueba de regresion para que el dashboard pueda solicitar ubicacion del mismo origen.
- [x] Validar build, pruebas focalizadas, Guardian y diff final.

Condiciones de seguridad:
- No relajar camara, microfono, CSP, XFO ni HSTS.
- La geolocalizacion solo puede quedar habilitada para el origen propio del ERP.
- Si el navegador niega permisos o no tiene ubicacion disponible, el fallback por IP debe seguir funcionando.

Resultado:
- Causa raiz confirmada en produccion: `gestion.busesjm.cl` estaba sirviendo `Permissions-Policy: camera=(), microphone=(), geolocation=()`, lo que bloquea `navigator.geolocation` para el propio ERP. Por eso el widget caia a IP fallback y mostraba Antofagasta con `Última ubicación aproximada (Ubicación no disponible)`.
- Correccion: `public/_headers` conserva `camera=()` y `microphone=()`, pero cambia a `geolocation=(self)` para permitir ubicacion solo desde el origen del ERP.
- Regresion cubierta en `frontend-security-residuals`: el test exige `geolocation=(self)` y falla si vuelve `geolocation=()`.
- Verificacion: `dist/_headers` generado contiene `geolocation=(self)`, `test:unit`, `build:frontend-check`, `git diff --check` y Guardian pasan con 0 errores y 0 warnings. `npm ci` reconstruyo dependencias locales para eliminar copias conflictivas `node_modules/* 2|3`.

## Incidente Auth: enlaces consumidos y credenciales temporales unicas - 2026-08-06

- [x] Confirmar en Auth logs la causa de los enlaces invalidos y el universo exacto pendiente.
- [x] Preparar un despachador temporal acotado que genere una clave fuerte distinta por cuenta sin registrarla.
- [x] Ejecutar canario con Laura Lopez, validar login tecnico, correo y cambio obligatorio.
- [x] Procesar solo las cuentas activas pendientes, con conteo de enviados/fallidos y sin reintentos ciegos.
- [x] Eliminar funcion y secret temporales y reconciliar cuentas, sesiones y flags en produccion.
- [x] Validar el flujo ERP, Guardian y documentar el cierre sin versionar credenciales.

Condiciones de seguridad:
- Cada contraseña temporal es aleatoria, exclusiva por cuenta y se entrega solo al correo corporativo.
- Ninguna contraseña puede aparecer en logs, respuestas, archivos, commits o trazas de CI.
- El usuario debe quedar con `must_reset_password = true` y ser dirigido a `/reset-password` despues del primer login.
- No se restaura la contraseña compartida comprometida ni se relajan RLS, grants o validaciones Auth.

Resultado:
- Los logs Auth demostraron que Microsoft Safe Links/Defender consumia los enlaces de un solo uso entre 21 y 27 segundos despues del envio; el clic humano posterior encontraba `One-time token not found`.
- Universo procesado: 21 cuentas activas pendientes. Laura fue el canario y las otras 20 se procesaron solo despues de un dry-run que confirmo el conteo.
- Cada cuenta recibio por correo corporativo una contraseña temporal criptografica y exclusiva de 21 caracteres. Ninguna contraseña fue retornada, registrada o persistida fuera de Auth y el correo individual.
- Resultado tecnico: `21 password_updated`, `21 login_smoke`, `21 sent`, `0 failed`. Despues de cada lote se repuso `must_reset_password = true` y se eliminaron las sesiones del smoke.
- Laura completo el flujo real a las `2026-08-06 14:16:42Z`: cambio su contraseña personal, el trigger autoritativo libero el flag y quedaron 0 sesiones residuales.
- Reconciliacion inmediata: 20 cuentas siguen pendientes de completar su cambio, 0 estan baneadas y 0 tienen sesiones activas. La Edge Function y el secret temporales fueron eliminados.
- La recuperacion futura por enlace requiere una landing intermedia scanner-safe; no se deben reenviar enlaces directos `/verify` como solucion a este incidente.

## Incidente Auth: recuperacion bloqueada por rate limit - 2026-08-06

- [x] Correlacionar la rotacion de cuentas del 2026-08-05 con logs Auth y estado productivo de Laura Lopez.
- [x] Confirmar el universo afectado y distinguir cuentas baneadas de credenciales rotadas sin sesion.
- [x] Restaurar la recuperacion inmediata sin reintroducir la password compartida ni quitar flags manualmente.
- [x] Configurar SMTP productivo para eliminar la cuota global de prueba de 2 correos por hora.
- [x] Corregir el frontend para preservar `status`/`code`, bloquear doble envio y aplicar cooldown ante 429.
- [x] Validar pruebas focalizadas, TypeScript/build, Guardian y estado productivo posterior.

Resultado:
- Causa raiz: la auditoria roto 23 cuentas que aun usaban una password temporal publica, pero el proyecto seguia usando SMTP incorporado de Supabase, limitado globalmente a 2 correos por hora. Dos recuperaciones exitosas consumieron la cuota y los siguientes usuarios recibieron `429 over_email_send_rate_limit` incluso en su primer intento.
- Laura Lopez estaba activa, confirmada y sin ban; tenia `must_reset_password = true`, 0 sesiones y password aleatoria desde `2026-08-06 02:23:57Z`.
- Recuperacion inmediata: 22 cuentas activas recibieron enlaces individuales de un solo uso mediante el canal Resend ya verificado; Laura fue el canario. Resultado `22 sent`, `0 failed`, `0 skipped`.
- Supabase Auth quedo con SMTP Resend productivo (`smtp.resend.com:465`), remitente `ERP Buses JM` y `rate_limit_email_sent = 30`; antes no habia SMTP custom y el limite era 2.
- Las dos Edge Functions temporales y sus cuatro secrets de incidente fueron eliminados despues de la ejecucion; no queda endpoint administrativo temporal activo.
- El frontend deja de mostrar el error crudo, conserva `code`/`status`, no reintenta automaticamente, bloquea doble click y aplica 60 segundos de cooldown tras solicitar recuperacion o recibir 429.
- Validacion focalizada: 6 pruebas Auth y `build:frontend-check` pasan; la validacion Enterprise final se registra antes del merge.

## Cierre de los dos riesgos residuales de seguridad frontend - 2026-08-05

- [x] **Residual 1 — advisories de React Router: CERRADO.** Se migro a React `19.2.7`, React DOM `19.2.7` y React Router `8.3.0`; `npm audit` y `npm audit --omit=dev` reportan 0 vulnerabilidades.
- [x] **Residual 2 — headers de seguridad no desplegados: CERRADO.** Cloudflare produccion sirve CSP, `X-Frame-Options: DENY`, HSTS y `Permissions-Policy`; los assets versionados usan cache inmutable.
- [x] Corregir las referencias historicas que todavia presentaban React Router como un riesgo abierto.
- [x] Registrar ambos cierres en el registro EEES de riesgos residuales y agregar el aprendizaje de reconciliacion documental.
- [x] Validar la documentacion con `audit:enterprise-docs`, Guardian y `git diff --check`.

Evidencia:
- PR tecnico: `#1`; merge productivo: `547a1268fa9a41e08b06d7fda683692f6f36ba46`.
- Deployment Cloudflare: `44d70579-9768-4427-91ad-ab2b9e8deaf4`.
- Estado vigente: **2 de 2 riesgos residuales cerrados**; los riesgos externos del registro EEES no corresponden a estos dos hallazgos frontend.

## Reclutamiento BUK - evaluacion segura de fichas F2 historicas - 2026-08-06

- [x] Revisar documentacion oficial BUK sobre identidad de empleado, `code_sheet`, liquidaciones y documentos firmados.
- [x] Inventariar en solo lectura las dependencias productivas de BUK `41903`, `41904`, `41905`, `41906` y `41908`.
- [x] Confirmar que claves usa el ERP para sincronizaciones futuras y que riesgo tendria renombrar `F2` a `F1`.
- [x] Comparar alternativas y documentar una recomendacion que preserve produccion, historial laboral y documentos legales.

Condiciones de seguridad:
- No modificar BUK, Supabase ni documentos historicos durante esta investigacion.
- No asumir que `code_sheet` es una etiqueta editable: toda conclusion debe apoyarse en contrato oficial y evidencia productiva.
- Si BUK no documenta expresamente el impacto sobre liquidaciones o firma, tratarlo como riesgo no resuelto y exigir validacion formal del proveedor antes de intervenir.

Resultado:
- BUK define la ficha como una relacion contractual que contiene trabajo, planes, documentos y liquidaciones. La API permite editar `code_sheet` mediante `PATCH /employees/{id}`, pero su contrato publico no garantiza que el cambio reconcilie documentos firmados, PDFs historicos, liquidaciones cerradas, LRE o integraciones basadas en codigo de ficha.
- Verificacion viva por API, sin escrituras: los cinco `employee_id` siguen activos con `F2`, un plan previsional y un trabajo vigente cada uno. Conservan 25 a 27 documentos por ficha; entre 6 y 9 archivos por persona ya incorporan `F2` en el nombre, incluyendo contratos, anexos, IRL y documentos de firma electronica.
- El ERP usa `buk_employee_id` como identidad estable para espejo, documentos, competencias y operacion. `code_sheet` se usa durante provision y como selector en importadores/modificadores BUK; cambiar solo BUK dejaria deriva con `candidate_worker_files`, reservas y snapshots, ademas de inconsistencia visual con documentos historicos inmutables.
- Recomendacion de menor riesgo: conservar estas cinco fichas historicas como `F2` y tratarlas como excepcion documentada. No crear, clonar, mover, borrar ni renombrar fichas; la prevencion forward-only ya evita nuevos casos.
- Si negocio exige normalizar a `F1`, no hacerlo como correccion directa: requerir confirmacion escrita de soporte BUK sobre nomina, LRE, firma y documentos; probar primero en sandbox; inventariar importadores externos; y ejecutar un canary coordinado que preserve el mismo `employee_id`, reconcilie espejo/worker file/reserva y valide por lectura posterior todos los IDs documentales y periodos de remuneraciones.

## Reclutamiento BUK - prevencion definitiva de fichas F2 falsas - 2026-08-06

- [x] Auditar en produccion, solo lectura, el universo de candidatos con ficha sugerida o creada superior a su historial real.
- [x] Confirmar el contrato canonico vigente entre `candidate_worker_files`, jobs BUK, espejo local BUK y la Edge Function.
- [x] Corregir la asignacion de ficha para excluir autoconteo, validar el formato, preservar reintentos legitimos y serializar decisiones concurrentes.
- [x] Agregar pruebas de regresion para primer ingreso F1, recontratacion F2, snapshot de retry, snapshot obsoleto y concurrencia.
- [x] Ejecutar auditorias SQL/seguridad, pruebas focalizadas, Guardian y smoke transaccional antes de aplicar en produccion.
- [x] Aplicar la correccion forward-only y verificar en produccion que nuevos casos no puedan reproducir el defecto.
- [x] Documentar por separado los casos historicos detectados; no modificar fichas BUK en esta fase.

Condiciones de seguridad:
- Primero se corrige y valida la causa raiz; ninguna ficha historica en ERP o BUK se modifica durante el inventario.
- Los jobs exitosos conservan su evidencia inmutable. Una reserva de retry solo puede reutilizarse si pertenece al mismo candidato y cumple el contrato valido.
- No se relajan RLS, grants ni controles de actor para resolver la asignacion.

Resultado:
- Auditoria de 135 jobs con ambos codigos: 27 jobs mostraron F1 a F2 y correspondieron a 14 personas. Solo cinco personas tuvieron impacto real por creacion directa F2 sin historia previa; no existen F3+ por este defecto, doble creacion por RUT ni carrera concurrente materializada. BUK `41903`, `41904`, `41905`, `41906` y `41908` quedan inventariados, sin cambios historicos en esta fase.
- La migracion `20260806205622_prevent_false_buk_employee_codes` crea reservas privadas unicas por documento y secuencia, serializadas con advisory lock. El resolver deja de leer snapshots y worker files como autoridad; un trigger congela la reserva en todo job y reemplaza cualquier snapshot manual/obsoleto antes de entrar a la cola.
- La Edge Function consulta BUK vivo antes de cualquier escritura, reconcilia la reserva, bloquea retries ambiguos y relee el empleado despues de crear/clonar/reutilizar. Solo confirma la reserva si BUK devuelve exactamente el `code_sheet` reservado; plan, cargo, documentos y cierre quedan bloqueados ante discrepancia.
- Seguridad productiva: `authenticated` ya no puede ejecutar el resolver ni las RPC internas; reconciliacion/confirmacion quedan solo para `service_role`. La tabla privada tiene RLS, sin grants Data API, formato `F[1-9][0-9]*` y unicidad activa por documento/correlativo.
- Produccion: migracion aplicada y registrada; `sync-buk-candidates` v55 `ACTIVE`; llamada sin autenticacion devuelve 401. Smoke transaccional prueba primer ingreso F1, retry sobre la misma reserva y reemplazo de snapshot F99 por F1; `ROLLBACK` deja 0 jobs y 0 reservas. La cola estaba y permanece en 0 pending/processing.
- Validacion: 72 unitarias, 6 contratos, 8 integridad, 8 concurrencia, Deno check, auditorias BUK/migraciones/seguridad, `git diff --check` y Guardian full con 27 gates pasan; 0 errores y 0 warnings. `npm audit` retorna 0 vulnerabilidades.

## Auditoria profunda de seguridad y hardening - 2026-08-05

- [x] Levantar baseline reproducible de dependencias, secretos, Auth, RLS, grants, RPC, Storage y Edge Functions sin alterar produccion.
- [x] Contrastar el estado vivo productivo con migraciones/configuracion y advisors, priorizando hallazgos explotables sobre warnings historicos.
- [x] Revisar en paralelo SQL/Supabase, Edge Functions/integraciones y frontend/supply-chain/privacidad.
- [x] Corregir vulnerabilidades confirmadas con cambios minimos, forward-only y backend autoritativo, sin relajar RLS ni permisos.
- [x] Ejecutar smokes de abuso y permisos, auditorias focalizadas, Guardian y validaciones proporcionales.
- [x] Aplicar/desplegar solo correcciones verificadas, reconciliar produccion y documentar riesgos residuales.

Resultado:
- Se revoco en produccion el `EXECUTE` autenticado de finalizadores BUK, reset documental, poblacion BI, preparacion operacional y helpers de correo. La fuga BI reproducible de 1.580 personas y las mutaciones privilegiadas ya no son invocables por `authenticated`.
- El reset obligatorio de password quedo autoritativo en `auth.users`: el trigger solo libera `must_reset_password` cuando cambia `encrypted_password`; la policy impide actualizar una fila cuyo flag siga activo y solo admite el no-op compatible despues del cambio real. Smokes transaccionales de trigger y RLS con rollback pasaron.
- La clave `service_role` expuesta en el historial publico fue migrada a `sb_secret`, actualizada en GitHub y en 11 Edge Functions; se desactivaron las API keys legacy y se revoco la signing key HS256 anterior. La prueba administrativa con la clave filtrada paso de HTTP 200 a 401.
- Se detectaron 23 cuentas que aun usaban la password temporal publica: se reemplazo por valores aleatorios unicos, se revocaron sus sesiones y se forzo recuperacion/reset. La reconciliacion posterior devuelve 0 cuentas afectadas.
- La carga documental de acreditacion ahora hace preflight actor-scoped antes de BUK, valida magic bytes PDF/JPEG/PNG y no retorna el payload crudo del proveedor. La generacion de certificados autentica antes de leer recursos y usa claim atomico con lease para evitar duplicados concurrentes.
- Las funciones Edge usan `SUPABASE_SECRET_KEYS`/`SUPABASE_PUBLISHABLE_KEYS`; 11 despliegues quedaron `ACTIVE`, todas rechazan llamadas sin auth con 401. Se eliminaron dos stubs productivos no versionados que respondian 410 y `config.toml` refleja las 12 funciones vigentes.
- CI ya no entrega credenciales smoke a pasos de pull request; provisioning elimina la password compartida; logout borra drafts operacionales sensibles; headers anti-clickjacking/HSTS quedan listos para el siguiente deploy frontend.
- Leaked Password Protection quedo habilitada. GitHub secret/variable usan claves modernas y el dry-run remoto de roster BUK concluyo exitoso.
- Validacion: 69 unitarias, 376 migraciones canonicas, Deno check de funciones afectadas, TypeScript/build, auditorias focalizadas, smokes productivos y Guardian pasan sin errores.
- Riesgos residuales: `react-router`/`react-router-dom` mantienen dos advisories moderados sin vector controlable confirmado; el fix disponible exige migracion mayor v7. Los headers web preparados requieren el proximo deploy/commit del frontend para reflejarse en `gestion.busesjm.cl`.

## Acceso operacional Andres Barraza - Zona Norte 2 - 2026-08-05

- [x] Confirmar en produccion la identidad unica de Andres Barraza, su perfil y sus roles aplicativos vigentes.
- [x] Inspeccionar el contrato autoritativo de gerencias/zonas y la regla backend que limita la visibilidad de folios.
- [x] Medir el universo exacto de folios asociados a Zona Norte 2 antes de modificar datos.
- [x] Asignar el cargo `Subgerente de Operaciones`, el rol efectivo equivalente a gerente de zona y el alcance Zona Norte 2 con cambio minimo y auditable.
- [x] Verificar por lectura posterior que Andres ve el universo completo esperado y que no recibe alcance sobre otras gerencias.
- [x] Ejecutar gates proporcionales, registrar evidencia y documentar el cierre.

Resultado:
- Perfil productivo unico `andres.barraza@busesjm.com` actualizado a `Subgerente de Operaciones`; conserva `operaciones_l_1` y suma `gerencia` + `aprobador_folios` para no perder acceso operativo.
- Las tres variantes CECO de Zona Norte 2 (`10114`, `20114`, `40114`) quedaron activas en `cost_center_approvers` con Andres como responsable.
- Los 30 mappings BUK de esos CECO quedaron con `manager_name = Andres Barraza Mera`, por lo que las solicitudes futuras resuelven al nuevo responsable y no solo cambian visibilidad historica.
- Universo verificado: 72 folios de la zona, 72 visibles y 0 ocultos; fuera de la zona no ve folios ajenos, salvo 5 solicitudes propias cubiertas por la regla normal de requester.
- No existian aprobaciones `area_manager` pendientes que requirieran reasignacion retroactiva.
- Migracion productiva `20260805192058_assign_andres_barraza_zona_norte_2` aplicada y registrada. `audit:migrations`, `audit:supabase-security`, smoke transaccional con rollback, lectura posterior, Guardian y `git diff --check` pasan.

## Reclutamiento BUK - sincronizacion operativa de tallas - 2026-08-04

- [x] Confirmar el contrato vivo de atributos personalizados de empleado en BUK y el universo productivo afectado.
- [x] Incorporar numero de calzado, talla de pantalon y talla de polera en creacion, clonacion y reconciliacion de fichas BUK.
- [x] Verificar por lectura posterior que BUK persiste exactamente los tres valores antes de finalizar el job como exitoso.
- [x] Agregar guardrails y pruebas para impedir que las tallas vuelvan a quedar solo en el snapshot ERP.
- [x] Desplegar la Edge Function, ejecutar un canario controlado y regularizar los trabajadores historicos afectados con trazabilidad.
- [x] Reconciliar ERP versus BUK, ejecutar Guardian y documentar el cierre productivo.

Resultado:
- `sync-buk-candidates` envia `Numero Calzado`, `Talla Pantalón` y `Talla Polera` como `custom_attributes` de empleado tanto en alta como en clonacion.
- Antes de continuar con plan, cargo, documentos y cierre exitoso, la funcion lee la ficha BUK; solo ejecuta `PATCH /employees/{id}` si existe drift y luego confirma las tres tallas y la preservacion de atributos ajenos.
- El PATCH de tallas tiene timeout de 15 segundos. Una respuesta ambigua deja el job en error; el reintento comienza con GET y no vuelve a escribir si BUK ya quedo alineado.
- Canario productivo: tres tallas actualizadas y seis atributos personalizados ajenos preservados exactamente antes de abrir el lote.
- Historico desde la obligatoriedad: 11 fichas elegibles, 1 ya alineada por canario y 10 regularizadas; 11/11 coinciden ERP-BUK y 11/11 conservan checkpoint verificado sin duplicar los valores en la evidencia.
- Produccion: `sync-buk-candidates` v42 `ACTIVE`; smoke sin autenticacion responde 401. Guardrails BUK, integridad, Deno check, Guardian y reconciliacion directa pasan sin errores.

## Certificados de competencias - nuevos modelos 4x4 - 2026-08-04

- [x] Auditar el contrato real del catálogo y confirmar marcas, tipos, modelos y códigos existentes para evitar duplicados.
- [x] Confirmar el catálogo productivo vivo y resolver si `Hilux / Fortuner 4x4` corresponde a una opción combinada o modelos separados.
- [x] Crear migración forward-only e idempotente para los cuatro registros solicitados, sin alterar opciones vigentes.
- [x] Extender el guardrail del catálogo con marca, tipo, modelo visible y estado activo esperados.
- [x] Aplicar en producción y validar RPC/catálogo visible con consulta directa.
- [x] Ejecutar auditorías de migración, seguridad, catálogo, build/Guardian y documentar el cierre.

Solicitud visual:
- Toyota · Camioneta · `Hilux / Fortuner 4x4`.
- Mitsubishi · Camioneta · `L200 4X4`.
- Maxus · Camioneta · `T60 4X4`.
- Mercedes Benz · Minibus · `Sprinter 516 4x4`.

Resultado:
- El catálogo productivo no tenía Toyota, Mitsubishi, el tipo `Camioneta` ni equivalentes semánticos de los cuatro modelos. Maxus, Mercedes Benz y `Mini Bus` fueron reutilizados sin modificar opciones existentes.
- La fuente visual se respetó como una opción combinada `Hilux / Fortuner 4x4`; no se inventaron dos modelos separados.
- Migración productiva `20260804164148_add_competency_4x4_models`: agrega `Camioneta`, TOYOTA, MITSUBISHI y los cuatro modelos mediante upserts idempotentes con postcondición SQL.
- `db push --dry-run` quedó bloqueado por versiones legacy remotas sin archivo local; se aplicó el SQL verificado con `supabase db query --linked` y se registró únicamente `20260804164148` como aplicada mediante `migration repair`.
- Smoke transaccional previo confirmó las cuatro tuplas y `ROLLBACK` dejó 0 filas; después de aplicar, consulta directa y `get_competency_catalogs()` autenticado devolvieron las cuatro opciones activas con marca/tipo correctos.
- RLS, grants, RPC y Edge Function no cambiaron. Los advisors mantienen hallazgos históricos, sin uno nuevo derivado de este cambio de catálogo.
- Validación final: migraciones, seguridad Supabase, guardrail de catálogo, TypeScript/build, smokes, pruebas y Guardian full con 27 gates pasan; 0 errores y 0 warnings.

## Limpieza profunda de duplicados y residuos locales - 2026-08-04

- [x] Confirmar el origen, contenido y alcance de las carpetas con sufijo ` 2` dentro de `node_modules`.
- [x] Respaldar de forma recuperable la instalacion local completa y reconstruirla exclusivamente desde `package-lock.json`.
- [x] Auditar duplicados versionados, codigo huerfano, documentos, binarios, caches y artefactos fuera de `node_modules`.
- [x] Eliminar solo residuos confirmados, conservando archivos con contrato runtime, operativo, legal o de auditoria.
- [x] Validar dependencias, TypeScript, build frontend, pruebas afectadas, auditoria de limpieza, Guardian y estado Git.
- [x] Documentar conteos, decisiones de conservacion, ubicacion del respaldo y cierre verificable.

Estado inicial:
- Las 16 carpetas `node_modules/@types/* 2` reportadas originalmente fueron movidas a `/tmp/app-test-types-duplicates.G6aHbQ`; las 16 estan vacias y no pertenecen al codigo versionado.
- Persisten 184 carpetas `* 2` vacias en el resto de `node_modules`, junto con residuos `extraneous` de una instalacion Deno/npm mixta. La evidencia de nombres, fechas y atributos macOS indica una colision local de copia o sincronizacion, no paquetes creados por npm.
- `node_modules/` esta ignorado y Git no versiona ningun archivo bajo esa ruta.

Resultado:
- La instalacion completa corrupta quedo respaldada en `/tmp/app-test-node-modules-backup.EZdr3z/node_modules` (280 MB) y fue reconstruida con `npm ci`; `npm ls --depth=0` pasa y quedan 0 rutas con sufijo ` 2`.
- Como macOS rehidrato copias vacias antiguas durante validaciones posteriores, la instalacion activa se movio fuera de `Documents` a `/Users/maximilianocontrerasrey/.codex/cache/app_test_1-runtime-20260804/node_modules` y el repo conserva un enlace `node_modules` ignorado. Node, Vitest, TypeScript, Deno y Guardian full quedaron validados con esa estructura.
- Se retiraron 21 MB de `dist`, cobertura, `tsbuildinfo`, `.DS_Store`, temporales Supabase y outputs de validacion a `/tmp/app-test-generated-artifacts-backup.UvijoE`; seis copias conflictivas `.git/index|refs N` quedaron en ese mismo respaldo.
- Se eliminaron ocho APIs frontend sin referencias y sus cadenas privadas; dos bloques identicos de normalizacion de candidato se consolidaron. Reduccion neta en `src`: 242 lineas.
- El unico duplicado binario tracked es `app-logo.png` en `public` y `src/assets`; se conserva porque sostiene favicon publico e import Vite. No hay documentos Markdown identicos, Office, PDF, ZIP, dumps ni logs tracked.
- PostCSS se actualizo de 8.5.18 a 8.5.25 y `npm audit` bajo de 3 a 2 moderadas. Las restantes son React Router y solo se corrigen con el salto mayor a v7.
- Seguridad local: `.env.local` quedo en modo `0600` y se retiro `VITE_GROQ_API_KEY` sin consumidor. Los seeds SharePoint con PII quedan bajo revision de gobierno porque borrarlos sin purgar historial Git no elimina la exposicion historica.
- Validacion: 64 unitarias, 6 contratos, TypeScript/build, auditoria de limpieza y Guardian full con 27 gates pasan; 0 errores y 0 warnings.

## Backfill Solicitud de Contratacion para trabajadores ya creados en BUK - 2026-08-04

- [x] Auditar el contrato productivo, resolver universo elegible y confirmar que cada candidato tenga ficha BUK efectiva.
- [x] Diseñar un backfill backend autoritativo e idempotente, con confirmacion previa de cantidad y sin reintentos ciegos.
- [x] Mantener BUK como unica custodia del PDF: generar en memoria y persistir en Supabase solo metadata, hash, token, estados y referencias BUK.
- [x] Implementar migracion/Edge Function y pruebas que impidan incorporar bucket/path/binario del PDF al ERP.
- [x] Ejecutar Guardian y smokes controlados antes de desplegar.
- [x] Confirmar universo final, desplegar y ejecutar backfill productivo por lotes con reconciliacion y evidencia.

Estado inicial:
- La generacion forward-only ya sube el PDF directamente a `Postulación` en BUK mediante un `Blob` en memoria; no crea objetos en Supabase Storage.
- El backfill historico se limita exactamente al bucket productivo `Personal contratado`: `stage_code = 'hired'` y exito BUK efectivo. No incluye candidatos de otras etapas aunque tengan datos completos o jobs antiguos.
- El levantamiento previo detecto 56 personas en ese bucket: 54 con checkpoints documentales historicos y 2 sin evidencia documental; antes de ejecutar existian 0 Solicitudes historicas.
- En el flujo futuro, la Solicitud solo puede reservarse y generarse despues de que el candidato ingresa a `Personal a Contratar` y la accion `Generar en BUK` obtiene una ficha BUK efectiva; nunca durante Control de candidatos ni por el solo cambio de etapa.

Resultado:
- El selector backend usa exactamente `stage_code = 'hired'` mas `is_effective_buk_generation_success(...)`; no reencola ni modifica jobs historicos y reconstruye `SI`/`N/A` desde payloads/checkpoints BUK 2xx.
- Universo productivo: 56 en `Personal contratado`; 53 emitibles y 3 RC-0067 bloqueados porque siguen `pending` y no tienen validador/fecha. No se inventaron firmas.
- Canario RC-0105 y 52 restantes procesados secuencialmente en 6 lotes de hasta 10: 53 `generated/success`, 53 QR `valid`, 53 hashes/tamanos completos, 0 fallidos y 0 `reconciliation_required`.
- Los 53 PDFs fueron enviados directamente a `Postulación` en BUK. El cierre transaccional guarda metadata minima, purga el snapshot privado y audita la carga; `storage.objects` contiene 0 archivos `SC-AAAA-NNNNNN.pdf`.
- Migraciones productivas `20260804145954_add_hiring_document_backfill` y `20260804151115_harden_hiring_document_backfill_finalization`; `sync-buk-candidates` v41 activo. La credencial temporal del backfill fue eliminada al terminar.
- Verificacion: Edge logs del backfill HTTP 200, source jobs con 0 checkpoints nuevos, RPC privadas solo `service_role`, 9 pruebas focalizadas y Guardian completo sin errores ni warnings.

## Solicitud de Contratacion ERP y carga documental BUK - 2026-08-04

- [x] Inspeccionar las referencias visuales, el generador productivo de certificados, el contrato real de RC-0105 y el catalogo documental vigente.
- [x] Presentar una maqueta A4 deterministica con datos reales anonimizables, marca de muestra y la estetica del certificado de competencias.
- [x] Obtener aprobacion visual explicita antes de modificar el generador o el flujo BUK.
- [x] Disenar el contrato backend autoritativo: snapshot, folio/token, logo por empresa, firma electronica visual y estados de carga BUK idempotentes.
- [x] Implementar con migracion forward-only, Edge Function y reutilizacion del upload documental existente, sin relajar RLS, grants ni autenticacion.
- [x] Validar generacion, QR/verificacion, carga en BUK, reintentos/idempotencia, auditorias Supabase, Guardian y smoke productivo controlado.

Resultado:
- La Solicitud se genera dentro de `sync-buk-candidates` despues de crear/configurar al trabajador y antes de cargar sus documentos; se sube como PDF a la carpeta BUK `Postulación` junto con los documentos del candidato.
- El PDF A4 usa formato `F-RH-010`, logo variable por empresa, 10 antecedentes de contratacion, los 17 tipos documentales activos con `SI`/`N/A`, firma del validador ERP y QR token-only hacia `/verificar/documento/:token`.
- El backend congela snapshot y hash, reserva folio unico y separa el payload publico: no expone sueldo, adjuntos, URL BUK ni RUN completo. Tablas y RPC quedan sin acceso `anon`/`authenticated`, con RLS deny y ejecucion exclusiva `service_role`.
- Los estados ambiguos de carga BUK se bloquean como `reconciliation_required`; un `processing` heredado tampoco se reintenta a ciegas. El checkpoint BUK queda persistido en el job antes de cerrar el documento.
- Produccion: migraciones `20260804141923_add_hiring_request_documents` y `20260804142435_index_hiring_request_document_foreign_keys`; Edge Functions `verify-hiring-document` v1, `verify-competency-certificate` v2 y `sync-buk-candidates` v35 `ACTIVE`.
- Smoke productivo transaccional sobre RC-0105 valido snapshot, folio, 17 documentos y verificacion previa, y `ROLLBACK` confirmo 0 documentos persistidos. Los dos verificadores respondieron HTTP 200; competencias devuelve RUN de trabajador e instructor enmascarados.
- Validacion local: PDF real renderizado A4 de una pagina, Deno checks, idempotencia, build, rutas publicas/protegidas, migraciones, seguridad, performance, `git diff --check` y Guardian full pasan con 26 gates, 0 errores y 0 warnings. Advisors sin hallazgos de seguridad nuevos; los nueve indices FK sugeridos quedaron aplicados.

## Auditoria integral de codigo, logs y seguridad - 2026-08-03

- [x] Levantar baseline reproducible del repositorio: estado Git, dependencias, TypeScript, build, tests, Guardian y auditorias EEES/Supabase.
- [x] Revisar en paralelo frontend/runtime, backend Supabase/Edge Functions, seguridad/autorizacion y complejidad/duplicacion contra contratos vivos.
- [x] Inspeccionar logs disponibles de CI y Supabase, separando incidentes activos de warnings historicos baselineados.
- [x] Corregir solo hallazgos confirmados con causa raiz y cambio minimo; usar migraciones forward-only y no relajar RLS/grants.
- [x] Reducir codigo repetido solo cuando preserve contratos publicos y quede cubierto por pruebas o gates existentes.
- [x] Reejecutar validacion proporcional al cambio, Guardian y `git diff --check`; documentar hallazgos, riesgos residuales y resultado final.

Estado inicial:
- `main` limpio y alineado con `origin/main` en `aeb0861`.
- La auditoria parte desde EEES, contratos reales y el baseline historico de seguridad; no se consideran corregibles los 82 warnings historicos sin evidencia nueva de explotabilidad.
- Breaking changes Supabase revisados al 2026-08-03: vigilar versionado explicito de extensiones desde 2026-08-05 y exposicion Data API de tablas nuevas; no se asumira que una tabla `public` nueva queda accesible sin grants/RLS explicitos.

Resultado:
- Seguridad de sesion: `AuthContext` cancela y limpia React Query y el estado de autorizacion al cambiar identidad; las respuestas asincronas antiguas ya no pueden sobrescribir la sesion nueva.
- Privacidad: Operaciones deja de persistir el directorio de conductores en `localStorage` y purga snapshots v1; ORION aplica allowlist recursiva y redaccion de RUT, correo y telefono antes de entregar resultados de herramientas al proveedor externo.
- Exactitud: las fechas SQL `YYYY-MM-DD` se formatean como fechas calendario UTC, evitando el desplazamiento al dia anterior en Chile.
- Edge Functions: se corrigieron errores reales de `deno check` en ORION, procesador de documentos y sincronizacion de cargos BUK; los cuatro checks Edge quedaron incorporados al Guardian full.
- Reduccion: `competencyApi.ts` conserva solo cuatro escrituras y delega lecturas al boundary existente; se elimina el preview PDF sin consumidores y cinco dependencias frontend asociadas. Son 903 lineas productivas menos, 642,227 bytes menos en `dist`, 478,046 bytes menos de JS y tres chunks menos.
- Logs: GitHub Actions no mostro fallas funcionales activas; el ultimo fallo del commit auditado era solo el baseline JS (+2,530 bytes) y queda absorbido por la reduccion medida. Auth/Storage Supabase no mostraron errores activos; los conectores de logs API/Postgres/Edge no respondieron y quedan como limitacion de evidencia, no como PASS inferido.
- Produccion: `orion-chat` desplegada como version 30 `ACTIVE`, manteniendo `verify_jwt=false` porque valida el bearer dentro de la funcion. Smoke sin token responde `401` con `Sesion invalida para ORION`; la fuente remota contiene `privacy.ts` y la metrica de redaccion.
- Validacion: Guardian full PASS con 25 gates, 0 errores y 0 warnings; 64 unitarias, contratos, integridad, concurrencia, idempotencia, cobertura, TypeScript, build, rutas, migraciones, seguridad Supabase, performance, cuatro checks Edge y `git diff --check` pasan.
- Estado historico al 2026-08-03: `npm audit --omit=dev` mantenia dos moderadas de React Router cuya unica correccion disponible entonces era un salto mayor. **Este riesgo fue cerrado el 2026-08-05** mediante la migracion validada a React Router `8.3.0`; los 82 warnings historicos Supabase siguen baselineados y no se detectaron nuevas exposiciones anonimas/RLS.

## Navegacion superior ERP - responsivo celular

- [x] Reproducir/inspeccionar contrato real del `AppShell` y CSS global del topnav.
- [x] Corregir el menu desplegable en móvil para que quede por encima del contenido y se pueda tocar/scrollear sin quedar tapado.
- [x] Mantener intacto el comportamiento desktop mediante media queries acotadas a pantallas chicas.
- [x] Validar frontend, diff y, si es posible, navegación móvil con browser local.
- [x] Corregir reapertura productiva: flecha cambia en celular, pero las opciones siguen ocultas bajo saludo/widget.
- [x] Validar que el panel móvil queda fuera del scroller del topnav y sobre ORION/widget.

Resultado:
- `AppShell` marca el header con `top-shell--nav-open` mientras un modulo esta desplegado.
- En celular (`max-width: 768px`) el header queda sticky, la barra conserva logo/nav/acciones en una fila compacta, el nav permite scroll horizontal tactil y el dropdown abre como panel fijo sobre el contenido, con ancho de viewport, `z-index` superior y scroll vertical.
- En escritorio el dropdown conserva su contrato anterior: header `relative` y panel `absolute`.
- Validacion: `build:frontend-check`, `git diff --check`, Playwright en 390x844 y 1280x800, y `guardian` pasan. El baseline performance sube solo por la capa responsive medida: +2,464 bytes total, +38 JS, +2,426 CSS; sin vendors ni assets nuevos.
- Reapertura corregida: el panel movil ahora se renderiza como `top-nav-mobile-panel` fuera del scroller `.top-nav-stage`; el dropdown desktop queda oculto en movil con `top-nav-dropdown-panel--desktop`. Playwright con saludo/dashboard y ORION `z-index: 9999` confirma que el elemento superior bajo el punto del panel abierto pertenece al menu.

## Reclutamiento - ficha candidato obligatoria antes de Listo para contratar

- [x] Confirmar contrato vivo de `get_candidate_checklist(...)`, ficha BUK candidato y `advance_recruitment_candidate_stage(...)`.
- [x] Hacer obligatoria la ficha del candidato antes de avanzar a `ready_for_hire`, incluyendo numero calzado, talla pantalon y talla polera.
- [x] Entregar mensajes claros con campos faltantes cuando la ficha no este completa.
- [x] Validar con pruebas focalizadas, auditorias SQL/frontend y diff limpio.

Resultado:
- La migracion `20260730211444_require_candidate_buk_file_before_ready_for_hire` recompila `get_candidate_checklist(...)` para incluir `Ciudad`, `Número calzado`, `Talla pantalón` y `Talla polera` en la completitud de ficha.
- `advance_recruitment_candidate_stage(...)` recalcula el checklist antes de pasar a `ready_for_hire`; si falta ficha, bloquea con mensaje claro y lista de campos pendientes, aunque la revision documental haya sido aprobada antes.
- Control Documental muestra los campos concretos faltantes de la ficha del candidato.
- La validacion remota fue transaccional con `ROLLBACK`: un candidato no terminal con tallas vacias fue puesto temporalmente en `document_review` aprobado y la RPC rechazo el avance por ficha incompleta; luego se confirmo que su etapa y validacion documental originales permanecieron intactas.
- Validacion local: unitarias, TypeScript, `build:frontend-check`, `audit:migrations`, `audit:supabase-security`, `audit:performance-baseline`, `guardian` y `git diff --check` pasan.

## Reclutamiento/BUK - bloqueo estructural de sobrecupo

- [x] Auditar flujo completo de cupos: paso a `ready_for_hire`, encolado `enqueue_buk_generation`, exito BUK y movilidad interna.
- [x] Definir regla backend autoritativa que reserve cupos por caso con contratados, BUK efectivo, jobs BUK `pending/processing` y movilidad interna vigente, sin bloquear al propio candidato.
- [x] Corregir RPCs/migraciones para impedir que BUK genere candidatos por sobre `requested_vacancies` aunque la UI seleccione de mas.
- [x] Ajustar UI de `Personal a Contratar` para mostrar y evitar selección de candidatos bloqueados por sobrecupo.
- [x] Validar con smoke SQL productivo, tests, build, auditorias Supabase, performance y Guardian.

Resultado:
- Se agrego `get_recruitment_case_buk_capacity_snapshot` como regla backend unica de capacidad por caso: suma contratados/BUK efectivo, jobs `pending/processing` y movilidades internas pendientes o aprobadas en ejecucion.
- `enqueue_buk_generation` bloquea el encolado sobre cupo con lock del caso y reserva por lote, por lo que una seleccion masiva no puede encolar mas personas que cupos disponibles.
- `claim_buk_sync_jobs` vuelve a validar capacidad antes de procesar y marca jobs excedentes como `error` con `vacancyGuard`, cubriendo jobs antiguos, retries y concurrencia.
- `Personal a Contratar` consume `buk_available_vacancies` y deshabilita candidatos cuyo caso ya no tiene cupo; al seleccionar todo solo toma los primeros candidatos que caben por caso.
- Migracion remota aplicada en Supabase como `20260729150153_guard_buk_generation_vacancy_overfill`.
- Smoke productivo de solo lectura: funciones `SECURITY DEFINER` y grants esperados; cola BUK actual en 0 `pending` y 0 `processing`; `claim_buk_sync_jobs(1, null)` retorna 0 sin error.
- Deuda historica detectada: `RC-0052` ya tiene 3 BUK efectivos para 2 cupos antes de este guardrail. No se corrige automaticamente porque son trabajadores ya generados en BUK.
- Validacion local: TypeScript directo, `test:integrity`, `test:concurrency`, `audit:migrations`, `audit:supabase-security`, `check:edge:sync-buk-candidates`, `build:frontend-check`, `audit:buk-sync-guards`, `audit:performance-baseline`, `git diff --check` y `guardian` pasan.

## Business Intelligence - nitidez etiquetas Inversion por contrato

- [x] Ubicar el render real del grafico `Inversión por contrato` en Incentivos BI.
- [x] Corregir estilo de texto dentro de barras para eliminar contorno/fondo blanco pixelado.
- [x] Validar TypeScript, build frontend, performance y Guardian antes de cerrar.

Resultado:
- El grafico `Inversión por contrato` estaba renderizando labels con `textBorderWidth = 3` y borde blanco, lo que generaba un halo pixelado tipo fondo blanco sobre la barra.
- Se elimina el contorno blanco y se deja texto oscuro semitransparente, `12px`, peso 700, distancia interna estable y truncado nativo por ancho para conservar nitidez y evitar cajas artificiales.
- Validacion: TypeScript directo, `build:frontend-check`, `audit:performance-baseline`, `git diff --check` y `guardian` pasan.

## Business Intelligence - filtros Jornada no refrescan tarjetas para Manuel Parra

- [x] Reproducir con usuario Manuel Parra si el RPC BI cambia `summary` y `averageHiringDays` al recibir `p_shift_names`.
- [x] Confirmar si el problema esta en envio frontend, cache/query key, normalizacion de jornada o calculo backend.
- [x] Corregir causa raiz sin relajar permisos BI ni romper filtros de gerencia/contrato/cargo.
- [x] Validar produccion, TypeScript, unitarias, build, performance y Guardian antes de versionar.

Resultado:
- Smoke productivo transaccional con `manuel.parra@busesjm.com`: sin filtro Jornada el RPC devuelve `averageHiringDays = 99.1`; con `7X7` devuelve `143.7`; con `10X5+5` devuelve `19.8`. El backend y permisos BI para gerencia si filtran correctamente.
- Causa raiz frontend: BI Reclutamiento heredaba `staleTime` de 5 minutos y podia mantener tarjetas antiguas visibles durante el refetch, por eso `Tiempo Medio de Contratacion` seguia mostrando `3 meses 9 dias`.
- `useBiRecruitmentDashboard` ahora fuerza datos frescos (`staleTime = 0`, `gcTime = 0`, `refetchOnMount = "always"`) y la vista considera `isFetching` como carga para no presentar indicadores obsoletos mientras cambia Jornada.
- Se agrega test de regresion para que el dashboard BI Reclutamiento conserve esta politica de frescura.
- Validacion: TypeScript directo, unitarias, `build:frontend-check`, `audit:migrations`, `audit:supabase-security`, `audit:performance-baseline`, `git diff --check` y `guardian` pasan. No requirio migracion SQL.

## Business Intelligence - estetica de graficos Reclutamiento

- [x] Homologar las donas de Reclutamiento al estilo visual e interactivo de Incentivos, manteniendo colores propios.
- [x] Aplicar labels truncados, separacion entre segmentos, sombra suave y leyenda inferior con iconos circulares.
- [x] Mantener tooltips operativos actuales de cobertura y movilidad.
- [x] Validar TypeScript, unitarias, build frontend, performance y Guardian antes de versionar.

Resultado:
- Las donas `Cobertura de Cupos` y `Estado de Movilidad Interna` usan radio `50%/75%`, centro superior, `padAngle`, borde redondeado, sombra suave y leyenda inferior con icono circular, homologadas con Incentivos.
- Los colores siguen siendo los propios de Reclutamiento; no se mezclo paleta con Incentivos.
- Los tooltips pasan al formato `.chart-tooltip` y conservan la informacion operativa de cobertura, contratacion, movilidad, faltantes y solicitudes.
- La ruta local `/bi/reclutamiento` redirige a `/login` sin sesion, por lo que la verificacion visual navegada quedo limitada a autenticacion; build y Guardian validan render sin errores.
- Validacion: TypeScript directo, unitarias, `build:frontend-check`, `audit:performance-baseline`, `git diff --check` y `guardian` pasan.

## Business Intelligence - paleta cobertura y movilidad

- [x] Cambiar `Cupos faltantes` a rojo opaco, sin usar naranja chillón.
- [x] Separar colores de `Pendiente ejecución RRHH` y `Pendiente control contratos` en movilidad interna.
- [x] Alinear orden/paleta de etapas BI con `Levantamiento de Contraindicación`.
- [x] Validar frontend, tests unitarios, performance y Guardian antes de versionar.

Resultado:
- `Cupos faltantes` usa `missingVacancies` (`#b95a4f` en tema claro), separado del naranja general `pending`.
- `Pendiente ejecución RRHH` mantiene morado de movilidad y `Pendiente control contratos` usa indigo propio, evitando dos criterios con el mismo color.
- El orden de etapas BI incorpora `Levantamiento de Contraindicación` entre `Exámenes médicos` y `Revisión documental`.
- Validacion: TypeScript directo, unitarias, `build:frontend-check`, `audit:performance-baseline`, `git diff --check` y `guardian` pasan.

## Control de Contrataciones - filtros multiples y contraindicacion medica

- [x] Convertir filtros de procesos a seleccion multiple, con busqueda digitada al menos en Turno y Contrato.
- [x] Agregar etapa opcional `Levantamiento de Contraindicacion` entre Examenes Medicos y Revision Documental.
- [x] Actualizar contratos frontend/backend, labels, constraints y transiciones sin romper etapas existentes.
- [x] Validar localmente, aplicar migracion productiva y versionar en `main`.

Resultado:
- `Control de Contrataciones` usa `MultiSelectField` para Turno, Pasajes, Alojamiento y Contrato; Turno y Contrato permiten digitar para acortar busqueda y todos aceptan mas de una seleccion.
- Se agrega la etapa opcional `medical_contraindication_resolution` con label `Levantamiento de Contraindicación`: desde `medical_exams` se puede ir a esa etapa o directo a `document_review`; desde la nueva etapa solo se puede continuar a documental o cerrar la participacion.
- La migracion `20260727203203_add_medical_contraindication_resolution_stage` actualiza constraint, RPC `advance_recruitment_candidate_stage`, grants y reload de PostgREST sin relajar permisos.
- Migracion remota aplicada y registrada. Smoke productivo transaccional: candidato `d0b89e6f-cbae-44c6-8fb6-a4ce3d07c793` avanzo a `medical_contraindication_resolution` dentro de `begin/rollback` y luego quedo confirmado nuevamente en `medical_exams`.
- Validacion: unitarias, contratos, integridad, TypeScript directo, `build:frontend-check`, `audit:migrations`, `audit:supabase-security`, `audit:performance-baseline`, `git diff --check` y `guardian:full` pasan con 0 errores y 0 warnings.

## Business Intelligence - gerencia sin data en Reclutamiento

- [x] Confirmar matriz productiva de `bi_analytics`/`bi_reclutamiento` para roles gerenciales.
- [x] Confirmar causa raiz de datos vacios para usuarios `gerencia` sin centro de costo asociado.
- [x] Ajustar RPCs de BI Reclutamiento para que `bi_reclutamiento` habilite alcance BI completo sin relajar pantallas operativas.
- [x] Validar localmente, aplicar migracion remota y smoke por rol gerencial real.
- [x] Versionar y pushear a `main` si Guardian queda limpio.

Resultado:
- La matriz productiva tiene `bi_analytics` y `bi_reclutamiento` activos para `admin`, `reclutamiento`, `control_contratos`, `director_eje`, `gerente_general`, `director_op` y `gerencia`.
- Causa raiz: usuarios `gerencia` puros tenian acceso a la pestaña, pero `user_can_view_hiring_request_process_summary` les devolvia 0 filas si no estaban configurados como aprobadores de centro de costo.
- La migracion `20260727201912_allow_bi_recruitment_feature_full_data_scope` ajusta solo los RPC BI `get_bi_recruitment_dashboard` y `get_bi_recruitment_daily_timeline`: si el usuario tiene feature `bi_reclutamiento`, ve el universo BI completo; no cambia permisos operativos de folios.
- Smoke productivo con `alan.brain@busesjm.com` (`gerencia` puro): dashboard actual devuelve 52 folios abiertos, 112 cupos solicitados y 91 candidatos en curso; con Jornada `7X7` devuelve 4 folios y 7 cupos; timeline `7X7` devuelve 31 dias.
- Validacion: unitarias, TypeScript, `build:frontend-check`, `audit:migrations`, `audit:supabase-security`, `git diff --check` y `guardian:full` pasan. Migracion remota aplicada y registrada en `supabase_migrations.schema_migrations`.

## Business Intelligence - Jornada no refresca indicadores

- [x] Corregir query key BI para que `shiftNames` cambie cache/refetch de tarjetas y graficos.
- [x] Confirmar que el backend productivo ya cambia metricas cuando recibe `p_shift_names`.
- [x] Agregar tests contra regresion de filtros BI y validar Guardian antes de versionar.

Resultado:
- Causa raiz: `queryKeys.bi.recruitmentDashboard(filters)` no incluia `shiftNames`; al cambiar Jornada React Query mantenia la misma cache key y no reconsultaba tarjetas/graficos.
- `get_bi_recruitment_dashboard('current', ..., array['7X7'])` en produccion devuelve metricas filtradas, por lo que no se requiere nueva migracion SQL para este bug.
- El embudo `BiRecruitmentFunnel` pertenece a Dotacion y no recibe el filtro Jornada visible en Reclutamiento; no es parte de la correccion de esta pestaña.
- Se agrega test de regresion para que `shiftNames` forme parte de la key y se mantiene normalizacion estable por orden/espacios.
- Validacion: unitarias, TypeScript, `build:frontend-check`, `audit:migrations`, `audit:supabase-security`, `audit:performance-baseline`, `git diff --check` y `guardian:full` pasan.

## Business Intelligence - filtro jornada y formato tiempo medio

- [x] Confirmar fuente real de jornada/turno para BI Reclutamiento y valores productivos.
- [x] Extender RPC y tipos frontend para filtrar por jornada con opciones dinamicas.
- [x] Ajustar layout de filtros: periodo mas pequeno y cinco filtros ordenados sin amontonamiento.
- [x] Cambiar `Tiempo Medio de Contratacion` a formato años, meses y dias omitiendo unidades en cero.
- [x] Validar localmente, versionar y aplicar migracion productiva si corresponde.

Resultado:
- La fuente productiva de Jornada es `hiring_requests.shift_name`; movilidad interna usa fallback `internal_mobility_requests.destination_shift_name` cuando corresponde.
- `get_bi_recruitment_dashboard` y `get_bi_recruitment_daily_timeline` tienen overload compatible con `p_shift_names`, aplicado a resumen, graficos, timeline, movilidad y opciones del filtro.
- El frontend agrega filtro `Jornada`, achica `Periodo` en el grid de Reclutamiento y limpia selecciones que ya no existen al cambiar filtros.
- `Tiempo Medio de Contratacion` ahora muestra años, meses y dias, omitiendo unidades en cero; por ejemplo `99.1` dias se muestra como `3 meses 9 días`.
- Validacion local: unitarias, `build:frontend-check`, `audit:migrations`, `audit:supabase-security`, `audit:performance-baseline`, `git diff --check` y `guardian:full` pasan. Migracion remota `20260727191632_add_bi_recruitment_shift_filter` aplicada y registrada; smoke productivo confirma catalogo de jornadas y filtro `7X7`.

## Business Intelligence - grafico cobertura cupos local pendiente

- [x] Confirmar fuente actual del grafico `Estado de Casos` y campos disponibles en `summary`.
- [x] Cambiar el grafico a porcentaje de cobertura entre cupos solicitados y cubiertos.
- [x] Mostrar en tooltip de cupos cubiertos desglose por contratacion y movilidad interna.
- [x] Validar TypeScript, build/performance y diff sin commit ni push a `main`.

Resultado:
- El grafico izquierdo de BI Reclutamiento pasa de `Estado de Casos` a `Cobertura de Cupos`.
- La dona muestra `Cupos cubiertos` versus `Cupos faltantes`, calculados desde `requestedVacancies` y `filledVacancies`, ambos ya filtrados por el RPC del dashboard.
- El tooltip de `Cupos cubiertos` muestra cobertura porcentual, total cubierto, contratacion, movilidad interna y cupos solicitados.
- Validacion local: TypeScript directo, `build:frontend-check`, `audit:performance-baseline` y `git diff --check` pasan. Sin commit ni push a `main`.

## Business Intelligence - tiempo medio de contratacion local pendiente

- [x] Confirmar contrato vigente de tarjetas BI Reclutamiento y RPC filtrado.
- [x] Calcular `Tiempo Medio de Contratacion` desde aprobacion del folio hasta primera contratacion real, sujeto a filtros BI.
- [x] Reemplazar la tarjeta `Listos para Contratar` por el nuevo indicador sin commit ni push a `main`.
- [x] Validar migraciones, seguridad Supabase, TypeScript, build, performance y diff limpio.

Resultado:
- El RPC `get_bi_recruitment_dashboard` entrega `summary.averageHiringDays` calculado por folio desde `recruitment_cases.opened_at` hasta la primera candidatura en `hired`.
- El indicador respeta permisos BI y filtros de gerencia, contrato y cargo; cuando hay periodo seleccionado, considera contrataciones cuya primera fecha de contratacion cae dentro del periodo.
- La tarjeta final de BI Reclutamiento cambia de `Listos para Contratar` a `Tiempo Medio de Contratacion` y muestra dias; sin contrataciones validas para el filtro muestra `Sin datos`.
- Validacion local: unitarias, `audit:migrations`, `audit:supabase-security`, TypeScript directo, `build:frontend-check`, `audit:performance-baseline` y `git diff --check` pasan. Sin commit ni push a `main`.

## Business Intelligence - visibilidad Reclutamiento local pendiente

- [x] Confirmar matriz real de `bi_analytics` y feature `bi_reclutamiento`.
- [x] Dar acceso a pestaña BI Reclutamiento para `reclutamiento`, roles gerenciales y administradores de contratos.
- [x] Validar migraciones, seguridad Supabase y TypeScript sin push a `main`.

Resultado:
- La ruta BI sigue gobernada por `role_module_access` sobre `bi_analytics`; la pestaña `Reclutamiento` sigue gobernada por `role_feature_access` sobre `bi_reclutamiento`.
- Migracion local `20260727184624_grant_bi_recruitment_access_roles.sql`: afirma `bi_analytics` y `bi_reclutamiento` para `admin`, `reclutamiento`, `control_contratos`, `director_eje`, `gerente_general`, `director_op` y `gerencia`.
- No se agrego bypass frontend: `BiDashboardPage` conserva el gating por `accessibleFeatures`, que es el contrato auditable devuelto por backend.
- Validacion local: `audit:migrations`, `audit:supabase-security`, TypeScript directo y `git diff --check` pasan. Sin commit ni push a `main`.

## Auditoria integral ERP front/back - 2026-07-27

- [x] Levantar estado limpio del repositorio, contratos vivos y puertas enterprise actuales.
- [x] Ejecutar auditorias de seguridad, migraciones, dependencias, build, tests y Guardian sin relajar controles.
- [x] Revisar funcionamiento critico pendiente: movilidad interna debe refrescar folios destino automaticamente sin recargar pagina.
- [x] Corregir solo hallazgos con causa raiz clara, de bajo riesgo operacional y trazabilidad backend/frontend.
- [x] Validar con gates locales completos y dejar versionado/push si el sistema queda estable.

Resultado:
- Estado inicial limpio en `main...origin/main`.
- `audit:migrations` pasa con 360 migraciones canonicas y sin duplicados.
- `audit:supabase-security` pasa sin errores; conserva 82 warnings historicos baselineados que no se corrigieron relajando ni reescribiendo permisos sin causa raiz.
- `npm audit` detecto 1 vulnerabilidad alta en `postcss` y 2 moderadas en `react-router`/`react-router-dom`; se actualizo `postcss` a `8.5.18` y la vulnerabilidad alta queda eliminada.
- Estado historico al 2026-07-27: React Router quedo temporalmente como riesgo moderado residual porque la correccion disponible exigia un cambio semver-major. **Este riesgo fue cerrado el 2026-08-05** mediante la migracion validada a React Router `8.3.0`.
- Movilidad interna: `eligible_folios` deja de cachearse 15 minutos; ahora refetchea al montar, foco, reconexion, Realtime de folios/aprobaciones y apertura del selector `Folio destino`.
- `build:frontend-check`, `npm run build`, unitarias, TypeScript directo, smoke de rutas y `git diff --check` pasan. El baseline performance final medido por Guardian full sube `distTotalBytes` a `10,671,549` y `jsTotalBytes` a `3,024,179`; CSS/vendors/assets trackeados quedan intactos.
- `guardian:full` pasa con 0 errores y 0 warnings.

## Administradores de contratos - alcance Mario Sierra Gorda

- [x] Revisar `buk_contract_mappings` para Mario, Angel y Jose en Sierra Gorda/DMH.
- [x] Corregir a Mario para que conserve solo `SIERRA GORDA OPERACIONES`.
- [x] Devolver `ARAMARK SIERRA GORDA INTERNO` a Angel Guerra y validar DMH.
- [x] Ejecutar gates SQL/Guardian y commitear/pushear a `main`.

Resultado:
- La migracion remota `20260723152941_fix_mario_pizarro_sierra_gorda_contract_scope` quedo registrada en `supabase_migrations.schema_migrations`.
- Validacion remota: Mario Pizarro Fernandez queda con 0 mappings DMH/Ministro Hales y 1 mapping `SIERRA GORDA OPERACIONES`.
- Validacion remota: `ARAMARK SIERRA GORDA INTERNO` queda asignado a Angel Guerra Basso.
- La migracion local `20260723152941_fix_mario_pizarro_sierra_gorda_contract_scope.sql` versiona el guardrail aplicado para reproducibilidad y auditoria.

## CI - Audit Enterprise Guardrails performance baseline

- [x] Auditar los runs fallidos reportados por correo en `Audit Enterprise Guardrails` para commits `fc73796`, `317571a`, `24866ca`, `ee90e10`, `ad5949a` y `9beefaf`.
- [x] Confirmar si existe un fallo activo distinto en tests, Supabase, Deno, smokes o build.
- [x] Corregir el baseline de performance con el valor canonico medido por GitHub Actions, sin relajar controles de vendors ni assets trackeados.
- [x] Reejecutar gates locales y dejar commit versionado para que el siguiente run de `main` cierre el ruido de correos.

Resultado:
- Todos los runs fallidos inspeccionados comparten una unica causa: `EEES Guardian` falla en `audit:performance-baseline`.
- Evidencia CI del run `30047476403`: `JS total 3023917 <= baseline 3022926`; el resto de gates reportados por Guardian pasan.
- Los logs de los runs `30044854591`, `30045700498`, `30047056230` y `30047476403` confirman el mismo valor `JS total = 3,023,917`.
- Correccion aplicada: `eees/baselines/PERFORMANCE_BASELINE_v1.md` sube a version `1.0.2` y actualiza solo `jsTotalBytes` a `3,023,917`, manteniendo sin cambios `distTotalBytes`, CSS y assets/vendors trackeados.

## BUK - mapping ZONA II CONTRATISTAS

- [x] Auditar el fallo de generacion BUK del candidato Christopher Williams Quispe Charcas contra job/snapshot productivo.
- [x] Confirmar contrato, numero BUK y area destino esperada para `ZONA II CONTRATISTAS`.
- [x] Corregir mapping de contrato/area con migracion forward-only si falta el enlace interno.
- [x] Validar con smoke remoto en rollback y gates SQL/Guardian antes de versionar.
- [x] Auditar el segundo fallo productivo por `company_id`, `area_id` o `leader_id` despues de restaurar el mapping JM.
- [x] Corregir la resolucion de solicitante BUK cuando el email ERP no coincide con el email vigente del snapshot BUK.
- [x] Desplegar `sync-buk-candidates` en Supabase productivo y reintentar el job real de Cristopher.

Resultado:
- El job BUK `33458800-64cb-4511-ae26-6cc93f6c2dff` fallo despues de reutilizar la ficha inactiva `42266`: `No existe un mapping BUK con area operativa para el contrato ZONA II CONTRATISTAS`.
- Produccion tenia `CONT-092` y `buk_contract_mappings.id = 92` en `0000000168:0001` pero con `buk_area_code = null`; por eso el worker no podia resolver el area operativa aunque la rama existiera en BUK.
- El catalogo BUK confirma `ZONA II CONTRATISTAS` bajo `JM` con area hija `id = 3008`, `name = 0000000168:0001`, `cost_center = 721`.
- La migracion productiva `20260723211426_fix_zona_ii_contratistas_buk_area_mapping` llevo temporalmente el mapping a CNN `0000000168:0004`; la aclaracion operacional posterior confirma que el destino correcto es Buses JM `0000000168:0001`.
- La migracion productiva correctiva `20260723213807_restore_zona_ii_contratistas_jm_buk_mapping` restaura `contracts` y `buk_contract_mappings` a `0000000168:0001`, `buk_area_code = 721`, `company_name = Buses JM Pullman S.A.`.
- Validacion remota posterior: `CONT-092` y mapping quedan con `contract_number = 0000000168:0001`, `buk_area_code = 721`, empresa resuelta `Buses JM Pullman S.A.`.
- Validacion BUK: el rol `PREVENCIONISTA DE RIESGOS` incluye `area_id = 3008`, por lo que el mapping ya no deberia fallar por area operativa.
- Validacion local: `audit:migrations`, `audit:supabase-security`, `git diff --check` y `guardian` pasan con la restauracion JM.
- El retry productivo posterior fallo en el job `487f5e26-1a06-45e9-862b-8a45d9b00dc7` despues de reutilizar la ficha BUK `42266`: ya resolvia contrato `0000000168:0001`, area `721` y rol, pero no podia completar `leader_id`.
- Causa raiz: la solicitud usa `requester_email = manuel.parra@busesjm.com`, mientras el snapshot BUK activo de Manuel Enrique Parra Soto tiene email `parrasotomanuelenrique@gmail.com`, `buk_employee_id = 19687` y `company_id = 1`; buscar solo por email dejaba `leader_id = 0`.
- Correccion aplicada: `sync-buk-candidates` mantiene la busqueda viva por email y agrega fallback auditado al cache local BUK por email exacto y por nombre del solicitante con coincidencia estricta de tokens, sin modificar maestros BUK ni crear datos sinteticos.
- Incidente persistente posterior: los jobs `12b3c8e6-1737-46cd-b448-581fad6d1a97` y `942cb0da-bb0e-415c-afd2-4311e69fe7be` fallaron porque la Edge Function productiva aun no tenia desplegado el commit `9beefaf`.
- Despliegue aplicado: `npx --yes supabase functions deploy sync-buk-candidates --project-ref pzblmbahnoyntrhistea --use-api --yes`; la funcion remota queda activa en version `34`.
- Smoke real productivo: reintento controlado del job `942cb0da-bb0e-415c-afd2-4311e69fe7be` termino `success`, BUK employee `42266`, job BUK `143977`, `company_id = 1`, `area_id = 3008`, `leader_id = 19687`, `role_id = 167`, `cost_center = 721`.

## Reclutamiento - tiempo abierto en resumen de procesos

- [x] Ubicar la tabla `Resumen de procesos de contratación` y el contrato RPC/frontend que alimenta la columna `Solicitó`.
- [x] Confirmar el campo autoritativo de aprobación completa del folio para calcular tiempo abierto.
- [x] Reemplazar `Solicitó` por `Tiempo Abierto` mostrando años, meses y días transcurridos.
- [x] Agregar cobertura focalizada y ejecutar gates frontend/enterprise.

Resultado:
- La tabla corresponde a `HiringProcessesView` y consume `get_recruitment_processes_page`.
- El contrato backend ya entrega `opened_at` para casos de reclutamiento y permite ordenar por `opened_at`; no requiere migracion SQL.
- La columna visible cambia de `Solicitó` a `Tiempo Abierto` y muestra duracion calendario desde `opened_at` como años, meses y dias.
- Validacion: `tests/unit/recruitment-open-duration.test.ts`, `tsc -b --pretty false`, `npm run build:frontend-check` y `npm run guardian` pasan.
- Baseline performance versionado en `1.0.1`: +671 bytes globales justificados por helper funcional testeado, sin nuevos vendors ni aumento de limites JS/CSS/assets trackeados.

## Correos Resend - auditoria y limitacion a eventos criticos

- [x] Auditar Edge Functions, triggers SQL, cron y tabla `transactional_email_dispatches`.
- [x] Medir volumen productivo por tipo de evento y destinatario.
- [x] Agregar control backend auditable por tipo de evento y recordatorios.
- [x] Aplicar configuracion productiva para permitir solo eventos criticos.
- [x] Validar que eventos no criticos no llamen Resend y que eventos criticos sigan encolando.

Resultado:
- Unica Edge Function que llama Resend: `hiring-transactional-email`.
- Configuracion productiva activa: `is_enabled = true`, `enabled_event_types = {pending_approval, who_approval, rejection}`, `reminders_enabled = false`.
- La migracion productiva quedo registrada por Supabase como `20260723205243_limit_resend_email_events_to_critical`; el archivo local usa la misma version.
- Volumen historico por destinatario: `recruitment_handoff` 432 envios-recipient, `pending_approval` 232, `personnel_to_hire` 210, `who_approval` 172, `competency_formalization` 42, `rejection` 21.
- Volumen ultimos 7 dias antes del corte: `personnel_to_hire` 95 envios-recipient, `recruitment_handoff` 60, `who_approval` 58, `competency_formalization` 42, `pending_approval` 42, `rejection` 2.
- Top destinatarios 14 dias: Maximiliano Contreras 64, Diego Lazcano 34, equipo administrativo de Personal a Contratar 32 cada uno, Maria Jesus Lagos 32, equipo Reclutamiento 15 cada uno.
- Smoke remoto sin consumir Resend: `personnel_to_hire` y `pending_approval` con `is_reminder = true` quedaron en 0 nuevos dispatches; la funcion conserva controles `enabled_event_types` y `reminders_enabled`, y no es ejecutable por `public`, `anon` ni `authenticated`.

## Reclutamiento - ciudad obligatoria y direccion base sin ciudad

- [x] Confirmar contrato vivo de ficha BUK candidato, helper frontend y RPC `upsert_candidate_person_profile`.
- [x] Ajustar direccion derivada para usar solo calle y numero, dejando ciudad como campo separado obligatorio.
- [x] Normalizar automaticamente ciudad a capitalizacion por palabra en backend autoritativo.
- [x] Agregar pruebas unitarias/migracion forward-only y ejecutar validaciones frontend/SQL relevantes.

Resultado:
- `Dirección base` queda derivada desde `Calle` y `Número de calle`; no concatena `Ciudad`.
- `Ciudad` queda obligatoria en la validacion de ficha personal BUK.
- La migracion `20260723161000_require_candidate_city_and_omit_city_from_address.sql` fue aplicada en Supabase, normaliza `current_city` con primera letra mayuscula por palabra, recompila `upsert_candidate_person_profile` para exigir ciudad y mantiene `address_line` sin ciudad.
- Validacion remota: ciudades no normalizadas = 0; direcciones estructuradas que aun contienen ciudad = 0; RPC rechaza `Ciudad es obligatoria` sin ciudad y normaliza `san pedro de atacama` a `San Pedro De Atacama` con `address_line = Petrohue Sur, #3213` en rollback.
- Validacion local: unitarias de reclutamiento, TypeScript, `build:frontend-check`, `audit:migrations`, `audit:supabase-security`, `audit:performance-baseline`, `guardian` y `git diff --check` pasaron.

## Reclutamiento - cierre regresion direccion base en candidatos por etapa

- [x] Auditar candidatos por etapa contra Supabase productivo y distinguir datos persistidos, RPC y fallback UI.
- [x] Limpiar datos legacy donde la ciudad quedo al final de `address_line` o `street_name`, sin tocar direcciones que solo contienen el texto de la ciudad en otra posicion.
- [x] Recompilar `upsert_candidate_person_profile(...)` para impedir que futuras ediciones persistan la ciudad dentro de calle/direccion base.
- [x] Endurecer el helper frontend para que el fallback inicial de la ficha tampoco muestre `, Ciudad`.
- [x] Ejecutar smokes remotos por etapa/candidato afectado y gates enterprise antes de versionar.

Resultado:
- La auditoria remota por etapa quedo con `address_trailing_city = 0` y `street_trailing_city = 0` para `hired`, `in_process`, `lead`, `medical_exams`, `ready_for_hire`, `rejected`, `who_approved` y `withdrawn`.
- El candidato de la captura, Osman Daniel Godoy Carrizo, devuelve por tabla y `get_candidate_buk_profile(...)` `address_line = SENDERO DEL SOL 585 DPTO A-42 CONDOMINIO PLAZA NORTE III` y `current_city = Antofagasta`, sin ciudad concatenada en direccion base.
- El unico caso legacy detectado con ciudad al final de `street_name` quedo corregido: Felipe Emmanuel Bravo Jofre mantiene `address_line = Avenida Santa Cruz 490, casa 98` y `current_city = La Cruz`.
- La migracion productiva quedo registrada por Supabase como `20260723204155_strip_candidate_address_location_suffixes`; el archivo local usa la misma version para evitar drift.
- Smoke RPC con rollback: guardar `street_name = Avenida Santa Cruz 490, casa 98, La Cruz` persiste dentro de la transaccion `street_name/address_line = Avenida Santa Cruz 490, casa 98` y `current_city = La Cruz`.
- Performance: se actualizo solo `distTotalBytes` de 10,665,252 a 10,665,572 bytes por la sanitizacion frontend del fallback legacy; JS/CSS y assets pesados trackeados permanecen bajo baseline.

## Certificados - correccion etiqueta MAXUS DELIBERY 9

- [x] Confirmar fila MAXUS visible en `competency_equipment_models`.
- [x] Corregir la primera opcion desde `DELIBERY -9 - E DELIBERY -9` a `DELIBERY 9` sin tocar `E DELIBERY 9`.
- [x] Actualizar guardrail de catalogo y validar contra base productiva.
- [x] Commit y push a `main`.

Resultado:
- La opcion `maxus-delibery-9-e-delibery-9` quedo visible como `DELIBERY 9`.
- La opcion separada `maxus-e-delibery-9` se mantiene como `E DELIBERY 9`.
- La migracion remota quedo registrada como `20260723132022_fix_maxus_delibery_9_label`.
- Validacion: `audit:competency-catalog-guards`, `audit:migrations`, `audit:supabase-security`, `guardian` y `git diff --check` pasaron.

## Control de jornadas 4X3 - correccion ciclo Mario Pizarro

- [x] Confirmar trabajador unico Mario Roberto Pizarro Fernandez en BUK/ERP y su asignacion vigente 4X3.
- [x] Corregir el ancla del ciclo desde 2026-07-22 a 2026-07-20 solo para BUK 41804.
- [x] Validar resolucion diaria 2026-07-20 a 2026-07-27 y registrar evidencia.
- [x] Ejecutar gates de migracion/seguridad y commitear/pushear a `main`.

Resultado:
- Mario Roberto Pizarro Fernandez fue identificado como BUK `41804`, RUT `10.864.096-0`, con una unica asignacion `4X3 Ordinaria`.
- La migracion `20260723030646_fix_mario_pizarro_4x3_cycle_start.sql` ajusto `hr_worker_rosters.start_date` desde `2026-07-22` a `2026-07-20`, manteniendo `end_date = 2026-07-27`.
- Validacion de ciclo: `2026-07-20` a `2026-07-23` quedan en turno, `2026-07-24` a `2026-07-26` en descanso y `2026-07-27` vuelve a turno.
- Gates: `npm run audit:migrations`, `npm run audit:supabase-security`, `npm run guardian` y `git diff --check` pasaron.

## Enterprise Repository Cleanup - limpieza final post EEES 100

- [x] Leer objetivo `docs/CODEX_OBJECTIVE_LOOP_ENTERPRISE_REPOSITORY_CLEANUP.md`, Boot Sequence y cierres EEES 100.
- [x] Medir baseline previo de archivos, LOC, dependencias, scripts, rutas, modulos, tests, Edge Functions, RPC/functions, `dist` y Guardian.
- [x] Generar inventario clasificado `eees/audits/REPOSITORY-CLEANUP-INVENTORY.md`.
- [x] Eliminar/consolidar solo candidatos `REMOVE_CONFIRMED` o `CONSOLIDATE` con evidencia suficiente.
- [x] Ejecutar validacion final completa: Guardian full, unit, contracts, coverage, TypeScript, build, smoke frontend, migrations, security, route/role, performance, operational/release readiness, EEES consistency y `git diff --check`.
- [x] Generar `eees/audits/REPOSITORY-CLEANUP-CLOSURE-REPORT.md` y cerrar con 0 residuos confirmados pendientes.

## EEES Enterprise 100% - Cierre operativo final

- [x] Leer objetivo `docs/CODEX_OBJECTIVE_LOOP_EEES_100_PERCENT.md`, Boot Sequence, Books, baselines, auditorias, certificaciones y playbooks EEES vigentes.
- [x] Medir y versionar baseline de production readiness, SRE/SLI/SLO, DR, failure modes y capacity sin inventar thresholds.
- [x] Auditar brechas ejecutables de seguridad, database, contratos, CI/CD, release, observabilidad, idempotencia y documentacion governance.
- [x] Implementar Guardian/scripts que impidan regresiones contra los artefactos finales EEES 100%.
- [x] Ejecutar gates finales: Guardian full, unit, contracts, coverage, migrations, security, route/role, auth matrix, frontend smoke, Edge check, performance, operational/release readiness, TypeScript, build y `git diff --check`.
- [x] Generar `eees/audits/EEES-100-PERCENT-CLOSURE-REPORT.md`, `eees/certification/ENTERPRISE-CERTIFICATION-FINAL.md` y `eees/audits/FINAL-RESIDUAL-RISK-REGISTER.md`.

## EEES P3 - Testing, contratos y consistencia transversal

- [x] Medir baseline actual de tests, cobertura, query keys, contratos frontend/RPC/Edge y regresiones historicas.
- [x] Agregar suite unitaria real para helpers, mappers, normalizadores y transformadores criticos extraidos en P2.
- [x] Agregar contract tests para payloads/retornos/errores criticos frontend ↔ RPC/Edge sin duplicar tipos manuales innecesarios.
- [x] Auditar y migrar query keys inline a factories por dominio, sin alterar comportamiento funcional.
- [x] Ampliar Guardian para query keys, baseline P3, tests faltantes de logica critica, excepciones sin expiracion y artefactos EEES requeridos.
- [x] Crear `eees/baselines/TESTING_BASELINE_v1.md`, `eees/audits/REGRESSION-COVERAGE-MATRIX.md` y `eees/audits/P3-CLOSURE-REPORT.md`.
- [x] Actualizar baselines, CHANGELOG EEES, lessons y todo con evidencia de cierre.
- [x] Ejecutar validacion final P3 completa: unit tests, contract tests, coverage, guardian full, TypeScript, build, smokes/audits afectados y `git diff --check`.

### Resultado P3

- Tests nuevos: 38 assertions automatizadas en 12 archivos `tests/unit` y `tests/contracts`.
- Contratos cubiertos: 6 contract tests para mappers RPC de incentivos y payload operacional.
- Query keys migradas: 28 usos en BI dashboard, operational onboarding, accreditation y roster usan factories centralizadas.
- Regresiones historicas protegidas: 12 entradas trazadas en `eees/audits/REGRESSION-COVERAGE-MATRIX.md`.
- Coverage baseline: lines 49.22%, statements 47.71%, branches 42.30%, functions 42.52%.
- Guardian P3: 0 errores, 0 warnings.

## EEES P4 - Resiliencia operacional, performance, observabilidad y release engineering

- [x] Medir baseline real de performance: build, bundle, chunks criticos, rutas smoke y superficie RPC/Edge critica.
- [x] Auditar observabilidad operacional: logs sanitizados, audit trails, correlation IDs, jobs, Edge Functions y alertas accionables.
- [x] Clasificar riesgos de concurrencia/idempotencia en mutaciones criticas, generacion documental, sync BUK, jobs y batch.
- [x] Implementar guards/audits P4 donde el riesgo sea inequivoco, sin alterar comportamiento funcional.
- [x] Formalizar release engineering: checklist, rollback productivo y migracion fallida.
- [x] Ampliar Guardian para baseline performance, gaps observabilidad, idempotencia verificable y consistencia de release/playbooks.
- [x] Crear `eees/baselines/PERFORMANCE_BASELINE_v1.md` y `eees/audits/P4-CLOSURE-REPORT.md`.
- [x] Actualizar observability baseline/book, CHANGELOG, lessons y todo con evidencia de cierre.
- [x] Ejecutar validacion final P4 completa: Guardian full, unit, contracts, coverage, TypeScript, build, smokes/audits/benchmarks afectados y `git diff --check`.

### Resultado P4

- Performance baseline: `dist` 10,725,235 bytes, JS 3,017,477 bytes, CSS 213,123 bytes.
- Observability gaps cerrados: 3.
- Concurrency/idempotency guards: 4.
- Release/rollback controls: 4.
- Guardian P4: 0 errores, 0 warnings.

## Reasignacion administracion de contratos - Oscar, Angel y Mario

- [x] Confirmar el contrato vivo de administradores y roles antes de cambiar datos productivos.
- [x] Crear la cuenta Auth/Profile de Mario Pizarro Fernandez con rol minimo de administrador aprobador.
- [x] Reasignar a Angel Guerra Basso los contratos administrados por Oscar Poblete Celedon, excluyendo Sierra Gorda.
- [x] Reasignar a Mario Pizarro Fernandez los mappings Sierra Gorda actualmente asociados a Oscar o Angel.
- [x] Validar en Supabase perfiles, roles aplicativos, mappings y ausencia de asignaciones residuales de Oscar.
- [x] Ejecutar guardian/auditorias locales y documentar el cierre.

### Resultado aplicado

- Fuente autoritativa confirmada: `buk_contract_mappings.contract_admin_name`.
- Cuenta Auth creada para `mario.pizarro@busesjm.com`; `profiles` quedo activo como `Mario Pizarro Fernandez`, `Administrador de Contratos`, con `must_reset_password = true`.
- Angel Guerra Basso quedo activo con roles `operaciones_l_1` y `aprobador_folios`.
- Mario Pizarro Fernandez quedo activo con rol `aprobador_folios`.
- Oscar Poblete Celedon se mantiene inactivo y sin roles aplicativos.
- Reasignacion productiva: Oscar quedo con 0 mappings; Angel quedo con 16 mappings no Sierra Gorda; Mario quedo con 2 mappings Sierra Gorda.
- Los mappings Sierra Gorda reasignados a Mario son `ARAMARK SIERRA GORDA INTERNO` y `SIERRA GORDA OPERACIONES`.
- Smoke autenticado de `get_my_effective_permissions()` no pudo ejecutarse desde SQL tool porque la conexion no permite simular `auth.uid()`; se valido contra las tablas autoritativas `profiles`, `user_roles` y `buk_contract_mappings`.
- Validacion local: `git diff --check`, `npm run audit:migrations` y `npm run guardian` pasaron. Guardian cerro con 0 errores y 0 warnings.

## Limpieza documental productiva

- [x] Medir peso actual de documentacion y detectar archivos historicos/duplicados.
- [x] Eliminar documentacion sin enlace productivo ni control vigente.
- [x] Conservar documentos auditados por CI y contratos operativos vivos.
- [x] Validar auditorias/documentacion/build relevante y dejar evidencia de reduccion.
- [x] Auditar binarios Office versionados y bloquear nuevos Word/Excel sin uso operativo.

### Resultado de limpieza documental

- Peso tracked inicial de `docs/` y `tasks/`: 31 archivos, 2.5 MB.
- Se eliminaron planes historicos, propuestas cerradas, plantillas legacy, documentacion duplicada y archivos archivados sin enlace productivo.
- Se retiro la plantilla Word legacy `certificado_tipo_rev02.docx`; el flujo vigente genera PDF desde backend y Edge Function, no desde ese artefacto documental.
- Se conservaron los documentos auditados por `npm run audit:enterprise-docs`: arquitectura, mapa modular, matriz de permisos, revision de seguridad, smoke tests, rollback, `tasks/todo.md` y `tasks/lessons.md`.
- Se conservaron documentos legales/operativos vigentes: politicas ISO, Ley 19.628, deploy, audit logs, database model, brand kit y template Markdown de migracion de reclutamiento.
- Se eliminaron `.DS_Store` locales ignorados por Git.
- Auditoria posterior: no quedan archivos tracked ni locales `.doc`, `.docx`, `.docm`, `.xls`, `.xlsx` o `.xlsm`.
- `.gitignore` bloquea nuevos binarios Word/Excel generados o recibidos fuera del runtime; cualquier excepcion futura debe forzarse y justificarse como operativa.

### Documentos productivos conservados

- `docs/architecture.md`
- `docs/audit-logs.md`
- `docs/brand-kit-plataforma-control.md`
- `docs/database-model.md`
- `docs/deploy-cloudflare-pages.md`
- `docs/deployment.md`
- `docs/design-tokens-plataforma-control.css`
- `docs/iso-27001-control-de-acceso.md`
- `docs/iso-27001-politica-uso-aceptable.md`
- `docs/ley-19628-consentimiento-datos.md`
- `docs/module-map.md`
- `docs/permissions-matrix.md`
- `docs/rollback.md`
- `docs/security-review.md`
- `docs/smoke-tests.md`
- `docs/supabase-auth-authorization-foundation.md`
- `docs/templates/README.md`
- `docs/templates/plantilla_migracion_reclutamiento.md`
- `tasks/lessons.md`
- `tasks/todo.md`

## Acreditacion de personas - estandares por faena y licencia interna

- [x] Modelar estandares reutilizables por mandante/faena para evitar duplicar requisitos comunes en cada division.
- [x] Versionar el estandar inicial `ECF 21` para Codelco Division Ministro Hales con requisitos de ingreso y control de vigencia.
- [x] Separar el alcance operacional entre `acreditacion` para ingreso y `licencia_interna` para manejo dentro de dependencias.
- [x] Mantener trabajadores desde `employees_active_current`, sin sembrar personas manualmente ni crear una fuente paralela.
- [x] Mantener documentos sensibles fuera del ERP local: subir archivo a BUK y conservar solo metadata auditable.
- [x] Aplicar migracion remota y validar RPCs autenticadas contra Supabase.

### Contrato inicial DMH / ECF 21

- Cedula identidad: acreditacion, requiere vencimiento.
- Contrato de trabajo: acreditacion, sin vencimiento.
- Anexo vinculacion: acreditacion, sin vencimiento.
- Examen ocupacional: acreditacion, requiere vencimiento.
- Induccion Hombre Nuevo: acreditacion, requiere vencimiento.
- Anexo de exclusividad: acreditacion, sin vencimiento.
- Autorizacion de uso y almacenamiento de datos Sucal: acreditacion, sin vencimiento.
- Reglamento Interno: acreditacion, sin vencimiento.
- Informacion de Riesgos Laborales IRL: acreditacion, sin vencimiento.

### Resultado versionado

- Se agrego la migracion `20260718031743_add_accreditation_standards_and_ecf21_dmh.sql` con tablas `accreditation_standards`, `accreditation_standard_requirements` y `accreditation_site_standards`.
- `generate_worker_requirements(...)` ahora hereda requisitos desde reglas manuales y estandares asignados a la faena.
- `get_accreditation_setup_catalogs()` expone estandares, reglas de estandar, asignaciones por faena y `process_scope`.
- La pantalla de configuracion permite mantener estandares, vincular requisitos al estandar y asignar estandares a faenas.
- La ficha del trabajador muestra si cada requisito aplica a ingreso, licencia interna o ambos.
- Migraciones aplicadas en Supabase mediante conector auditado:
  - `20260718031743_add_accreditation_standards_and_ecf21_dmh`
  - `20260718032010_complete_accreditation_standard_rpc_contract`
  - `20260718032056_drop_legacy_accreditation_requirement_rpc_overload`
  - `20260718032252_add_process_scope_to_worker_accreditation_profile`
- Validacion remota: historial de migraciones registra las cuatro versiones; seed DMH/ECF 21 quedo con 1 estandar, 1 faena, 9 requisitos, 9 reglas y 1 asignacion faena-estandar.
- Validacion remota: `get_accreditation_setup_catalogs()` respondio con `standards`, `standard_requirement_rules`, `site_standard_rules`, `requirements`, `process_scopes`, `codelco_ecf_21` y `codelco_dmh`.
- Validacion remota: `get_worker_accreditation_profile(...)` en transaccion con rollback devolvio 9 documentos DMH y todos incluyeron `process_scope`.
- Validacion local: `npm run build`, `npm run audit:migrations`, `npm run audit:enterprise-docs`, `npm run audit:route-role-smoke` y `npm run audit:supabase-security` pasaron. El auditor de seguridad se mantuvo en 82 warnings.

## Correccion Acreditacion - DMH como unica faena y busqueda explicita de trabajadores

- [x] Eliminar completamente del dominio de acreditacion las faenas distintas de `Codelco Division Ministro Hales`.
- [x] Redefinir `search_accreditation_workers(...)` para que seleccionar una faena no liste automaticamente trabajadores BUK aun no seleccionados.
- [x] Mantener busqueda explicita por nombre/RUT/cargo como mecanismo para incorporar candidatos desde `employees_active_current`.
- [x] Aplicar migracion remota Supabase y validar catalogo, busqueda vacia DMH y busqueda explicita DMH.
- [x] Validar build/auditorias locales y versionar el cierre.

### Resultado aplicado

- Se agrego la migracion `20260718034748_limit_accreditation_to_dmh_and_explicit_worker_search.sql`.
- Supabase quedo con 1 faena activa: `Codelco Division Ministro Hales`; no quedan faenas distintas de `codelco_dmh`.
- La purga dejo 0 acreditaciones transaccionales y 0 documentos de seguimiento, preservando el estandar ECF 21 con 9 reglas y 1 asignacion DMH-estandar.
- Validacion RPC autenticada: `get_accreditation_setup_catalogs()` expone solo DMH; `search_accreditation_workers(null, DMH, ...)` devuelve 0; busqueda explicita DMH devuelve candidatos BUK.
- Validacion local: `npm run build`, `npm run audit:migrations`, `npm run audit:enterprise-docs`, `npm run audit:route-role-smoke` y `npm run audit:supabase-security` pasaron. El auditor de seguridad se mantuvo en 82 warnings.

## Carga inicial Acreditacion - trabajadores BUK contrato 028 DMH

- [x] Identificar en BUK vivo el alcance exacto de `CONT-028 / CODELCO DMH` sin mezclar otros contratos del CECO DMH.
- [x] Cargar en `Codelco Division Ministro Hales` todos los trabajadores activos del area BUK `SERVICIO CODELCO DMH (6170400006:0004)`.
- [x] Generar los requisitos ECF21 pendientes para cada trabajador cargado.
- [x] Validar conteos remotos de trabajadores, documentos y visibilidad RPC autenticada.
- [x] Validar build/auditorias locales y versionar el cierre.

### Resultado aplicado

- Se agrego la migracion `20260718035405_seed_dmh_accreditation_workers_from_buk_contract_028.sql`.
- Fuente BUK usada: `employees_active_current.area_name = SERVICIO CODELCO DMH (6170400006:0004)`, equivalente operativo a `CONT-028 / CODELCO DMH`.
- No se uso CECO `10114` como filtro porque mezcla otros contratos DMH como Aramark y Sotraser.
- Validacion remota: 91 trabajadores fuente, 91 acreditaciones DMH creadas, 819 documentos generados y 91 trabajadores con los 9 requisitos ECF21.
- Validacion RPC autenticada: `search_accreditation_workers(null, DMH, pending, 200)` devuelve 91 trabajadores pendientes.
- Validacion local: `npm run build`, `npm run audit:migrations`, `npm run audit:enterprise-docs`, `npm run audit:route-role-smoke` y `npm run audit:supabase-security` pasaron. El auditor de seguridad se mantuvo en 82 warnings.

## Cierre Certificados - generacion productiva BUK y header limpio

- [x] Reemplazar el submit temporal por flujo real: subir evaluacion, crear solicitud backend, generar certificado productivo y cargar certificado/evaluacion a BUK.
- [x] Priorizar enlace documental BUK al abrir el resultado, dejando URL firmada local solo como fallback cuando BUK no queda en exito.
- [x] Eliminar lineas/bordes negros superiores y separadores verticales del header en preview y Edge Function productiva.
- [x] Evitar truncado de marcas/tipos/modelos en la tabla de equipos autorizados; el texto se envuelve y pagina sin puntos suspensivos.
- [x] Corregir el validador publico para mostrar trabajador, RUT, vigencia, instructor, equipos, emision, registro BUK y SHA-256 desde el contrato real `snake_case`.
- [x] Implementar formalizacion por correo despues de carga exitosa de certificado en BUK.

### Resultado aplicado

- `CompetencyCertificationPage.tsx` ya no muestra ni usa `PDF temporal ... generado sin guardar ni cargar a BUK`; ahora llama al flujo productivo.
- `competencyApi.ts` y `generate-competency-certificate` comparten el criterio visual del certificado sin artefactos negros.
- `verify-competency-certificate` y la pagina publica `/verificar/competencia` muestran el snapshot publico completo.
- `transactional_email_dispatches` acepta `competency_formalization` y `hiring-transactional-email` renderiza la notificacion.

## UI Certificados - pestaña Resumen de Certificados

- [x] Agregar pestañas en `/certificados` manteniendo `Nueva certificacion` como flujo de emision existente.
- [x] Crear pestaña `Resumen de Certificados` con cuadro de resumen de certificados generados y vigencia.
- [x] Reutilizar `get_competency_dashboard()` para conteos y certificados recientes sin inventar datos en frontend.
- [x] Validar build local y dejar evidencia del resultado.

### Resultado aplicado

- La pantalla `/certificados` ahora muestra tabs `Nueva certificacion` y `Resumen de Certificados`.
- `Resumen de Certificados` consume `get_competency_dashboard()` y muestra total, generados, por vencer en 30 dias, vencidos, pendientes BUK y ultimos certificados visibles por permisos.
- El mapper frontend fue alineado al contrato vivo del RPC (`generated`, `expiring_30`, `instructor_name`, `valid_until`).
- Validacion local: `npm run build`, `npm run audit:route-role-smoke` y `npm run smoke:frontend-routes` pasaron. Playwright confirmo que `/certificados` redirige a `/login` sin sesion y carga sin errores de consola.

## Correccion Certificados - estetica ERP y purga BUK de duplicado

- [x] Reemplazar las pestañas locales de `/certificados` por el patron visual global del ERP.
- [x] Registrar en `tasks/lessons.md` y memoria que toda implementacion UI debe respetar la estetica general del ERP.
- [x] Auditar Swagger BUK y datos vivos del duplicado `1707202611461152` antes de eliminar documentos.
- [ ] Eliminar en BUK el certificado duplicado y su evaluacion si el endpoint vivo lo permite, dejando evidencia sin exponer secretos.
- [x] Validar build/auditorias relevantes, commitear y pushear a `main`.

### Resultado parcial

- Las tabs de `/certificados` ahora usan el patron global `approval-chip-row` / `approval-chip` / `tracking-kpi-card-active`.
- Se agregaron lecciones vivas para estetica ERP y purga documental BUK.
- Swagger BUK vivo (`/api/chile/es/api_docs`) no expone `DELETE` para documentos; solo `POST/GET /employees/{id}/docs`, `GET /employees/{id}/docs/{file_id}` y `GET /docs/{id}`.
- En BUK trabajador `40022`, el duplicado fisico existe como `file_id = 145790` (`certificado_competencia_1707202611461152_114690783.pdf`) y la evaluacion original como `file_id = 145791` (`registro_capacitacion_corporativa_martin_ahumada_114690783.pdf`).
- `GET /employees/40022/docs/{file_id}` responde 302 para ambos IDs, pero `DELETE /employees/40022/docs/{file_id}` y `DELETE /docs/{id}` devuelven 404 HTML; no se elimino ningun documento BUK por API.
- Se corrigio `extractBukDocumentMetadata(...)` para capturar futuros IDs desde `employee_file.id` / `file_id`, que es la forma documentada de respuesta de carga.
- `generate-competency-certificate` fue desplegada nuevamente para que futuras cargas persistan `file_id`.
- Validacion local: `npm run build`, `npm run audit:route-role-smoke` y `git diff --check` pasaron.

## Duplicados de certificados de competencias

- [x] Mantener como vigente el folio reciente `1707202611471153` y reemplazar en ERP el folio antiguo `1707202611461152`.
- [x] Verificar que el validador publico muestre el folio antiguo como `replaced` y no vigente, y el folio reciente como `valid`.
- [x] Crear guarda backend transaccional para que `create_competency_request(...)` no cree certificados equivalentes para el mismo trabajador, instructor, fecha y set de modelos.

### Resultado aplicado

- El folio antiguo quedo `certificate_status = replaced`, `competency_status = revoked`, solicitud `cancelled` y `replaced_by_certificate_id` apuntando al folio reciente.
- El folio reciente se mantiene `uploaded_to_buk`, `enabled` y `completed`.
- La RPC ordena/deduplica modelos, toma `pg_advisory_xact_lock(...)` por llave operacional y rechaza solicitudes equivalentes antes de insertar.

## Retencion documental BUK

- [x] Cargar certificado PDF y evaluacion respaldada a la carpeta BUK `Acreditacion`.
- [x] Aplicar a ambos archivos el estandar de nombre usado por `sync-buk-candidates`: nombre base sanitizado en minusculas + tipo/documento del trabajador + extension.
- [x] Crear puerta de cierre: solo cuando certificado y evaluacion se suben correctamente a BUK se eliminan los objetos `certificates/...` y `evaluations/...` de `competency_documents`.
- [x] Registrar IDs, URLs, nombres BUK, carpeta, hash y estado de purga sin borrar filas transaccionales necesarias para auditoria, folio y validacion publica.

## Correccion Operaciones - timeout al guardar servicios

- [x] Auditar el payload del Registro Base y confirmar que envia identificadores canonicos de conductor/equipo.
- [x] Comparar la funcion remota `submit_service_entries_batch(jsonb)` con las migraciones locales para ubicar la causa real del timeout.
- [x] Implementar una migracion forward-only que reduzca trabajo repetido y mantenga permisos/RLS sin relajarlos.
- [x] Validar con smoke remoto transaccional con `rollback` y verificaciones locales.
- [x] Documentar resultado final y aprendizaje para evitar repetir la falla.

### Resultado aplicado

- `submit_service_entries_batch(jsonb)` ahora materializa `prepare_operations_service_entry_batch(...)` una sola vez y reutiliza esas filas para validacion y upsert.
- Se agrego indice parcial `idx_employees_active_buk_employee_id_recent` para resolver conductores por ID BUK activo sin escaneo innecesario.
- Produccion quedo aplicada y registrada como migracion remota `20260720134318`.
- Smokes remotos con `rollback`: `not_performed` insert/update, `planned` con conductor/equipo y batch de 5 servicios completos retornaron `ok: true`.

## Reparacion Reclutamiento - Carlos Salazar a control documental

- [x] Identificar de forma unica al candidato Carlos Salazar en produccion.
- [x] Revisar estado terminal, historial, documentos y jobs de limpieza documental asociados.
- [x] Aplicar reparacion auditable para moverlo a `document_review` sin relajar permisos ni borrar historial.
- [x] Validar estado final remoto y documentar resultado.

### Resultado aplicado

- Carlos Andres Salazar Espinoza, folio `1978` / `RC-1978`, estaba en `withdrawn` con motivo `Postulante desiste del proceso`.
- Se aplico y registro en Supabase la migracion `20260720200022_repair_carlos_salazar_to_document_review`.
- El candidato quedo en `document_review`, `document_validation_status = pending`, `withdrawal_reason = null`.
- Se conservaron 16 documentos `uploaded` y se elimino el job de limpieza documental pendiente del retiro.
- El historial y audit log registran `withdrawn -> document_review` con `reason_code = terminal_reopen_to_document_review`.

## Correccion Reclutamiento - error Failed to fetch al mover etapa

- [x] Reproducir/aislar el contrato que falla al solicitar Who o mover etapa.

## Correccion Reclutamiento - ficha BUK previa y filtros de folios

- [x] Auditar la regresion de fichas BUK previas/inactivas y ubicar la rama que vuelve a mostrar "no fue posible resolver la ficha automaticamente".
- [x] Reforzar `sync-buk-candidates` para que una ficha BUK inactiva con documento exacto no caiga al error terminal y quede trazada en `result_snapshot`.
- [x] Corregir jobs BUK `processing` obsoletos para que puedan volver a reclamarse y no bloqueen candidatos como Julio Carrasco.
- [x] Agregar un auditor ejecutable que verifique la existencia de las guardas de duplicado activo, ficha inactiva reutilizable/clonable y trazabilidad de resolucion BUK.
- [x] Agregar filtros desplegables a la vista `Resumen de procesos de contratación` por turno, pasajes, alojamiento y contrato, sin ampliar el RPC si el payload ya trae esos campos.
- [x] Validar build/auditorias relevantes y documentar resultado/lecciones para evitar repeticion.

### Resultado aplicado

- Causa raiz: `resolveBukEmployeeForSync(...)` encontraba fichas por documento, pero una ficha historica inactiva podia no entrar a la rama inactiva si el estado venia en campos alternativos o si el correo historico no coincidia con el correo nuevo.
- `sync-buk-candidates` ahora resuelve estado desde `status`, `employee_status`, `estado`, `active` o `is_active`; para fichas inactivas usa documento exacto como identidad primaria y conserva el chequeo estricto de correo para duplicados activos.
- La resolucion BUK deja `resolutionAudit` en exito y `employeeResolutionAudit` en error, evitando mensajes visibles extensos y manteniendo trazabilidad en `buk_sync_jobs.result_snapshot`.
- Julio Cesar Carrasco Zuniga estaba bloqueado por el job `040ddab5-6a75-47e4-b729-25f9eb8ef4bb` en `processing` obsoleto desde `2026-07-20 15:23:38 UTC`; se agrego recuperacion auditable para jobs vencidos en `claim_buk_sync_jobs` y `enqueue_buk_generation`.
- Se agrego `scripts/audit-buk-sync-guards.mjs`, `npm run audit:buk-sync-guards` y ejecucion en GitHub Actions para bloquear regresiones de estas ramas.
- La vista `Resumen de procesos de contratación` agrega filtros desplegables por turno, pasajes, alojamiento y contrato junto a `Buscar casos`, usando `SelectField` compartido y filtrado local sobre campos ya entregados por `get_recruitment_processes_page`.
- Correccion posterior: la primera version instalo filtros en el widget de dashboard equivocado; se corrigio la superficie real de la captura en `HiringProcessesView` y se documento la leccion para validar el heading/input exacto antes de cerrar UI.
- Ajuste visual posterior: se elimino el texto descriptivo bajo el titulo, se compacto la altura de los desplegables y el toolbar usa todo el ancho disponible para dar mas espacio visible al filtro `Contrato`.
- Ajuste visual dashboard: en `Folios en curso`, las KPI quedan en una fila propia bajo el titulo, los filtros y la busqueda quedan en la fila inferior, y los dropdowns abren en flujo para no mezclarse con la tabla.
- Validacion local: `npm run audit:buk-sync-guards`, `./node_modules/.bin/tsc -b --pretty false`, `npm run build:frontend-check`, `npm run audit:route-role-smoke`, `npm run audit:supabase-security`, `npm run audit:enterprise-docs`, `npm run audit:migrations`, `npm run smoke:frontend-routes` y `git diff --check` pasaron.
- Deploy remoto: `sync-buk-candidates` desplegada en Supabase project `pzblmbahnoyntrhistea` con `npx --yes supabase functions deploy sync-buk-candidates --use-api --yes`.

## Saneamiento Reclutamiento - verificacion Deno de sync-buk-candidates

- [x] Resolver la deuda de tipado que impedía usar `deno check` como verificacion limpia de `sync-buk-candidates`.
- [x] Reemplazar `ReturnType<typeof createClient>` por un alias explicito `SupabaseAdminClient` para evitar inferencias `never` en tablas/RPC.
- [x] Tipar fronteras puntuales (`response.data`, fallback de snapshot) sin cambiar logica de negocio.
- [x] Agregar `npm run check:edge:sync-buk-candidates` y ejecutarlo en GitHub Actions con Deno.
- [x] Revalidar build/auditorias, desplegar funcion y commitear/pushear a `main`.

### Resultado aplicado

- `npm run check:edge:sync-buk-candidates` pasa y queda como guardrail CI para la Edge Function BUK.
- La correccion fue solo de tipos/fronteras: alias `SupabaseAdminClient`, tipado de filas BUK remotas y fallback null-safe de snapshot; no cambia la semantica de creacion/reparacion/cancelacion BUK.
- [x] Auditar el manejo frontend de excepciones Supabase/fetch en cambios de etapa de candidatos.
- [x] Validar en Supabase remoto permisos, firma y smoke transaccional de `request_candidate_stage_who`.
- [x] Implementar sanitizacion centralizada para que errores de red/stack trace no lleguen crudos a la UI.
- [x] Validar build/auditorias, documentar aprendizaje, commitear y pushear a `main`.

### Resultado aplicado

- Se confirmo que `advance_recruitment_candidate_stage(uuid,text,text)` y `request_candidate_stage_who(uuid,text,jsonb)` siguen ejecutables para `authenticated`/`service_role` y cerradas para `anon`.
- Smoke remoto con `rollback`: `advance_recruitment_candidate_stage(...)` desde `in_process` a `medical_exams` respondio `stage_code = medical_exams` sin persistir cambios.
- Smoke remoto Who: `request_candidate_stage_who(...)` devolvio rechazo de negocio controlado al invocarse fuera de `lead`, confirmando que la RPC responde y no esta fallando por permisos/firma.
- `getSupabaseErrorMessage(...)` ahora sanitiza stack traces y mapea fallas de red/fetch a un mensaje operacional.
- El submit de cambio de etapa en Control de contrataciones usa `try/catch/finally`, apaga siempre el estado de guardado y evita mostrar errores tecnicos crudos.
- Validacion local: `npm run build`, `npm run audit:route-role-smoke`, `npm run audit:enterprise-docs` y `git diff --check` pasaron.

## Optimizacion global de chunks y busquedas BUK

- [x] Separar dependencias pesadas de PDF/competencias del chunk inicial del modulo.
- [x] Endurecer el lookup estandar para no disparar consultas BUK por busquedas bajo umbral.
- [x] Limitar concurrencia en exportaciones que consultan fichas BUK.
- [x] Ajustar particion de vendors donde la medicion lo justifico.

### Resultado aplicado

- `competencyCoreApi.ts` concentra catalogos, busqueda BUK, advertencias y verificacion publica sin arrastrar `pdf-lib`, `qrcode`, fuentes ni logos.
- `CompetencyCertificationPage.tsx` carga `generateCompetencyPreviewPdf(...)` con import dinamico solo al generar prueba.
- `WorkerLookupField.tsx` usa debounce estandar de 250 ms y no consulta mientras el texto no cumpla umbral.
- `HiringPersonnelToHireView.tsx` limita a 5 consultas concurrentes de ficha BUK y carga `bukEmployeeNomina` dinamicamente solo al exportar.
- `vite.config.ts` separa `pdf-vendor` y `qrcode-vendor`; ECharts se mantiene como chunk lazy unico por ciclos internos de Rollup.

## Correccion Operaciones - super admin sin contratos editables

- [x] Confirmar causa raiz remota del selector vacio en Registro Base de Operaciones.
- [x] Crear migracion forward-only para que `admin/super admin` pueda editar todos los contratos activos sin depender de `operations_contract_editors`.
- [x] Mantener la matriz contractual obligatoria para `operaciones_l_1` y `operaciones_l_2`.

### Resultado aplicado

- `public.user_can_edit_operations_contract(...)` autoriza a usuarios admin sobre cualquier contrato activo.
- `public.operations_editable_contracts` retorna todos los contratos activos para admin/super admin y conserva matriz para usuarios operativos no admin.
- El usuario admin `maximiliano.contreras@busesjm.com` paso a ver 110 contratos editables, igual al total activo remoto.

## Alta cuentas instructor para certificados

- [x] Auditar que el rol `instructor` tiene acceso a `certificados` y `seguimiento_certificados`.
- [x] Provisionar cuentas Auth para los cinco instructores sin exponer contrasenas temporales.
- [x] Sincronizar `profiles`, `user_roles.role_code = 'instructor'` y `competency_instructors.user_id`.
- [x] Validar que una cuenta instructor ve solo su propio instructor en `get_competency_catalogs()`.

## Correccion Certificados - examen/evaluacion obligatoria

- [x] Confirmar que el backend `create_competency_request` bloquea sin evaluacion cargada, notas 100%, hash y archivo en Storage.
- [x] Agregar input obligatorio `Examen teorico / evaluacion respaldada` con tipos PDF/JPG/PNG.
- [x] Bloquear el boton si no existe archivo o no se acepto la declaracion.
- [x] Revalidar en `handleSubmit` para evitar bypass visual del formulario.

## Submodulo Certificacion de Competencias BUK

- [x] Implementar base backend auditable: rol/modulo, tablas, catalogos, RLS, storage privado, auditoria y RPCs.
- [x] Reutilizar `employees_active_current` para seleccion de trabajadores sincronizados desde BUK.
- [x] Reutilizar cliente BUK existente para subir certificado PDF a carpeta documental `Acreditacion`.
- [x] Generar PDF backend desde datos validados, con folio, vencimiento, hash, QR verificable y estado separado de carga BUK.
- [x] Crear UI modular funcional en `/certificados` con busqueda trabajador, seleccion equipo/modelos, carga evaluacion 100%, emision y dashboard.

### Criterio de cierre vivo

- El modulo opera sin Excel ni Power Automate como fuente transaccional.
- No se genera certificado sin evaluacion respaldada, archivo privado y nota final 100%.
- El backend genera folio, token, nombre de documento, vencimiento y estados; el frontend no los inventa.
- La carga BUK debe ser idempotente y no duplicar folio ni documento ante reintentos.
- El certificado queda privado, hasheado, trazable, auditable y validable publicamente por QR.
- Roles `admin`, `certificaciones` e `instructor` tienen acceso segun alcance.

## Loop Enterprise global

- [x] Mantener documentacion viva verificable: arquitectura, mapa modular, matriz de permisos, seguridad, smoke plan y rollback.
- [x] Mantener `npm run audit:enterprise-docs` como control ejecutable de cobertura documental Enterprise.
- [x] Mantener CI alineado para que cambios de rutas, docs, tareas o scripts de auditoria ejecuten el gate documental.

### Contrato vigente

- `audit:enterprise-docs` compara rutas/modulos activos contra `docs/module-map.md` y `docs/permissions-matrix.md`.
- El auditor exige secciones minimas en `docs/security-review.md` y `docs/smoke-tests.md`.
- El auditor exige que este archivo registre la iteracion activa `Loop Enterprise global`.

## Correccion CI - Audit Enterprise Guardrails

- [x] Inspeccionar las corridas fallidas de `Audit Enterprise Guardrails` en `main`.
- [x] Reproducir el fallo de `deno check` en un arbol temporal limpio con `npm ci` y `DENO_DIR` nuevo.
- [x] Corregir el comando Deno del guardrail para que el runner limpio resuelva dependencias npm transitivas del runtime Supabase Functions.
- [x] Validar localmente el guardrail de BUK, el check Deno y los auditores ejecutados por el workflow.

### Resultado aplicado

- Los correos correspondian a fallos reales de CI en los commits `35dd71e`, `ef08f85`, `13dc02e`, `b36c717` y `40650c9`.
- La causa raiz fue `deno check supabase/functions/sync-buk-candidates/index.ts`: en GitHub Actions, el runner limpio no podia resolver el tipo transitivo `npm:openai@^4.52.5` requerido por `jsr:@supabase/functions-js`.
- Se ajusto `check:edge:sync-buk-candidates` a `deno check --no-config --node-modules-dir=auto ...` para que Deno materialice dependencias npm transitivas en CI sin agregarlas como dependencia frontend directa ni inflar el lock global.
- Reproduccion limpia previa sin config: fallo con `Could not find a matching package for 'npm:openai@^4.52.5'`.
- Reproduccion limpia posterior con la config: `deno check --no-config --node-modules-dir=auto supabase/functions/sync-buk-candidates/index.ts` paso.
- Se actualizo el workflow a `actions/checkout@v7.0.1`, `actions/setup-node@v7.0.0` y Node 24 para eliminar la anotacion residual de deprecacion de Node 20.

## Correccion Inicio y Personal a Contratar

- [x] Quitar solo los filtros desplegables del widget de inicio `Folios en curso`, conservando folios, busqueda, ordenamiento, detalle y paginacion.
- [x] Revisar el flujo de generacion BUK en `Personal a Contratar` para que el candidato desaparezca de la lista despues de exito efectivo.
- [x] Implementar refresco/invalidation sin alterar la generacion BUK ni relajar reglas backend.
- [x] Validar build/auditorias relevantes, documentar aprendizaje, commitear y pushear a `main`.

### Resultado aplicado

- El widget de inicio `Folios en curso` conserva su vista natural de folios: tarjetas, busqueda, tabla, detalle expandible, ordenamiento y paginacion.
- Se eliminaron solo los filtros desplegables de turno, pasajes, alojamiento y contrato del resumen de inicio para no duplicar controles operacionales.
- La generacion BUK en `Personal a Contratar` ahora invalida cache aunque no exista una ficha lateral seleccionada y fuerza `refetch()` del listado despues del mensaje de exito.
- Validacion local: `npm run build:frontend-check`, `npm run audit:enterprise-docs`, `npm run audit:buk-sync-guards`, `npm run check:edge:sync-buk-candidates`, `npm run audit:route-role-smoke`, `npm run audit:frontend-auth-smoke-matrix`, `npm run smoke:frontend-routes`, `npm run smoke:frontend-authenticated-matrix`, `npm run audit:migrations`, `npm run audit:supabase-security` y `git diff --check` pasaron. La matriz autenticada quedo saltada localmente por falta de credenciales seguras, como en el contrato del workflow.

## Correccion Inicio - restaurar folios y retirar solo filtros

- [x] Restaurar los folios del widget de inicio que fueron eliminados por una interpretacion excesiva.
- [x] Mantener las restricciones originales del widget: busqueda, query de procesos, detalle expandible, ordenamiento y paginacion.
- [x] Eliminar solamente los desplegables de turno, pasajes, alojamiento y contrato en `Folios en curso`.
- [x] Validar build/auditorias, documentar aprendizaje, commitear y pushear a `main`.

### Resultado aplicado

- Se restauro `ActiveFoliosWidget` con folios, tarjetas, busqueda, ordenamiento, detalle expandible y paginacion.
- Se removieron solo los filtros desplegables y el filtrado local de turno, pasajes, alojamiento y contrato en el inicio.
- Validacion local: `npm run build:frontend-check`, `npm run audit:enterprise-docs`, `npm run audit:route-role-smoke`, `npm run audit:buk-sync-guards`, `npm run check:edge:sync-buk-candidates`, `npm run audit:frontend-auth-smoke-matrix`, `npm run smoke:frontend-routes`, `npm run smoke:frontend-authenticated-matrix`, `npm run audit:migrations`, `npm run audit:supabase-security` y `git diff --check` pasaron.

## Ajuste Inicio - busqueda junto a tarjetas de folios

- [x] Mover la busqueda de `Folios en curso` a la grilla de tarjetas, junto a `Casos cubiertos`.
- [x] Darle a la busqueda el mismo ancho de celda y altura visual que las tarjetas informativas.
- [x] Validar frontend/documentacion, commitear y pushear a `main`.

### Resultado aplicado

- La busqueda ahora es el sexto elemento de la grilla de `Folios en curso`; en el layout de tres columnas queda a la derecha de `Casos cubiertos`.
- La caja de busqueda usa el mismo ancho de celda, padding y radio visual que las tarjetas informativas.
- Validacion local: `npm run build:frontend-check`, `npm run audit:enterprise-docs` y `git diff --check` pasaron.

## Ajuste Inicio - color organico de busqueda en folios

- [x] Igualar el fondo, sombra y borde de la busqueda con la base visual de las tarjetas informativas.
- [x] Quitar el fondo/borde propio del input interno para que no parezca una caja separada.
- [x] Validar frontend/documentacion, commitear y pushear a `main`.

### Resultado aplicado

- La busqueda usa el mismo gradiente, borde y sombra elevada de las tarjetas `SoftMetricCard`.
- El input interno quedo transparente para integrarse a la tarjeta sin una segunda caja visual.
- Validacion local: `npm run build:frontend-check`, `npm run audit:enterprise-docs` y `git diff --check` pasaron.

## Ajuste Control Candidatos - limpiar filtros de folios

- [x] Agregar boton sutil entre `Contrato` y `Buscar casos` para limpiar filtros.
- [x] Limpiar turno, pasajes, alojamiento, contrato, busqueda y estado de folio a `Activos (Todos)`.
- [x] Cancelar resoluciones automaticas de busqueda pendientes para que no reapliquen filtros despues de limpiar.
- [x] Validar frontend/documentacion, commitear y pushear a `main`.

### Resultado aplicado

- Se agrego un boton compacto `×` entre el filtro `Contrato` y `Buscar casos`, con estilo suave y deshabilitado cuando no hay filtros activos.
- El boton limpia desplegables, busqueda y chip de estado, y cancela resoluciones automaticas de busqueda en curso.
- Validacion local: `npm run build:frontend-check`, `npm run audit:enterprise-docs` y `git diff --check` pasaron.

## Ajuste Control Candidatos - modalidad de pasajes visible

- [x] Verificar que la modalidad de pasajes ya viene en el contrato de datos de folios y detalle.
- [x] Mostrar la definicion de Control de contratos en el detalle expandido de folios con pasajes.
- [x] Validar frontend/documentacion, commitear y pushear a `main`.

### Resultado aplicado

- El detalle expandido de folios ahora muestra `Modalidad de pasajes` dentro de `Compensacion y beneficios`.
- La vista reutiliza el label autoritativo `toTravelMethodologyLabel(...)`: `Bono de traslado`, `Compra Empresa` o `Sin definir`.
- Si el folio no lleva pasajes, la modalidad se muestra como `No aplica`.
- Validacion local: `npm run build:frontend-check`, `npm run audit:enterprise-docs` y `git diff --check` pasaron.

## Ajuste Resumen Folios - otros beneficios ancho completo

- [x] Identificar los bloques de `Compensacion y beneficios` que muestran `Otros beneficios`.
- [x] Hacer que `Otros beneficios` use el ancho completo de su seccion para evitar texto amontonado.
- [x] Validar frontend/documentacion, commitear y pushear a `main`.

### Resultado aplicado

- `Otros beneficios` ahora ocupa toda la fila dentro de `Compensacion y beneficios` en Control de candidatos y widgets de resumen relacionados.
- Se reutilizo la clase existente `expanded-detail-field-full`, sin agregar CSS nuevo ni alterar datos.
- Validacion local: `npm run build:frontend-check`, `npm run audit:enterprise-docs` y `git diff --check` pasaron.

## EEES Enterprise Rebuild

- [x] Leer completo `CODEX_MASTER_PROMPT_EEES_ENTERPRISE.md` y fuentes obligatorias principales.
- [x] Auditar estructura real: frontend, Supabase, scripts, CI, docs y tasks.
- [x] Crear `eees/` con foundation, baselines, books, guardian, certification, playbooks, knowledge y codex.
- [x] Implementar `npm run guardian` con reglas machine-readable, metadata, referencias, marcadores de relleno y gates existentes.
- [x] Ejecutar validaciones locales aplicables y auditoria final de consistencia EEES.
- [x] Generar reporte final, artifact zip, commit, push y verificar CI.

### Resultado aplicado

- Se construyo EEES inicial con 41 archivos normativos y auditorias.
- Se agrego `npm run guardian` y `npm run guardian:full`.
- Guardian quedo integrado al workflow `Audit Enterprise Guardrails` para cambios en `eees/**`.
- Validacion local: `npx tsc -b --pretty false`, `npm run build`, `npm run guardian:full`, `npm run audit:buk-sync-guards` y `git diff --check` pasaron.
- Artifact historico `artifacts/EEES_ENTERPRISE_FINAL.zip` removido del repo en cleanup final porque duplicaba fuentes EEES versionadas.
- Cierre operativo: commit, push y verificacion CI ejecutados al finalizar la iteracion.

## Correccion Contratos - empresa CODELCO DRT

- [x] Confirmar en Supabase vivo como esta modelado CODELCO DRT en `contracts`, `buk_contract_mappings`, contrataciones y movilidad interna.
- [x] Identificar si la carga a Buses JM nace de datos del contrato, fallback `resolve_known_company_name(...)`, mapeo BUK o snapshot historico.
- [x] Aplicar correccion forward-only para que CODELCO DRT resuelva empresa Consorcio Nuevo Norte sin relajar permisos/RLS.
- [x] Validar contrataciones y movilidad interna con consultas remotas/smokes en rollback.
- [x] Ejecutar gates EEES aplicables, documentar aprendizaje y dejar el cierre versionado.

### Resultado aplicado

- Causa raiz confirmada en produccion: `buk_contract_mappings.company_name` para `6170400010:0001 / CODELCO DRT` estaba como `Buses JM Pullman S.A.` y `resolve_known_company_name(null, '6170400010:0001')` devolvia el mismo valor.
- Se agrego la migracion `20260722150218_fix_codelco_drt_company_consorcio_nuevo_norte.sql`.
- La migracion corrige `resolve_known_company_name(...)`, `buk_contract_mappings`, movilidades internas historicas DRT y `internal_mobility_request_snapshots`.
- Produccion fue aplicada por `supabase db query --file` y registrada en `supabase_migrations.schema_migrations` como `20260722150218`.
- Validacion remota: `buk_contract_mappings` para `CODELCO DRT` quedo con `company_name = Consorcio nuevo norte SPA`; `resolve_known_company_name(...)` devuelve Consorcio Nuevo Norte para `6170400010:0001` y `6170400010:0004`.
- Validacion remota: movilidad `MI-0050` quedo con `destination_company_name = Consorcio nuevo norte SPA` y `requires_termination = true`.
- Validacion remota autenticada: `get_internal_mobility_setup_catalogs()` devuelve `CONT-029 · CODELCO DRT · Consorcio nuevo norte SPA`.
- Guardrail: `audit:buk-sync-guards` ahora bloquea que CODELCO DRT vuelva a quedar fuera de Consorcio Nuevo Norte.
- Validacion local: `npm run guardian`, `npm run audit:migrations`, `npm run audit:supabase-security`, `npm run audit:buk-sync-guards` y `git diff --check` pasaron.

## Correccion Contratos - empresa BUK general

- [x] Auditar todos los `buk_contract_mappings` operativos contra dotacion BUK viva por codigo/area BUK y empresa `current_job.company_id`.
- [x] Identificar si existen otros contratos donde la empresa local difiere de la empresa dominante informada por BUK.
- [x] Implementar reconciliacion forward-only general para mappings, movilidad interna y snapshots sin hardcodear solo CODELCO DRT.
- [x] Reemplazar la guarda especifica por auditoria ejecutable de drift general ERP vs BUK.
- [x] Ejecutar gates EEES/Supabase, documentar aprendizaje y dejar commit/push en `main`.

### Resultado aplicado

- La auditoria viva detecto 22 mappings operativos 1:1 donde `buk_contract_mappings.company_name` diferia de la empresa dominante de BUK por `current_job.company_id`.
- Se agrego y aplico la migracion `20260722151708_reconcile_buk_contract_mapping_companies.sql`.
- La reconciliacion actualiza solo mappings con empresa BUK ganadora unica; casos sin muestra o con empate quedan fuera para revision humana.
- `resolve_known_company_name(null, contract_number)` ahora prioriza el mapping BUK exacto antes del fallback por sufijo.
- Produccion fue aplicada por `supabase db query --file` y registrada en `supabase_migrations.schema_migrations` como `20260722151708`.
- Validacion remota: la auditoria de drift ERP vs BUK regreso 0 filas corregibles.
- Validacion puntual: CODELCO DRT, CODELCO DMH, CODELCO ANDINA, FLIX VIÑA DEL MAR, RRHH CNN y MANTENCION CALAMA CNN resuelven fallback igual al mapping reconciliado.
- Validacion local: `npm run guardian`, `npm run audit:migrations`, `npm run audit:supabase-security`, `npm run audit:buk-sync-guards`, `npm run audit:enterprise-docs` y `git diff --check` pasaron.

## Certificados - nuevos modelos solicitados por instructores

- [x] Revisar contrato real de `get_competency_catalogs()` y tablas `competency_equipment_*`.
- [x] Aterrizar nomenclatura del requerimiento a ERP: `Bus 1 Piso`, `Bus 1 1/2 Piso`, `Bus 2 Pisos`, `Mini Bus`.
- [x] Agregar marcas/modelos solicitados sin duplicar codigos ni reactivar modelos erroneos.
- [x] Corregir Yutong `ZK6709 H` para que aparezca como bus y no como taxibus en el generador.
- [x] Aplicar migracion, validar catalogo remoto, ejecutar gates y publicar en `main`.

### Resultado aplicado

- Se agrego la migracion `20260722211032_add_instructor_requested_competency_models.sql`.
- Nomenclatura ERP aplicada en catalogo: `Bus 1 Piso`, `Bus 1 1/2 Piso`, `Bus 2 Pisos`, `Mini Bus`.
- Modelos agregados/normalizados: MERCEDES BENZ `O 500 RSD`; SCANIA `F 310 HB`, `K410 C`, `K 440 IB`, `K400 C`, `K 450-C`; VOLVO `B 450 R`; MAXUS `DELIBERY -9 - E DELIBERY -9`; KING LONG `XMQ6130 E`; YUTONG `ZK6709 H`.
- YUTONG `ZK6709 H` fue reclasificado desde `Taxibus` a `Bus 1 Piso` conservando el codigo legacy `yutong-c9-zk6709h`.
- Produccion fue aplicada por `supabase db query --file` y registrada en `supabase_migrations.schema_migrations` como `20260722211032`.
- Guardrail: `audit:competency-catalog-guards` bloquea que desaparezcan los modelos/tipos solicitados o que Yutong vuelva a Taxibus.
- Validacion remota: consulta directa a `competency_equipment_models` confirmo las 12 combinaciones solicitadas con tipo ERP correcto.
- Validacion local: `npm run guardian`, `npm run audit:migrations`, `npm run audit:supabase-security`, `npm run audit:competency-catalog-guards`, `npm run build:frontend-check`, `npm run audit:performance-baseline` y `git diff --check` pasaron.

## Proximos objetivos vivos

## Auditoria y despliegue integral backend/frontend - 2026-08-10

- [x] Revisar todos los worktrees, ramas, commits y estado de `origin/main`.
- [x] Inventariar las migraciones versionadas pendientes y validar su nomenclatura/baseline.
- [x] Obtener sesión de despliegue Supabase, consultar migraciones remotas y aplicar solo las pendientes en orden.
- [x] Ejecutar smoke remoto de las RPC de ficha BUK, incluyendo inicio y guardado transaccional.
- [x] Ejecutar Guardian y gates finales, confirmar árboles limpios y publicar commit/push en `main`.

### Resultado aplicado

- El historial remoto tenía 17 versiones legacy sin archivo local, pero todas las migraciones locales previas estaban aplicadas; no se repararon ni alteraron esas versiones históricas.
- Se aplicaron y registraron en `supabase_migrations.schema_migrations` las migraciones `20260810134000`, `20260810172000`, `20260810173000`, `20260810174000`, `20260810175000` y `20260810180000`.
- Smoke remoto anonimo: inicio de ficha exitoso para el candidato reportado, hash y sesion temporal correctos, envio con `submitted: true` dentro de `BEGIN/ROLLBACK`, y limpieza de la sesion de prueba.
- Auditoria final: `audit:migrations`, `audit:supabase-security` y `guardian` pasan con 0 errores y 0 warnings; el build frontend y los tests incluidos en Guardian tambien pasan.

## Correccion acceso ficha BUK publica DSAL - 2026-08-10

- [x] Reproducir el error de acceso mediante el RPC publico con el RUT y correo reportados.
- [x] Identificar que la funcion se ejecuta, pero falla al resolver `digest(bytea,text)` bajo `search_path = public`.
- [x] Preparar una migracion forward-only que califique `extensions.digest` en las funciones de inicio y envio, conservando los grants anonimos existentes.
- [x] Validar sintaxis de migraciones, seguridad Supabase, Guardian, build y `git diff --check`.
- [ ] Aplicar la migracion en Supabase remoto y repetir el RPC con el RUT/correo de prueba.

### Estado de cierre de esta iteracion

- La reproduccion remota anonima confirma que el grant de la RPC existe y que el fallo actual es `digest(bytea, unknown) does not exist` dentro de la funcion publicada.
- La migracion `20260810134000_fix_public_dsal_buk_digest_resolution` recalifica `digest` como `extensions.digest` en las funciones de inicio y envio, sin abrir tablas ni relajar RLS.
- El despliegue SQL remoto no se pudo ejecutar desde este entorno porque Supabase CLI no tiene proyecto vinculado ni token/sesion disponible; queda pendiente aplicar la migracion antes de validar el acceso real.

## Auditoria y correccion de bloqueo en Business Intelligence - 2026-08-10

- [x] Auditar el montaje de BI, consultas, importaciones pesadas y navegacion entre modulos.
- [x] Reemplazar el diferimiento de una sola tarea por montaje progresivo y cancelable de visualizaciones.
- [x] Diferir la importacion de ECharts del mapa y abortar la descarga al salir de BI.
- [x] Mantener cache operativa del dashboard de Reclutamiento y consultas independientes en paralelo.
- [x] Ejecutar TypeScript, build frontend, 98 tests unitarios/integridad, baseline de performance y Guardian.

### Resultado aplicado

- La causa principal era que `setTimeout(0)` solo postergaba un tick y luego montaba todos los graficos secundarios juntos, bloqueando el hilo principal con RPCs, ECharts y el mapa.
- Dotacion ahora monta sus bloques en cuatro etapas con `requestIdleCallback`/fallback temporizado y limpieza al cambiar de vista.
- Reclutamiento monta sus tres grupos de graficos por etapas; el mapa de Chile carga ECharts de forma diferida y cancela el fetch al desmontarse.
- Validacion final: `npm run build:frontend-check`, `npm run test:unit`, `npm run test:integrity`, `npm run audit:performance-baseline` y `npm run guardian` pasaron con 0 errores y 0 warnings.

## Revision de errores GitHub Actions - 2026-07-22

- [x] Inventariar ejecuciones fallidas recientes de `Audit Enterprise Guardrails` y revisar sus logs completos.
- [x] Clasificar cada causa como activa, corregida o externa, con evidencia del commit afectado.
- [x] Reproducir localmente cualquier fallo vigente y aplicar la correccion minima necesaria.
- [x] Ejecutar Guardian, TypeScript, build y checks afectados.
- [x] Confirmar workflow exitoso en `main`, documentar el resultado y publicar cambios si corresponden.

### Resultado aplicado

- Se revisaron las ultimas 100 ejecuciones del workflow: 8 fallos historicos y 0 fallos activos en la punta auditada de `main`.
- Cinco fallos correspondian al mismo chequeo Deno sin instalacion automatica de dependencias npm; quedaron cerrados por `9fa904b` y el comando vigente `deno check --no-config --node-modules-dir=auto`.
- Un fallo correspondia al timeout inicial del smoke de rutas sin configuracion Supabase portable; quedo cerrado por `76b77a1`.
- Dos fallos correspondian al baseline de bundle medido sin las variables publicas del entorno CI; quedaron cerrados por `07ddfeb`.
- Evidencia remota previa al cierre: run `29949601230` PASS, con `audit-enterprise-guardrails` y Cloudflare Pages exitosos sobre `07ddfeb`.
- Revalidacion local con entorno CI: `npm run guardian:full` PASS con 0 errores/0 warnings, TypeScript PASS, build PASS y `git diff --check` PASS.

## CORE DATA INTEGRITY - certificacion transaccional adversarial

- [x] Completar boot: objetivo, Books, baselines, matrices, hardening, certificaciones y contratos vivos.
- [x] Construir `CORE-TRANSACTION-MAP.md` para todos los flujos criticos.
- [x] Extraer y clasificar invariantes en `DOMAIN-INVARIANT-MATRIX.md`.
- [x] Atacar state machines, atomicidad, concurrencia, idempotencia, integridad referencial y autorizacion.
- [x] Auditar RPC/RLS, BUK/integraciones, documentos/Storage, jobs, reglas temporales y numericas.
- [x] Corregir todos los gaps internos P0/P1 con cambios forward-only y proteccion anti-regresion.
- [x] Extender Guardian solo con controles verificables de integridad de alto valor.
- [x] Repetir el mapa, ataques y auditorias hasta que no queden gaps internos ejecutables.
- [x] Generar findings, closure report y certificacion CORE DATA INTEGRITY.
- [x] Ejecutar Guardian full, suites unit/contract/integrity/concurrency/idempotency, migrations, security, route/role, TypeScript, build, smokes, EEES consistency y `git diff --check`.
- [x] Versionar y publicar el cierre solo si el arbol final y todos los gates quedan consistentes.

### Resultado aplicado

- Se mapearon 15 flujos y 37 invariantes criticas.
- Se cerraron 16 gaps P1 internos en 6 ciclos adversariales; quedan 0 P0/P1 internos.
- Cinco migraciones CORE quedaron aplicadas y alineadas con Supabase remoto.
- Cuatro Edge Functions documentales quedaron desplegadas con checkpoints, retry y autenticacion verificados.
- Dependencia externa residual: BUK no ofrece transaccion distribuida ni clave idempotente para reconciliar un POST aceptado cuya respuesta se corta.

- [x] EEES P2 - Complejidad, reutilizacion y mantenibilidad:
  - [x] Leer reportes P1/P2, Boot Sequence, tasks, lessons y Books aplicables.
  - [x] Medir baseline de archivos criticos, Guardian warnings y accesos directos Supabase.
  - [x] Refactorizar incrementalmente archivos P2.1 de mayor riesgo sin cambiar comportamiento.
  - [x] Reducir duplicacion real en helpers, hooks, services, mappings y query keys cuando exista mas de un consumidor o reduzca riesgo claro.
  - [x] Cerrar accesos directos Supabase fuera de boundaries permitidos o clasificar excepciones tecnicamente justificadas.
  - [x] Actualizar auditoria de complejidad, baselines, lessons y reporte P2.
  - [x] Ejecutar `npm run guardian:full`, TypeScript, build, gates afectados y `git diff --check`.

  Resultado aplicado:
  - Se redujeron 13 archivos criticos sobre 800 lineas a 0 archivos restantes sobre el umbral.
  - Guardian bajo de 14 warnings historicos a 0 warnings sin relajar reglas ni suppressions.
  - Se extrajeron mappers, helpers, hooks, servicios y componentes visuales conservando exports publicos.
  - Validacion final registrada en `eees/audits/P2-CLOSURE-REPORT.md`.
- [ ] EEES P1 - Cerrar smokes autenticados por rol y auditar deuda legacy de onboarding:
  - [x] Leer `eees/audits/FINAL-IMPLEMENTATION-REPORT.md`, `tasks/todo.md`, Boot Sequence y Books aplicables.
  - [x] Inspeccionar manifiesto, scripts, workflow y documentacion de smokes autenticados.
  - [x] Consolidar la matriz P1 de smokes autenticados por roles controlados sin versionar credenciales reales.
  - [x] Auditar onboarding legacy y cerrar la parte tecnicamente ejecutable sin reactivar deuda historica.
  - [x] Ejecutar `npm run guardian:full` y gates afectados.
  - [x] Actualizar `tasks/todo.md`, `tasks/lessons.md`, auditorias EEES y generar reporte de cierre P1.

  Resultado aplicado:
  - `tests/smoke/frontend-authenticated.scenarios.json` ahora cubre 16 escenarios y roles P1 principales.
  - `npm run audit:frontend-auth-smoke-matrix` exige cobertura P1 por rol, docs, workflow y ausencia de credenciales reales.
  - `npm run audit:onboarding-legacy-guards` valida la frontera viva de alta operacional y las migraciones correctivas legacy.
  - `npm run guardian:full` paso con 0 errores y 14 warnings historicos fuera de alcance P1.
  - Reporte generado: `eees/audits/P1-CLOSURE-REPORT.md`.
- [ ] Convertir la purga documental en rutina periodica: revisar archivos grandes versionados y referencias huerfanas antes de cada cierre mayor.
- [ ] Mantener smokes autenticados por rol cuando existan credenciales controladas en secrets.
- [ ] Evaluar activos no documentales pesados solo si el usuario autoriza optimizacion fuera de `docs/` y `tasks/`.

## Carga BUK en contingencia - Ricardo Cortez - 2026-08-10
- [x] Auditar candidato, ficha contractual, documentos cargados y ruta operativa BUK DSAL.
- [x] Diseñar una autorización backend explícita para contingencia, con motivo obligatorio y trazabilidad, sin marcar documentos como aprobados.
- [x] Implementar el flujo backend/worker para encolar y ejecutar la carga contingente, manteniendo capacidad, mapping, rol y datos críticos.
- [x] Ejecutar smoke transaccional y procesar a Ricardo: BUK confirmó ficha 42629, ruta DSAL y 9 documentos.
- [x] Ejecutar Guardian, documentar resultado, commit y push a main.

### Resultado aplicado

- Ricardo Manuel Cortés Valdés (`17.295.826-5`) quedó en BUK como empleado `42629` con área `CODELCO - DSAL`, area_id `2911`, company_id `5`, cost center `718`, role `CONDUCTOR DE MINIBUS 4X4`, plan y job BUK confirmados.
- Se transfirieron 9 documentos del ERP a BUK con respuestas `201`; la documentación ERP sigue `pending` y no fue marcada como aprobada.
- La Solicitud de Contratación quedó explícitamente omitida para regularización posterior; el job contingente conserva motivo, usuario, fecha y respuestas del proveedor.
- La reconciliación automática fue ajustada para no transformar una carga contingente en contratación ERP; Ricardo permanece en etapa `lead`.
- Guardian final: PASS, 0 errores y 0 warnings; migraciones, seguridad, integridad, concurrencia, idempotencia, build y diff check aprobados.

## Correccion supervisor y fecha Ricardo Cortez - 2026-08-10
- [x] Confirmar supervisor contractual DSAL en `buk_contract_mappings` y ficha BUK.
- [x] Actualizar BUK: supervisor Marcelo Villarroel (`35304`) y fecha de ingreso `2026-08-10`.
- [x] Actualizar la ficha contractual ERP con fecha `2026-08-10`, conservando auditoria del cambio `2026-08-09 -> 2026-08-10`.
- [x] Ajustar el worker para priorizar el administrador del contrato como supervisor BUK y evitar que futuros reprocesos usen al solicitante del folio.
- [x] Verificar BUK, desplegar Edge Function y ejecutar Guardian.
