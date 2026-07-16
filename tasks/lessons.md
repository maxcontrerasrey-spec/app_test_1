# Lecciones Técnicas Aprendidas (Lessons)

Este archivo consolida las decisiones de arquitectura, los patrones de diseño y las trampas comunes descubiertas durante el desarrollo de la plataforma, sirviendo como guía de conocimiento.

---

## 251. Los certificados operacionales deben emitirse desde backend aunque el flujo nazca en una pantalla modular

- **El frontend no debe inventar folio, vigencia, hash ni nombre documental.** Para competencias de conductores, React solo reúne trabajador, instructor, modelos y evaluación; la RPC/Edge Function crea folio, token, PDF, vencimiento, hash y estado BUK.
- **Un instructor sin usuario vinculado no puede ser usado por cualquier cuenta instructora.** Los catálogos heredados pueden existir como seed operativo, pero si `user_id` está nulo solo admin/certificaciones debe poder emitir en su nombre hasta completar la vinculación.
- **La ejecución directa de SQL remoto exige registrar `schema_migrations`.** Si se usa `supabase db query --file` por drift de historial, hay que insertar la versión en `supabase_migrations.schema_migrations` para mantener producción auditable y evitar reaplicaciones futuras.
- **No pruebes integraciones documentales creando certificados ficticios si eso contamina BUK.** La validación segura es probar catálogos/RPC/grants, despliegue, rechazo sin bearer y dejar la emisión real para un caso operativo controlado.

## 250. Un warning histórico solo se descuenta si una migración posterior lo reemplaza de forma verificable

- **No edites migraciones viejas aplicadas para hacer bajar el contador.** Para Operaciones, BI y ORION, el cierre seguro fue una migración forward-only que recompila helpers/policies vivos y deja `notify pgrst`.
- **El auditor debe descontar casos exactos, no patrones amplios.** Si un warning histórico queda supersedido, el script debe exigir archivo, mensaje y evidencia concreta en la migración de cierre; cualquier warning nuevo debe seguir apareciendo.
- **Renombrar parámetros de funciones en Postgres exige drop/recreate controlado.** `CREATE OR REPLACE FUNCTION` no permite cambiar nombres de argumentos; hay que bajar y recrear dependencias conocidas dentro de una transacción, sin usar `CASCADE` a ciegas.
- **Las policies de Storage deben declarar alcance de ruta cuando el bucket comparte namespace.** ORION mantiene compatibilidad con archivos raíz existentes, pero las nuevas cargas van a `knowledge/` para que la policy no dependa solo de `bucket_id`.

## 249. Visibilidad de contrato y edición operativa deben ser matrices separadas

- **Una vista amplia sirve para resumen/exportación, pero no para autorizar carga.** En Operaciones, `user_contracts` puede exponer contratos visibles por acceso al módulo; la carga de servicios necesita una matriz editable por cuenta y contrato.
- **El filtro de edición debe existir en frontend y backend.** La UI debe mostrar solo contratos editables en Registro Base, pero `submit_service_entries_batch(...)` también debe rechazar cualquier contrato no autorizado para bloquear clientes alternativos.
- **Los L1/L2 no son equivalentes a editar todos los contratos.** El rol habilita capacidad operativa general; la fila activa en `operations_contract_editors` decide el alcance contractual concreto.

## 248. Un flujo operativo no puede depender de que todas las fallas vuelvan como `{ ok: false }`

- **Si un botón queda en `Enviando...`, revisa primero los caminos sin `finally`.** En Operaciones, la RPC podía responder correctamente, pero una excepción fuera del retorno controlado dejaba `submitState.loading=true` sin recuperación visual.
- **El identificador canónico debe viajar junto al dato humano mostrado.** Para conductores BUK, enviar solo nombre/documento obliga al backend a resolver por heurística; si la UI ya seleccionó un trabajador, también debe enviar `driverBukEmployeeId` para cerrar la identidad exacta.
- **Las vistas dependientes de `auth.uid()` no se auditan con service role como si fueran tablas.** `user_contracts` puede devolver 0 con una consulta administrativa sin JWT y aun así funcionar para el usuario real; simula `request.jwt.claim.sub` o prueba con sesión antes de concluir que falta asignación.

## 247. Las cuentas compartidas necesitan identidad operativa auditada, no solo un usuario Auth común

- **Si dos personas operan con el mismo correo, el login no identifica al operador real.** Para turno/contraturno, la cuenta Auth compartida debe abrir una instancia de selección obligatoria antes de entrar a la app.
- **La selección debe validarse y auditarse en backend.** El frontend puede bloquear la navegación, pero la verdad durable es una RPC que confirme que el operador pertenece al correo autenticado y escriba usuario Auth, operador, sesión, user agent y fecha/hora.
- **No crees usuarios Auth manualmente desde SQL para cerrar una pantalla.** Primero versiona las opciones y la auditoría; el alta de la cuenta debe seguir el flujo normal de provisión/password para no inventar credenciales ni romper triggers de `profiles`.
- **No confundas cargo visible con rol de acceso.** Para supervisores de Operaciones DMH, el cargo funcional es `Supervisor de Operaciones`, pero la matriz de permisos usa `operaciones_l_2` para habilitar su operación.
- **Los resúmenes operativos expandibles deben usar la misma fuente que calcula los KPIs.** Si la cobertura sale de `service_entries` y base habilitada, el detalle por contrato debe derivarse de esos registros, no de un dataset paralelo que pueda quedar inconsistente.
- **No dupliques KPIs en tarjetas grandes si ya existen en el panel compacto.** En Resumen de Operaciones, repetir planificados/base/turno en una segunda fila de tarjetas agrega altura sin nueva información.

---

## 246. Las grillas de filtros no pueden depender de que tres controles quepan en una sola fila hasta el breakpoint móvil

- **La escala de Windows/Chrome puede revelar choques que no aparecen en el viewport ideal del desarrollador.** En Jornadas, `Trabajador`, `Mes` y `Contrato / Área` compartían una fila hasta 1180 px; con escala de pantalla, el label de contrato invadía el control de mes.
- **Los filtros secundarios deben saltar de línea antes de que el layout se comprima.** Para toolbars operativas, usa columnas con mínimos reales y breakpoints intermedios donde los campos largos ocupen fila completa.
- **La validación visual mínima debe medir intersecciones, no solo compilar.** Un smoke con los mismos selectores/clases en anchos 1366, 1100, 1024, 900 y móvil detecta si labels y controles se pisan antes de cerrar.

---

## 245. En BI, los colores deben mapear significado operativo y no orden de serie

- **La paleta global de ECharts sirve como fallback, no como contrato analítico.** Si `Solicitados`, `Cubiertos`, `Folios abiertos`, `Contratados` o `Movilidad` dependen del orden de `series`, dos métricas cercanas pueden terminar con azules indistinguibles o cambiar semántica al variar el payload.
- **Cada gráfico ejecutivo debe fijar color por concepto y sostenerlo en light/dark/e-ink.** Requerimiento puede funcionar como base neutra, cobertura/contratados como avance verde, movilidad como violeta, pendientes/meta como ámbar y rechazo como rojo; el modo oscuro debe usar equivalentes legibles, no solo la misma paleta aclarada.
- **Los donuts de estado necesitan colores por etiqueta y porcentaje visible cuando la pregunta es composición.** Mostrar cantidad en `Estado de Casos` compite con KPIs superiores; el donut debe comunicar proporción y conservar el conteo solo si se requiere en detalle contextual.

---

## 244. Recompilar una RPC compartida exige cerrar grants y recargar PostgREST como parte del contrato

- **Un `CREATE OR REPLACE FUNCTION` exitoso no prueba que la RPC esté operativa desde PostgREST.** Si la función es `SECURITY DEFINER` y se endurecen grants, el cierre debe verificar `has_function_privilege(...)` para `public`, `anon`, `authenticated` y `service_role`.
- **El hotfix seguro para `permission denied for function ...` no es abrir `PUBLIC`.** Reaplica grants mínimos a `authenticated`/`service_role`, conserva `public`/`anon` revocados y ejecuta `notify pgrst, 'reload schema'` para eliminar caché de esquema obsoleta.
- **Las RPCs compartidas entre tabs deben validarse con el caso real que falla.** En Control de candidatos, `get_recruitment_case_detail(...)` y `get_candidate_checklist(...)` se deben probar juntas contra el candidato/caso afectado, porque el usuario ve ambos errores en el mismo panel.

---

## 243. Los snapshots BUK no deben ser diarios ni conservar JSON crudo si el ERP no usa BI como fuente principal

- **La dotación operativa vigente vive en `public.employees`.** El ERP necesita esa tabla para operación actual, búsqueda, contratos, incentivos y contexto BUK; no necesita duplicar el mismo payload completo en una foto diaria.
- **Si se conserva historia BUK, debe ser mensual y de período cerrado.** La regla actual es una foto normalizada por mes cerrado, sin meses parciales ni granularidad diaria.
- **No guardes `raw_payload` histórico salvo que exista un consumidor operativo probado.** El JSON crudo de BUK creció de forma desproporcionada; si un proceso necesita campos históricos, primero se deben extraer columnas normalizadas específicas.
- **La sincronización diaria BUK no debe escribir snapshots históricos.** El job diario actualiza `employees`; la captura mensual queda separada y programada después del cierre del mes.

---

## 242. Los catálogos BUK usados para crear solicitudes no pueden derivarse de dotación activa

- **Un cargo vigente en BUK puede no tener trabajadores activos todavía.** Si el ERP alimenta `job_positions` desde empleados o muestras operativas, cargos nuevos como `OPERADOR LOGISTICO INTEGRAL` quedan invisibles aunque existan en BUK.
- **La fuente correcta para el selector de cargo solicitado es `/api/v1/roles`.** El formulario puede seguir leyendo `job_positions`, pero esa tabla debe sincronizarse desde el catálogo de roles/cargos BUK y no desde `employees.current_job`.
- **La validación backend debe conservar el catálogo local como frontera transaccional.** Antes de crear la solicitud, refresca el catálogo en modo tolerante y luego deja que `submit_hiring_request(...)` valide `job_positions.is_active`; no envíes nombres libres que rompan aprobaciones, folios o snapshots.

---

## 241. Una corrección de nombre de usuario debe actualizar Auth metadata y `profiles`

- **`profiles.full_name` no es la única fuente visible de identidad.** Si el alta de usuario se creó con `auth.admin.createUser(...)`, el nombre también queda en `auth.users.raw_user_meta_data` como `full_name`/`name`; corregir solo `profiles` puede dejar drift si el trigger de sincronización vuelve a ejecutarse.
- **La corrección segura es idempotente y acotada al usuario.** Para cambios de display name, resuelve primero el usuario Auth por email, actualiza `user_metadata` y luego confirma `public.profiles.full_name`, sin tocar `user_roles` ni matrices globales de permisos.

---

## 240. En Postgres/Supabase, crear `SECURITY DEFINER` sin revocar `PUBLIC` abre una superficie RPC aunque la función tenga checks internos

- **El grant default de funciones es parte de la superficie de ataque.** Una función `SECURITY DEFINER` en `public` puede quedar ejecutable por `PUBLIC`, lo que implica también `anon`, aunque el desarrollador solo haya pensado en usuarios autenticados.
- **La corrección segura no es relajar RLS ni borrar funciones históricas.** Revoca `PUBLIC/anon` sobre funciones privilegiadas, conserva grants explícitos para `authenticated/service_role` donde el contrato vivo lo requiere, y deja funciones trigger sin grants interactivos.
- **El smoke importante es sobre el catálogo vivo, no solo sobre archivos SQL.** Después del hardening, verifica `has_function_privilege('anon', oid, 'EXECUTE') = false` para `SECURITY DEFINER` y que no existan tablas públicas expuestas sin RLS.
- **Errores de integraciones y logs de Edge Functions deben ser sanitizados en la frontera.** No devuelvas cuerpos crudos de proveedores ni mensajes internos al cliente; conserva el detalle solo donde exista auditoría backend controlada.

---

## 239. Una ficha BUK activa sin `current_job` creada por el ERP no es un duplicado finalizado

- **Si el ERP creó o clonó una ficha BUK y el job falló después, un reintento no debe cancelar el candidato por “duplicado activo”.** La señal crítica es `code_sheet` compatible con el ERP, documento/correo coincidente y `current_job` vacío; eso debe ir a reparación idempotente.
- **Un éxito BUK efectivo debe reconciliar el pipeline aunque el flujo posterior falle.** `buk_sync_jobs` ahora tiene un trigger que, ante éxito efectivo, marca el candidato `hired`, recalcula el caso y deja historial/audit log; las cancelaciones por duplicado activo siguen excluidas por `is_effective_buk_generation_success(...)`.
- **Los `area_ids` de cargos BUK pueden contener IDs históricos que devuelven 404.** La resolución debe ignorar solo áreas 404 y continuar hasta encontrar el área vigente que calza con `cost_center`, nombre de área/padre/departamento y contrato.
- **El caché local de empleados no debe ganarle al catálogo BUK cuando existe un área remota compatible.** Si BUK confirma `area_id`, las muestras locales solo pueden aportar jornada/líder/cargo cuando pertenecen a esa misma área; así se evita cargar jobs en contratos o centros incorrectos.

---

## 236. Cuando un KPI total incluye una parte cubierta, ofrece el faltante en la misma tarjeta

- **Si `Total` y `Cubierto` conviven como tarjetas separadas, la brecha debe quedar calculable sin explicación externa.** En BI Reclutamiento, `Cupos Solicitados = 119` incluye `Cupos Cubiertos = 25`; mostrar `Faltante = 94` dentro de la misma tarjeta reduce ambigüedad.
- **La mejor lectura no siempre es otra tarjeta.** Un selector interno mantiene jerarquía visual y evita aumentar la fila de KPIs.
- **El cálculo debe derivar de los totales autoritativos ya filtrados.** `Faltante = max(requestedVacancies - filledVacancies, 0)` conserva compatibilidad con filtros y evita inconsistencias por fuente secundaria.

---

## 238. Un duplicado BUK inactivo debe resolverse por documento, no por email laboral historico exacto

- **El RUT/documento exacto es la identidad primaria para fichas historicas inactivas.** Si BUK responde que el trabajador ya existe inactivo, exigir que el email laboral antiguo sea igual al email actual puede bloquear una clonacion valida aunque el documento sea inequivoco.
- **La relajacion debe aplicar solo a la rama inactiva.** Los duplicados activos siguen requiriendo el match estricto existente; para fichas inactivas basta con documento exacto y compatibilidad de al menos un correo conocido cuando ambos lados informan correos.
- **Los mappings BUK no deben depender de nombres si el worker consume codigos.** Si `buk_contract_mappings.cost_unit` contiene el codigo operativo maestro pero `buk_area_code` queda nulo, `sync-buk-candidates` no puede resolver contexto de job aunque el contrato exista visualmente.
- **Un centro de costo no prueba por si solo el area operacional si el area no tiene empleados.** `SERCOING - DRT` no tenia dotacion en cache; usar `106` por matriz historica cargo a Puerto Terrestre. La resolucion correcta debe consultar BUK y confirmar `area_id`, sub-area, padre y `cost_center` antes de crear o reparar jobs.

---

## 237. Un filtro BI visible debe existir en el contrato backend de todas las series que promete controlar

- **Agregar un selector solo en React genera una falsa sensación de control si el RPC no recibe esa dimensión.** En BI Reclutamiento, `Cargo` debía viajar como `p_job_position_names` al dashboard y al timeline diario.
- **Las opciones del filtro deben salir del mismo universo autorizado que alimenta las métricas.** `filterOptions.jobs` se deriva de folios activos visibles y respeta gerencia/contrato seleccionados.
- **Si un gráfico comparte filtros globales, todas sus consultas hermanas deben aceptar la misma firma opcional.** El dashboard y `get_bi_recruitment_daily_timeline(...)` quedan alineados para evitar KPIs filtrados con pulso no filtrado.
- **Los dropdowns compartidos no deben quedar con estilos inline antiguos si el sistema ya tiene lenguaje visual de navegación.** Mover `MultiSelectField` a clases compactas permite igualar densidad, sombras y tipografía sin repetir CSS por módulo.

---

## 235. Una pestaña diaria no puede ser real si el backend solo entrega buckets semanales

- **La granularidad visual debe existir en la fuente.** Si el RPC entrega `01/07`, `08/07`, `15/07`, la UI no puede prometer vista diaria sin inventar días; se debe exponer un timeline diario backend y agrupar hacia arriba en frontend.
- **Los totales de requerimiento son inclusivos por definición.** `Cupos Solicitados` representa el universo requerido; `Cupos Cubiertos` es una parte de ese total, no un número adicional.
- **Los cambios de color en KPIs compartidos deben ser scoped al módulo.** Si el ERP reutiliza `tracking-kpi-card-*`, las variantes de BI deben vivir bajo `.bi-recruitment-kpi-row` para no alterar otros tableros.

---

## 234. Configurar una opción ECharts no basta si el runtime tree-shaken no registra el componente

- **Cuando un control nativo no aparece, revisa primero `echarts.use(...)`.** `dataZoom` puede estar correctamente configurado en la opción y aun así no renderizar si `DataZoomComponent` no está incluido en el runtime compartido.
- **Las líneas de meta no deben distorsionar la lectura de las series operativas.** Si el valor objetivo está en otra escala, usa un eje secundario oculto o una marca de referencia para que el eje visible siga representando el comportamiento real.
- **Un slider de análisis debe tener contraste intencional.** En dashboards claros, un `dataZoom` demasiado bajo o translúcido puede existir pero parecer invisible; dale altura, track y handles distinguibles.

---

## 233. En BI, una mejora visual de legibilidad debe aprovechar el motor del gráfico antes que forzar overflow externo

- **Si el problema es que muchas categorías comprimen el eje, usa el mecanismo nativo del chart.** En `Cupos por Contrato`, `dataZoom` mantiene ejes, tooltip y resize consistentes; un `overflow-x` sobre el contenedor rompe con más facilidad la experiencia de exploración.
- **Una línea de referencia puede salir del summary autoritativo si representa el total filtrado.** Para `Cupos requeridos`, el total ya calculado por el RPC BI es suficiente como umbral operativo global sin abrir una migración adicional.
- **Los toggles de vista deben vivir en la cabecera del gráfico y no competir con la leyenda.** La cabecera controla la forma de leer el tiempo; la leyenda queda reservada para series de datos reales.

---

## 232. Los correos de aprobación deben seguir la cadena operativa vigente, no una capability heredada más amplia

- **Una capability útil para UI/RPC puede quedar demasiado amplia para una notificación si negocio cambia la cadena de aprobación.** En WHO, `gerente_general` seguía entrando porque el correo agregaba destinatarios desde `can_approve_who_stage`.
- **Si la cadena real es acotada, el backend debe expresar esa lista explícitamente.** Para WHO, los destinatarios de correo deben salir de superadmin/admin y `director_op`, no de una consulta anidada sobre todos los roles con capability histórica.
- **Revocar el permiso y filtrar el correo son dos cierres distintos.** Sacar `role_capabilities` impide decidir; redefinir el enqueue evita que recordatorios y tareas futuras sigan notificando al rol retirado.

---

## 231. Un dashboard BI no debe duplicar un mismo estado en tarjeta y gráfico si el gráfico ya entrega el desglose operativo

- **La densidad mejora cuando cada elemento responde una pregunta distinta.** Si el donut de movilidad interna ya muestra ejecutadas, pendientes y rechazadas con etiquetas de datos, una fila adicional de tarjetas para los mismos buckets agrega ruido y compite por atención.
- **Los gráficos de proceso deben respetar el orden operacional, no el ranking por tamaño.** En etapas de candidatos, ordenar por volumen oculta el flujo real del pipeline; el orden correcto debe venir de una lista canónica del dominio.
- **Cuando dos barras representan parte y total, la geometría debe comunicar relación.** Para `Solicitados` vs `Cubiertos`, barras superpuestas con la misma forma son más legibles que stacks que dejan bordes y uniones visualmente inconsistentes.

---

## 230. Un KPI combinado puede mantenerse en una sola tarjeta si el selector usa desglose backend autoritativo

- **Separar visualmente no siempre exige crear más tarjetas.** Cuando negocio quiere conservar una lectura ejecutiva como `Cupos Cubiertos`, un selector interno `Todos / Contratados / Movilidad` mantiene el layout compacto y evita duplicar jerarquía.
- **El desglose debe venir del mismo universo que construye el total.** Si `filled_vacancies` suma `hired_count + approved_mobility_count`, el RPC debe exponer también esas dos partes; derivarlas solo desde tarjetas de movilidad puede mezclar períodos o solicitudes no asociadas a folios activos.
- **Cuando una migración aditiva todavía no está aplicada, el frontend puede tener fallback, pero debe quedar documentado como compatibilidad transitoria.** El contrato durable es el campo explícito del RPC, no una resta indefinida en React.

---

## 229. En BI, una tarjeta total debe reconciliar visualmente todos sus buckets operativos visibles

- **Mostrar un total sin todas sus categorías operativas genera una falsa inconsistencia aunque el backend esté correcto.** En BI Reclutamiento, `Movilidades Internas = 31` no cuadraba con `16 + 7 + 1` porque faltaba representar `Rechazadas = 7`.
- **Si una categoría total incluye estados terminales, la UI debe decidir entre mostrar el bucket residual o cambiar el total.** Para analítica ejecutiva, mantener el total y agregar `Rechazadas / No ejecutadas` conserva trazabilidad y evita ocultar solicitudes que sí existieron.
- **No dupliques tarjetas cuando el RPC expone dos nombres para el mismo conteo.** Si `open_folios` y `open_cases` salen del mismo `count(*)`, la pantalla debe escoger un solo rótulo operacional y liberar espacio para métricas que expliquen el negocio.

---

## 228. Un summary filtrado debe distinguir contadores efectivos de cupos y contadores puros de personas

- **Si `candidate_count` incluye movilidad interna pendiente para reservar cupos, no puede alimentar directamente una tarjeta rotulada como “Candidatos en curso”.** En `Folios en curso`, eso produjo 60 contra 59 en `Control de Contrataciones` porque el RPC sumaba `effective_active_candidates` y el control mostraba candidatos activos netos.
- **La regla correcta es corregir la fuente filtrada, no solo el componente que pinta la tarjeta.** `get_recruitment_processes_page(...)` debe exponer `inProgressCandidates` como `candidate_count - mobility_active_count` cuando el KPI promete candidatos activos; la movilidad se mantiene en el detalle y en los cálculos de cupos.
- **Todo KPI duplicado entre Inicio y un módulo operativo debe tener una prueba de reconciliación.** La validación mínima es comparar casos activos, candidatos activos, movilidad pendiente y candidatos efectivos antes y después del cambio, con un usuario real o simulado por `auth.uid()`.

---

## 227. Los textos auxiliares de widgets operativos deben ser opcionales sin romper accesibilidad ni dejar aire muerto

- **Eliminar copy visible no debe eliminar el nombre accesible del input.** Si una pantalla pide quitar labels como “Buscar aprobación en curso”, el campo debe conservar un label visualmente oculto en vez de depender solo del placeholder.
- **Compactar el módulo exige revisar el layout residual.** Al quitar subtítulos o labels, también hay que ajustar `gap` y márgenes del header/toolbar; de lo contrario el texto desaparece pero queda el mismo alto visual.

---

## 226. Una contratación BUK emitida sobre el folio equivocado debe repararse como trazabilidad cruzada ERP-BUK, no solo moviendo una fila

- **Mover el candidato entre folios sin corregir BUK deja la operación incoherente.** En Domingo Enrique Catalán Vega, el ERP podía trasladar `recruitment_case_candidates` desde `RC-1749` a `RC-0082`, pero BUK conservaba job, activación y término contractual del folio equivocado; la reparación tuvo que patchar también empleado/job BUK.
- **La reparación segura debe tener guards exactos y recálculo canónico de cupos.** Usa IDs, RUT, folios, estado del candidato y job BUK esperado antes de actualizar; después llama `sync_recruitment_case_status(...)` para que `filled_vacancies` y `status` vuelvan a la verdad calculada.
- **Si la UI busca folios por estado, la búsqueda debe resolver la categoría real del resultado.** Un folio cubierto o cerrado puede quedar oculto por el chip actual; el frontend debe cambiar al filtro donde el caso existe en vez de obligar al usuario a adivinar la pestaña.

---

## 225. En BUK jobs, un campo salarial soportado en lectura no necesariamente es aceptado en `POST /jobs`

- **Que `current_job.base_wage` exista en snapshots BUK no prueba que el endpoint de creación acepte `base_wage`.** Al desplegar el worker actual, `POST /api/v1/chile/employees/{id}/jobs` empezó a enviar `base_wage: 0` además de `wage: 0` y BUK respondió `500 Internal Server Error` no JSON para una ficha que antes llegaba hasta creación de job.
- **La regla operativa validada vuelve a ser enviar solo `wage = 0` en el payload de job mientras no exista prueba viva del contrato `base_wage`.** La regla de negocio de no cargar renta desde ERP se mantiene; lo que se revierte es el campo que rompe el integrador.
- **No despliegues cambios dormidos de payload junto con hotfixes de observabilidad.** Si una función acumuló cambios no desplegados, antes del deploy hay que comparar el contrato efectivo remoto contra `HEAD` y separar saneamiento/logging de mutaciones de negocio hacia BUK.

## 224. Una integración externa nunca debe persistir ni renderizar cuerpos HTML crudos como error operativo

- **Un 500 de proveedor puede devolver una página completa, no un JSON de API.** En generación de fichas BUK, la respuesta HTML del integrador terminó en `buk_sync_jobs.error_message` y luego en `Personal a Contratar`, rompiendo la legibilidad de la pantalla y exponiendo contenido interno del proveedor.
- **La regla correcta es sanitizar en la frontera backend y volver a sanitizar al leer históricos.** La Edge Function debe guardar status, endpoint seguro y tipo de respuesta, pero no el cuerpo HTML; la UI debe protegerse igualmente ante mensajes antiguos o inesperados que ya estén persistidos.
- **Los errores estructurados sí deben conservarse cuando son parte del contrato operativo.** Si BUK responde JSON con `errors`, ese payload puede seguir alimentando reglas como duplicado o plan existente; lo inseguro es tratar cualquier texto externo como mensaje listo para usuario.

## 218. Cuando se extrae un helper compartido de errores Supabase, el refactor no termina hasta migrar todos los call sites del dominio y cerrar con smoke real de rutas base

- **Dejar convivir `formatSupabaseError(...) || fallback` y `error.message || fallback` dentro del mismo módulo reintroduce drift aunque el helper nuevo ya exista.** En este ERP, reclutamiento todavía mezclaba ambos patrones después de haber creado `getSupabaseErrorMessage(...)`, lo que dejaba mensajes resueltos por caminos distintos para operaciones cercanas.
- **La regla correcta es expresar cada intención con un modo explícito del helper compartido.** Si la UI necesita mensaje limpio usa `plain`; si necesita detalle compuesto usa `annotated`; si el contrato previo dependía solo de `error.message`, usa `message` en vez de seguir leyendo el objeto a mano.
- **Cuando el cambio toca infraestructura transversal de servicios o componentes compartidos, el cierre no puede quedarse solo en `tsc/build`.** Hace falta al menos un smoke browser de rutas base como login, recuperación de contraseña y un guard autenticado para demostrar que la compactación no dejó a la app montando pero rota al navegar.

## 219. Un JWT válido no basta para usar `service_role`; la Edge Function debe validar también la autorización de dominio antes de saltarse RLS

- **Supabase puede verificar el JWT de una Edge Function y aun así el código puede abrir un bypass si después usa `service_role` sin revisar permisos del módulo o rol.** En ORION, el procesador documental descargaba cualquier `filePath` del bucket y escribía embeddings con privilegios elevados; el control visible de UI no era una frontera de seguridad.
- **La regla correcta es validar identidad y permiso backend antes de crear efectos privilegiados.** Primero se debe resolver el usuario con `auth.getUser(accessToken)`, luego exigir la capacidad real (`user_is_admin(...)`, `user_can_access_module(...)` o capability específica según el contrato), y recién después usar `service_role` para operaciones internas inevitables.
- **Cuando la UI restringe una acción a superadmin, la RLS/storage/RPC debe decir lo mismo.** Si storage o tablas permiten `ai_assistant` pero los botones de upload/delete solo aparecen para superadmin, cualquier cliente alternativo puede saltarse la UI; el backend debe conservar la regla autoritativa.

## 220. Una vista analítica heredada no puede seguir expuesta por PostgREST si ya existe una RPC autorizada para ese dominio

- **Crear RPCs `SECURITY DEFINER` con gates de permiso no cierra la superficie si las vistas base siguen con `grant select to authenticated`.** En BI, el frontend consumía `get_bi_*`, pero las vistas `buk_bi_*` todavía podían consultarse directo y evitar `user_can_access_bi_analytics(...)`.
- **La regla correcta es dejar una sola frontera pública para el dato sensible.** Si la API viva es la RPC autorizada, las vistas internas deben perder grants a `public`, `anon` y `authenticated`, salvo que exista un consumidor explícito y protegido que justifique otro contrato.
- **Antes de revocar, demuestra compatibilidad con consumidores reales.** Hay que buscar usos directos en frontend, Edge Functions y scripts, y confirmar que las RPCs autorizadas siguen concedidas y validan rol/perfil internamente.

## 221. Si una tabla operativa conserva JSON crudo de un proveedor, el primer cierre compatible es privilegio por columna antes que romper todo el contrato

- **`raw_payload` no tiene el mismo nivel de exposición aceptable que las columnas operativas derivadas.** En trabajadores BUK, el JSON completo puede contener detalles laborales y personales que no deberían quedar consultables por cualquier rol que solo necesita nombre, cargo, contrato o RUT.
- **La salida segura no siempre es revocar toda la tabla en el primer paso.** Si hay realtime, RPCs heredadas y lookups operativos, se puede revocar el `select` amplio y volver a conceder solo columnas explícitas, dejando el payload crudo para `service_role` y funciones backend controladas.
- **Después de ocultar el payload crudo, el siguiente cierre debe ser de alcance, no de forma.** Todavía hay que definir filtros por contrato/área/rol sobre las columnas operativas, pero ese cambio debe hacerse con inventario de consumidores para no romper flujos productivos.

## 222. En storage documental, poder ver un caso no equivale a poder mutar sus objetos

- **Las policies de storage deben separar lectura de escritura aunque la tabla de metadata ya esté protegida.** En `candidate-docs`, la tabla `candidate_documents` exigía gestión para insertar/actualizar, pero el bucket permitía `insert/update/delete` a cualquiera que solo pudiera ver el caso.
- **Si el frontend sube el archivo antes de llamar la RPC, storage es una frontera de seguridad real.** Un cliente alternativo puede saltarse el orden esperado de React y dejar objetos huérfanos, reemplazados o borrados si la policy del bucket es más laxa que la RPC.
- **La RPC debe validar que el path pertenece al sujeto que recibe la metadata.** No basta con que el usuario gestione algún candidato; `upload_candidate_document(...)` tiene que rechazar rutas cuyo primer folder no sea el `p_case_candidate_id` exacto.

## 223. Un helper genérico de permisos con `target_user_id` debe estar atado al actor o ser solo interno

- **Las funciones como `user_has_capability(user, capability)` y `user_can_access_feature(user, feature)` pueden convertirse en oráculos de la matriz de seguridad.** Aunque no ejecuten la acción protegida, permiten enumerar qué puede hacer otro usuario si aceptan cualquier UUID desde un cliente autenticado.
- **La regla segura es `auth.uid() = target_user_id` o admin.** Si el helper necesita seguir disponible para policies o RPCs de dominio, primero valida el actor; si no tiene contrato público, revoca ejecución directa y déjalo como helper interno de funciones `SECURITY DEFINER`.
- **Los warnings de `target_user_id` no se resuelven renombrando parámetros.** La evidencia real es que la función bloquee la consulta cruzada antes de leer roles, capabilities o features.

## 217. Cuando la unificación de helpers de servicios se abre por dominio, hay que cerrarla hasta cubrir todas las variantes equivalentes o el drift reaparece en los módulos que quedaron fuera

- **Centralizar solo los primeros servicios no elimina la deuda si otros módulos siguen copiando la misma infraestructura.** En este ERP, después de unificar reclutamiento, movilidad interna e incentivos, todavía persistían copias equivalentes de `getSupabaseClient`, `asArray`, `readNullableText` y variantes cercanas en roster, accreditation, operaciones y BI.
- **La regla correcta es extender el helper compartido con variantes aditivas y luego barrer los dominios restantes sin cambiar sus contratos públicos.** Si un módulo necesita `asRecord`, `readBoolean` o `readNumber`, agrégalos al helper común y migra el dominio; no inventes un segundo helper paralelo ni fuerces a todos a un mismo contrato de retorno.
- **Los servicios con contrato mixto también deben respetarse durante la unificación.** Si un dominio como operaciones combina funciones que lanzan `Error` con otras que devuelven `{ ok, error }`, la extracción compartida debe compactar solo la infraestructura compatible y dejar intacta la frontera pública en vez de “normalizarla” por conveniencia.

## 216. Cuando varios wrappers React solo cambian hook, `id` o fallbacks visuales, el refactor seguro es un adapter aditivo sobre el componente base, no una reescritura de consumidores

- **Cuatro wrappers casi idénticos son deuda real aunque “se lean simples”.** En este ERP, los lookups de roster, movilidad interna, incentivos y operaciones repetían la misma estructura sobre `WorkerLookupField` y diferían solo en el hook de búsqueda, el identificador del trabajador, algunos mensajes y el fallback operativo mostrado al usuario.
- **La regla correcta es extraer un adapter compartido que preserve las props públicas existentes y deje configurables solo las variaciones reales.** Nombre completo, línea `RUT · cargo` y línea `área/contrato` deben centralizarse; `onSearchChange`, `filterResults`, `searchContext`, fallback textual y sufijo de empresa deben seguir siendo opt-in por wrapper.
- **Si el componente base ya es genérico, el refactor debe revalidar que la firma realmente propague todos sus genéricos.** En este caso, `WorkerLookupField` aceptaba `TSearchContext` en el type alias pero no lo trasladaba en la firma del componente, lo que recién apareció al crear un adapter más tipado encima; corregir esa base evita que la siguiente reutilización tropiece con el mismo bug.

## 215. La capa de servicios que consume RPCs no debe seguir copiando guards de Supabase ni formateadores de error; debe centralizarlos en helpers compartidos y preservar el contrato externo de cada módulo

- **La duplicidad pequeña en la frontera frontend/RPC se convierte rápido en drift operativo.** En este ERP, `formatRpcError(...)`, `asArray(...)`, `readNullableText(...)` y el guard de `Supabase` ya se habían replicado entre reclutamiento, movilidad interna e incentivos con diferencias de texto y fallback que no agregaban valor de dominio.
- **La regla correcta es extraer helpers aditivos en `src/shared/lib` y migrar primero los servicios más repetidos, sin cambiar cómo responde cada módulo hacia sus hooks consumidores.** Si un servicio ya devuelve `{ data, error }`, debe seguir haciéndolo; si otro ya lanza `Error`, también. La unificación debe ocurrir por dentro, no romper contratos aguas arriba.
- **Cuando el objetivo es compactar sin riesgo, centraliza solo la infraestructura repetida y deja local las validaciones de payload y mapping semántico.** Guards de cliente, formatters de error y lectores básicos sí son compartibles; `map*`, `require*Field` y reglas de negocio siguen perteneciendo al dominio que entiende ese RPC.

## 211. Un `success` de cancelación ERP no es una generación efectiva en BUK y no puede alimentar buckets ni bloqueos de reproceso

- **`buk_sync_jobs.status = 'success'` no basta por sí solo para concluir que el alta quedó operativamente resuelta.** En contratación, la rama `cancel_request_existing_active_buk_employee` marca el job como exitoso para auditar la anulación, pero ese éxito representa un retiro del candidato, no una contratación efectiva.
- **La regla correcta es clasificar explícitamente qué tipos de `success` cuentan como alta real.** Si el snapshot trae `result_snapshot.erpAction.action = 'cancel_request_existing_active_buk_employee'`, ese job debe quedar fuera de `get_candidate_buk_sync_payload(...)`, `enqueue_buk_generation(...)`, buckets de `Personal a Contratar` y recordatorios automáticos; de lo contrario, el sistema esconde candidatos reactivables y bloquea su reparación.
- **Cuando un caso histórico quedó mal anulado, conserva la auditoría del error y agrega una nueva reactivación canónica en vez de “borrar” el success viejo.** El fix correcto es introducir un helper semántico como `is_effective_buk_generation_success(...)`, revertir la etapa con un `reason_code` de reparación y generar un nuevo job efectivo sobre la ficha correcta (`F2`, `F3`, etc.), sin destruir la trazabilidad del falso duplicado original.

## 213. Cuando la regla de negocio exige renta base BUK en cero, no basta con enviar `wage = 0`; el payload y la detección de drift deben cubrir también `base_wage`

- **Un job BUK puede quedar auditado como “salario cero” sin haber fijado explícitamente la base salarial que muestra la ficha.** Si el worker solo envía `wage = 0` pero omite `base_wage`, el ERP parece cumplir la norma en el snapshot del job y aun así deja margen para que BUK conserve o derive una renta base distinta de cero.
- **La regla correcta es endurecer ambas capas:** el payload de creación/parche debe mandar `wage = 0` y `base_wage = 0`, y la lógica de reparación debe tratar como drift cualquier job que siga exponiendo `wage/base_wage` distinto de cero.
- **Cuando el usuario pide “corrige solo hacia adelante”, la solución enterprise debe vivir en el runtime y no en una migración de backfill.** Ajusta `sync-buk-candidates` para futuras altas y futuros retries, documenta el histórico afectado como evidencia, pero no alteres fichas ya creadas si el usuario excluyó expresamente esa reparación.

## 214. El turno ERP del folio no puede inyectarse a BUK sin una traducción canónica entre el catálogo de turnos y los campos legales del job

- **`shift_name` del folio y `type_of_working_day` de BUK no son la misma dimensión.** En este ERP, valores como `7X7`, `14X14` o `10X10` existen como catálogo operativo de `public.shifts`, mientras el worker BUK hoy crea jobs con campos regulatorios como `ordinaria_art_22` u `otros` + `other_type_of_working_day`.
- **La regla correcta es no inferir una jornada legal desde el nombre visual del turno sin una tabla puente versionada.** Si falta ese mapping ERP -> BUK, reutilizar el turno del folio directamente puede clasificar mal la jornada y romper altas productivas aunque el nombre “parezca obvio”.
- **Si el cambio debe aplicar solo a casos futuros, la implementación segura empieza por el catálogo, no por un backfill.** Primero versiona la equivalencia canónica y úsala solo en nuevos `create/patch` del worker; recién después evalúa si tiene sentido corregir históricos.

## 212. Cuando una tabla nueva entra al esquema `public` como parte de la matriz de permisos, debe nacer con el mismo paquete completo de RLS que sus tablas hermanas

- **Crear la tabla y poblarla no alcanza si el API de Supabase la expone por PostgREST.** En esta base, `app_features` y `role_feature_access` heredaron grants amplios del esquema expuesto y quedaron reportadas como `rls_disabled_in_public` solo porque la migración que las creó omitió `ENABLE ROW LEVEL SECURITY` y sus políticas `SELECT`.
- **La regla correcta es tratar cada ampliación de la matriz de acceso como una familia y no como tablas aisladas.** Si `app_modules`, `app_roles`, `role_module_access`, `app_capabilities` o `role_capabilities` ya definen el patrón de RLS, cualquier tabla nueva equivalente debe replicarlo en la misma migración o en una correctiva inmediata.
- **Antes de asumir que el advisor de Supabase es ruido, contrasta tres cosas en remoto:** si la tabla está en `public`, si `relrowsecurity` está en `false`, y si los grants a `anon/authenticated` siguen abiertos. Cuando esas tres condiciones coinciden, el hallazgo es real aunque la aplicación consuma la tabla solo a través de funciones SQL.

## 208. En aprobaciones 1:1 por contrato, el gerente de área no puede resolverse solo por `cost_center_code` cuando ese código colisiona entre gerencias

- **Un `cost_center_code` compartido entre contratos distintos no alcanza para decidir quién aprueba una solicitud.** En contratación, `10111` existe tanto para `MANTENCION CALAMA` como para contratos de `RECURSOS HUMANOS`; si `submit_hiring_request(...)` mira solo `cost_center_approvers`, puede asignar al gerente correcto para un centro y al completamente equivocado para otro.
- **La regla correcta es priorizar el match operativo 1:1 del contrato antes del catálogo global por centro de costo.** Si `buk_contract_mappings` ya define `manager_name` para un contrato `is_one_to_one = true` e `is_operational = true`, esa debe ser la fuente primaria del `area_manager`; `cost_center_approvers` queda como fallback para contratos sin mapping contractual resoluble.
- **Cuando la UI muestra un aprobador “imposible”, primero audita la clave de resolución, no el modal.** Si el historial `hiring_request_approvals` trae un nombre ajeno al contrato, lo más probable es que el bug haya quedado en la función que construye el flujo, no en el componente que lo renderiza.

## 209. Un correo transaccional de aprobación debe abrir la misma superficie operativa donde la tarea realmente se resuelve

- **No basta con que la tarea exista en el dashboard si el enlace del correo sigue apuntando a un módulo histórico distinto.** En WHO, el usuario recibía el correo correcto pero aterrizaba en `Control de Contrataciones`, mientras la acción viva estaba en el widget de tareas del inicio.
- **La regla correcta es alinear backend y frontend sobre una ruta canónica única por tipo de tarea.** Si `who_approval` se opera desde `DashboardHome`, entonces tanto `enqueue_who_pending_approval_email(...)` como cualquier helper de navegación UI deben resolver `route = '/'` antes de enviar al usuario a una bandeja secundaria.
- **Cuando una aprobación “sí existe pero no se encuentra”, audita primero la URL de entrada antes de tocar permisos o visibilidad.** Un deep-link mal apuntado puede parecer un problema de acceso, aunque el usuario sí tenga la tarea cargada en otra superficie del sistema.

## 210. Cuando el backend expone métricas efectivas de cupos, la UI no puede rotularlas como categorías puras de personas

- **Un contador efectivo puede mezclar estados distintos por diseño operativo.** En reclutamiento, `candidate_count` ya incluye activos del pipeline y movilidad interna pendiente, mientras `hired_candidates` puede incluir contratados efectivos y movilidad aprobada porque ambos impactan la ocupación del folio.
- **La regla correcta es derivar un breakdown visual explícito antes de renderizar pelotas por estado.** Si la pantalla necesita mostrar `Activos`, `Contratados` y `Movilidad Interna`, la UI debe restar de los contadores efectivos las porciones de movilidad que el backend agregó para lógica de cupos, en vez de mostrar esos totales como si fueran categorías limpias.
- **La semántica de cupos no debe corregirse con maquillaje visual ni la visual con cambios de backend innecesarios.** Si la función de métricas ya mantiene bien la reserva/consumo de cupos, el fix correcto es separar la presentación con un helper reutilizable y aplicarlo en todas las vistas que compartan ese bloque.

## 207. Si el ERP promete el siguiente correlativo de ficha BUK, esa resolución debe salir del registro vivo de fichas y no de un campo histórico local

- **`candidate_worker_files.employee_code` es memoria transaccional, no la verdad final del trabajador en BUK.** Si el ERP calcula `F1/F2/F3...` solo desde ese campo, termina reciclando `F1` o ignorando fichas que ya fueron creadas por el propio runtime en BUK.
- **La regla correcta es resolver primero el último correlativo visible en la identidad real del trabajador.** Antes de devolver `suggested_employee_code`, el backend debe mirar el historial reciente de `buk_sync_jobs` y el registro vivo de `public.employees.raw_payload ->> 'code_sheet'` para el mismo RUT/documento; recién después puede usar `candidate_worker_files` como apoyo histórico.
- **Cuando la verdad canónica cambie, el payload vivo y la ficha persistida deben quedar alineados en la misma pasada.** No basta con corregir la función resolutora: hay que hacer backfill de `candidate_worker_files.employee_code` y hacer que `get_candidate_buk_profile(...)` y las exportaciones consuman prioritariamente `suggested_employee_code`, o la UI sigue mostrando la ficha vieja aunque backend ya haya resuelto la nueva.

## 206. En trabajos BUK con `working_schedule_type = 'otros'`, el subtipo `other_type_of_working_day` es obligatorio y debe viajar desde el contexto operativo canónico

- **Copiar solo `working_schedule_type` desde un sample del área no alcanza cuando BUK clasifica la jornada como `otros`.** En ese caso el API también exige `other_type_of_working_day`; si el worker lo omite, deja fichas creadas y planes listos pero el job muere con `Otros Tipos de Jornada no puede estar en blanco`.
- **La regla correcta es extraer el subtipo desde la misma fuente que resuelve `company_id`, `area_id`, `leader_id` y `weekly_hours`.** Si el contexto job se deriva de empleados activos del área, el snapshot local debe arrastrar también `other_type_of_working_day`; no hay que inventarlo en frontend ni hardcodearlo por contrato.
- **Cuando un error externo habla de un campo BUK “en blanco”, primero valida si el worker ya estaba reconstruyendo solo la mitad de una enum compuesta.** Muchas configuraciones de BUK no son un único campo atómico; el tipo principal y su variante subordinada deben preservarse juntos o la integración parece correcta hasta el POST final.

## 205. En integraciones BUK, una ficha creada no debe salir del bucket pendiente hasta que el job canónico quede `success`, y eso exige parsers tolerantes del API externo

- **Que BUK ya tenga una ficha `F2` no significa que la generación efectiva haya terminado para el ERP.** En `Personal a Contratar`, la salida del bucket depende de `buk_sync_jobs.status = 'success'` con `buk_employee_id`; si la ficha quedó creada pero el worker falló al reparar plan/trabajo, el candidato debe seguir visible porque aún no existe confirmación canónica de alta efectiva.
- **La regla correcta es endurecer el worker, no maquillar el bucket.** Si `sync-buk-candidates` reusa una ficha incompleta y BUK responde `Ya existe un plan para este Empleado`, el fix no es esconder al candidato de la lista, sino recuperar el plan existente, completar el trabajo pendiente y recién entonces cerrar el job como `success`.
- **Nunca asumas un único shape de colección en APIs externas cuando esa lectura decide estados terminales del ERP.** Si un endpoint BUK puede responder arrays en `data`, `plans`, `jobs`, `items` o `results`, el parser debe tolerarlo; de lo contrario, el worker concluye falsamente que “no hay plan/job”, intenta recrearlo y deja a la UI atrapada en un falso pendiente permanente.

## 204. Un trigger nuevo de contratación no puede copiar payloads de otros módulos ni de funciones previas sin verificar primero el esquema real de `hiring_requests`

- **PostgreSQL permite crear funciones que referencian columnas inexistentes y recién falla cuando el trigger las ejecuta.** En `enqueue_personnel_to_hire_email(...)`, reutilizar `hr.request_context` y `hr.module_label` rompió el avance a `ready_for_hire` con `42703` aunque la migración hubiera aplicado sin errores.
- **La regla correcta es auditar la tabla fuente real antes de clonar un `SELECT` o payload JSON de otra notificación.** Si el módulo es contratación, `public.hiring_requests` no expone por defecto las columnas semánticas que sí existen en movilidad interna; cuando el contexto es fijo, el payload debe usar literales canónicos como `request_context = 'hiring'` y `module_label = 'Contratación'`.
- **Toda notificación disparada por cambio de etapa debe validarse como flujo ejecutado, no solo como SQL que compila o migra.** Si una función queda detrás de `after update of stage_code`, la prueba mínima de cierre debe incluir mover una candidatura por esa etapa o, al menos, revisar la función contra el patrón runtime ya endurecido en funciones hermanas.

## 202. Un widget con tabla filtrada no puede mezclar KPIs globales de otra fuente si promete responder al mismo filtro

- **Si la tabla viene de una RPC paginada/filtrada pero las tarjetas vienen del resumen global del dashboard, el usuario ve dos verdades distintas en la misma caja.** En `Folios en curso`, buscar por contrato o gerencia cambiaba las filas visibles, pero dejaba congelados `Folios activos`, `Candidatos en curso` y `Casos cubiertos`, haciendo parecer que el filtro no funcionaba.
- **La regla correcta es sacar filas y KPIs del mismo conjunto filtrado.** Si el widget ya depende de `get_recruitment_processes_page(...)`, el backend debe devolver también un `summary` calculado desde el mismo `filtered` CTE en vez de pedirle al frontend que mezcle el bundle global con una query local.
- **Cuando negocio pide filtrar por una dimensión verbal como “gerencia”, primero reutiliza la semántica canónica que ya existe en el módulo.** En este flujo la señal operativa vigente no era una columna `gerencia`, sino `cost_unit/cost_unit_name` y su alias visible vía `cost_center_name`; el search debe ampliarse sobre esa verdad existente antes de inventar una nueva dimensión paralela.
- **Si el backend aún no expone el bloque opcional de `summary`, el frontend no puede coaccionar `null/undefined` a un objeto de ceros.** Hacer eso bloquea cualquier fallback útil y hace parecer que el sistema “confirmó” métricas nulas cuando en realidad solo faltaba una migración remota o un campo opcional del payload.

## 203. Una migración de reparación productiva puntual no puede romper otros entornos si el caso objetivo no existe o ya quedó saneado

- **Versionar una reparación auditable no autoriza a acoplarla ciegamente a un único registro vivo.** Si la migración asume que un `candidate_id`, `approval_id` o estado exacto siempre existirá, `db push` sobre otro entorno o sobre un snapshot ya reparado termina fallando por una incidencia histórica que ya no aplica allí.
- **La regla correcta es separar “objetivo ausente o ya corregido” de “objetivo presente pero inconsistente”.** Cuando el caso puntual no existe o ya fue saneado, la migración debe dejar `raise notice` y salir como `no-op`; solo debe levantar excepción si el caso sí existe pero rompe las invariantes que la reparación promete proteger.
- **Toda reparación one-off que entra al repositorio debe ser portable antes de mergearse a `main`.** Aunque haya sido diseñada por una urgencia productiva, el estándar del repo sigue siendo que otra base pueda recorrer la historia de migraciones sin caerse por datos que nunca estuvieron ahí.

## 201. Si una RPC v2 reemplaza una ruta viva de aprobación, debe preservar explícitamente los bypass y gates que la UI ya usa

- **No basta con que la nueva RPC compile y cubra el caso feliz del aprobador asignado.** En `decide_hiring_request_approval_v2(...)`, quitar el bypass de `admin/superadmin` mientras el frontend seguía propagando `isAdmin` dejó a los administradores viendo la cola pero fallando al decidir.
- **La regla correcta es auditar el contrato completo antes de sustituir una RPC anterior:** visibilidad de la cola, detalle, permiso de decisión y cualquier escape hatch operativo vigente. Si v1 permitía `user_is_admin(...)`, v2 debe preservarlo o la UI debe eliminar explícitamente ese camino en el mismo cambio.
- **Cuando un prop o capability queda “preparado” en React pero no llega al punto de uso, eso es señal de drift contractual, no solo deuda cosmética.** Un `isAdmin` no cableado suele delatar que backend y frontend ya dejaron de hablar la misma verdad.

## 200. En formularios con lookup/autocompletado por identidad, toda respuesta async debe validarse contra el input vigente antes de mutar estado

- **Lanzar búsquedas paralelas por RUT sin token de vigencia ni comparación contra el valor actual deja el formulario expuesto a respuestas fuera de orden.** El resultado típico es autocompletar nombre/correo del candidato anterior o mostrar alertas BUK desfasadas mientras el usuario ya cambió el identificador.
- **La regla correcta es invalidar búsquedas previas y limpiar estado derivado cuando cambia la identidad fuente.** Si el RUT deja de ser válido o cambia a otro valor, el sistema debe vaciar perfil encontrado, estado BUK y cualquier autofill asociado antes de aceptar una respuesta vieja.
- **Los modales reutilizables siguen la misma norma.** Si el contexto entidad->destino cambia entre aperturas, `targetId`, comentarios y errores deben resetearse al abrir/cerrar para no arrastrar una decisión anterior a un candidato nuevo.

## 199. En contratación BUK, el líquido ERP no debe mapearse como sueldo base del trabajo

- **`salary_offer` o la renta líquida del requerimiento no equivalen al `wage` contractual que espera BUK.** Cuando la integración cargó ese valor como sueldo base, dejó contratos con una renta estructural que negocio no quería consolidar automáticamente y además mezcló dos conceptos distintos: renta ofrecida al candidato vs. base legal/operativa de remuneraciones.
- **La regla correcta es dejar `wage = 0` si remuneraciones debe completar el sueldo base manualmente.** Si el proceso real exige validación posterior de renta en BUK, el worker debe crear el trabajo con base `0` y nunca inferir el sueldo base desde el líquido ERP.
- **Si ya se publicaron trabajos BUK con la renta base incorrecta, la reparación debe incluir patch productivo sobre los `jobs` ya creados.** No basta con corregir el worker para futuras altas; también hay que sanear las fichas activas afectadas para no dejar remuneraciones trabajando con información falsa.

## 198. Un rechazo WHO emitido por error no debe corregirse sobrescribiendo la fila rechazada; debe reabrirse con una nueva resolución auditada

- **Cambiar `rejected` a `approved` sobre la misma fila destruye la evidencia del error original y deja la auditoría incoherente.** En la corrección de Rodolfo Francisco González Ortiz, la fila rechazada (`candidate_stage_approvals.id = 80`) debía seguir existiendo para explicar por qué el candidato salió del pipeline antes de ser reparado.
- **La regla correcta es versionar una reapertura explícita del candidato y emitir una nueva resolución WHO.** Primero se reactiva `rejected -> lead`, luego se registra una nueva solicitud `lead -> who_pending` y finalmente una nueva aprobación `who_pending -> who_approved`, apuntando la aprobación final al usuario que asumió la corrección.
- **Si la reparación crea varios eventos en el mismo instante, hay que normalizar el orden temporal de historial y auditoría.** Cuando reactivación, nueva solicitud y nueva aprobación comparten el mismo `created_at`, la UI puede mostrar la línea de tiempo fuera de orden; por eso la corrección debe dejar timestamps secuenciales y payloads consistentes entre tabla viva, stage history y audit log.

## 191. En catálogos operativos BUK, la empresa jurídica no puede inferirse solo desde el sufijo del `contract_number`

## 197. Una RPC interna service-role no puede reutilizar helpers de negocio que arrancan exigiendo `auth.uid()`

- **Que una función esté marcada `security definer` y solo se otorgue a `service_role` no significa que todos los helpers que invoca sean aptos para ejecución interna.** En la reparación de duplicados activos BUK, `finalize_buk_sync_job_existing_active_employee(...)` falló con `Usuario no autenticado` porque delegó la cola documental a `enqueue_candidate_document_cleanup(...)`, helper pensado para sesiones humanas autenticadas.
- **La regla correcta es que los side effects internos sean autocontenidos o tengan una variante interna explícita.** Si una RPC service-role necesita encolar limpieza, cambiar estados o dejar auditoría, debe escribir directamente sobre las tablas necesarias o llamar otra RPC diseñada también para contexto interno; no debe depender de un helper que vuelve a validar `auth.uid()` y permisos interactivos.
- **Cuando una corrección interna falla con `Usuario no autenticado` pese a entrar por `service_role`, la auditoría debe seguir la cadena de funciones llamadas, no el grant inicial.** El grant puede estar bien; el problema real suele estar en un helper intermedio que aún asume contexto JWT de usuario final.

## 196. En duplicados activos BUK, “ya existe” no equivale a contratación exitosa reutilizable dentro del ERP

- **Si BUK rechaza la creación porque el trabajador ya existe activo, no basta con reutilizar su `buk_employee_id` y dejar al candidato en `hired`.** Eso convierte una duplicidad contractual en una falsa alta exitosa, deja `filled_vacancies` infladas y mantiene una solicitud viva donde el negocio en realidad quería anular la pedida.
- **La regla correcta es separar dos ramas:** trabajador inactivo existente => nueva ficha correlativa (`F2`, `F3`, ...); trabajador activo existente => anulación ERP auditada, con retiro del candidato y cierre/cancelación del requerimiento cuando corresponda.
- **La resolución debe quedar trazada en el job, en la historia del candidato y en la solicitud/caso.** El `result_snapshot` del job debe registrar la acción de negocio; el candidato debe salir de `hired`; y el folio/caso debe reflejar explícitamente que se cerró por duplicidad activa en BUK, no por una contratación nueva.

- **Un mapping operativo 1:1 puede compartir sufijo contractual con otra empresa y aun así pertenecer a una razón social distinta.** `CODELCO - DSAL` usa `6170400011:0001`, pero en BUK corresponde a `Consorcio Andino SPA`; degradarlo por la regla genérica `:0001 => Buses JM Pullman S.A.` contaminó tanto el catálogo destino como solicitudes de movilidad ya persistidas.
- **La regla correcta es tratar `company_name` como dato canónico del catálogo operativo cuando el negocio ya conoce la excepción.** Si un área/contrato fue auditado y tiene empresa jurídica explícita, el backend debe persistirla o resolverla por excepción antes de aplicar heurísticas por `company_id` o sufijo contractual.
- **Cuando una clasificación contractual incorrecta ya generó requests productivos, la reparación debe incluir backfill sobre las entidades derivadas.** No basta con corregir el helper para nuevos casos: también hay que sanear `internal_mobility_requests` y cualquier snapshot visible que hoy siga induciendo a finiquito o cambio de empresa inexistente.

## 195. En generación masiva BUK, un timeout de la invocación HTTP no prueba que la cola haya fallado

- **Si `generateCandidatesInBuk(...)` espera la respuesta completa de `sync-buk-candidates`, la UI puede marcar error aunque los jobs ya estén corriendo o incluso terminando bien.** En producción, una carga de 6 candidatos tardó varios minutos en cerrar por el trabajo serial del worker, pero `buk_sync_jobs` mostró `started_at` inmediato y resultados `success/error` reales mientras la app seguía mostrando “Edge Function returned a non-2xx status code”.
- **La regla correcta es reconciliar el mensaje de UI con el estado canónico de la cola.** Ante un corte de la invocación larga, el frontend debe consultar `buk_sync_jobs` autorizados y distinguir entre `pending sin progreso` y `processing/success/error` ya observables antes de declarar fallo.
- **Cuando un flujo async tiene cola autoritativa, el mensaje de error no puede depender solo del transporte HTTP.** El transporte puede cortar por timeout; la verdad funcional está en `status`, `started_at`, `finished_at` y `error_message` del job.

## 194. Si la API BUK ya soporta `path` en upload documental, no dejar el worker ERP escribiendo por omisión en la carpeta raíz

- **Que los documentos lleguen “correctamente” a BUK no significa que el contrato esté completo.** Si el worker llama `POST /employees/{id}/docs` sin `path`, BUK los guarda en la carpeta raíz del colaborador aunque el producto soporte carpetas semánticas como `Postulación`.
- **La regla correcta es auditar el `apidocs` vivo del tenant antes de asumir límites de la integración.** En este caso, el tenant documenta explícitamente `path` como query param de upload; por tanto, el fix no era crear una postcapa manual ni mover archivos después, sino enviar el parámetro correcto en la creación.
- **Cuando el integrador devuelve metadatos de folder, hay que persistirlos en la auditoría del job.** Guardar `employee_folder_id` o equivalente en `result_snapshot.documents` evita volver a discutir si el documento quedó realmente en `Postulación` o volvió a caer en raíz.

## 193. Si `Personal a Contratar` ya usa un helper operativo propio, la autorización del job async BUK no puede seguir validando por gestión completa del caso

- **Que el usuario pueda encolar un job no garantiza que la Edge Function pueda tomarlo.** Si `enqueue_buk_generation(...)` valida con `user_can_manage_recruitment_personnel_candidate(...)` pero `authorize_buk_sync_jobs(...)` sigue exigiendo `user_can_manage_recruitment_case(...)`, el flujo queda partido: la UI crea el job, pero `sync-buk-candidates` devuelve no-2xx antes del `claim` y deja la fila atascada en `pending`.
- **La regla correcta es alinear síncrono y asíncrono con la misma frontera de autorización.** Todo lo que represente “operar un candidato pendiente BUK” debe aceptar el helper operativo del candidato, aunque el rol no tenga gestión completa del caso ni acceso al resumen general.
- **Cuando una UI reporta “se encoló, pero la Edge Function devolvió no-2xx”, la primera prueba debe mirar si el job quedó `pending` con `started_at = null`.** Ese patrón apunta a fallo de autorización o bootstrap previo al worker, no a error del payload BUK ni de la integración externa.

## 192. El detalle operativo y el payload BUK deben compartir la misma frontera canónica de “pendiente de generación”, aunque el resumen general siga cerrado para `administrativo`

- **Un rol puede no tener acceso al resumen del proceso y aun así necesitar operar el tramo BUK del caso.** Si `get_recruitment_case_detail(...)` arranca heredando `user_can_view_recruitment_process_summary(...)`, `administrativo` termina viendo la pestaña `Personal a Contratar` pero choca con `Sin permisos para ver este proceso de contratación` al abrir el caso.
- **La regla correcta es separar el gate operativo del gate ejecutivo.** El detalle usado por ficha BUK, checklist y generación debe aceptar `user_can_access_recruitment_personnel(...)` aunque `summary_access` sea false, siempre sin devolver visibilidad a `Control de candidatos`.
- **El bucket pendiente BUK y la RPC que genera el payload deben clasificarse con el mismo criterio externo.** Si `Personal a Contratar` agrupa candidatos sin sync BUK exitosa aunque estén en `ready_for_hire` o `hired`, entonces `get_candidate_buk_sync_payload(...)` no puede seguir hardcodeado a `stage_code = ready_for_hire`; esa deriva vuelve a romper producción exactamente en el clic de `Generar en BUK`.

## 190. Un tab visible de contratación no puede seguir dependiendo en backend de `candidate_control_access` ni de un helper de visibilidad de casos pensado para reclutamiento

- **Ocultar `Control de candidatos` en UI no resuelve por sí solo el permiso operativo de `Personal a Contratar`.** Si la lista, el detalle, la ficha BUK o el checklist siguen llamando RPCs que arrancan con `assert_candidate_control_access(...)` o filtran por `user_can_view_recruitment_case(...)`, el rol `administrativo` queda con la pestaña visible pero sin datos ni operaciones reales.
- **La regla correcta es separar el permiso por subflujo y por entidad.** `Control de candidatos` puede seguir gobernado por `candidate_control_access`, pero `Personal a Contratar` necesita su propio helper backend, acotado a candidatos en `ready_for_hire/hired`, para que RRHH administrativo opere solo el tramo BUK sin heredar acceso al pipeline completo.
- **Cuando se retire una capability heredada de un rol, primero hay que recompilar todas las RPCs compartidas que la reutilizaban.** En este módulo, antes de borrar `candidate_control_access` de `administrativo`, hubo que aislar `get_recruitment_personnel_page_bucket(...)`, `get_recruitment_case_detail(...)`, ficha BUK, checklist documental, edición de ficha/licencia/notas y cola BUK; si no, el cambio vuelve a romper producción aunque la matriz de features esté correcta.

## 181. En fichas BUK con columnas marcadas por plantilla, la obligatoriedad real debe gobernarse por contrato operativo y aplicabilidad de negocio

## 189. En Control de Contrataciones, la visibilidad de tabs y las capacidades operativas compartidas no pueden mezclarse en un mismo gatillo de UI

- **Que una pestaña se oculte no significa que su capability backend deba desaparecer.** `Personal a Contratar` reutiliza ficha BUK, checklist documental, cola BUK y detalle de caso que históricamente colgaban de `candidate_control_access`; quitar ese permiso a `administrativo` sin separar la capa visual rompe el subflujo aunque la tab siga visible.
- **La regla correcta es separar dos contratos:** `role_feature_access` decide qué tabs ve cada rol, mientras las capabilities o helpers backend sostienen las RPCs compartidas que siguen siendo necesarias dentro de otra pestaña. Si un rol debe operar `Personal a Contratar` pero no ver `Control de candidatos`, la UI debe filtrar por feature y el backend debe conservar explícitamente el permiso operativo requerido para la ficha/documental/BUK.
- **Antes de tocar una matriz de tabs, hay que rastrear qué RPCs reutiliza cada subflujo real.** En este módulo, `get_recruitment_case_detail(...)`, `get_candidate_buk_profile(...)`, `get_candidate_checklist(...)` y la cola BUK comparten superficie entre tabs; si no se audita esa dependencia primero, el fix “visual” termina degradando la operación productiva.

## 188. Una RPC compartida no puede recompilarse contra columnas inexistentes ni cambiar su payload si la UI sigue consumiendo el contrato anterior

- **En ERP versionado, “refactorizar” una función viva con atajos de esquema rompe más que el bug original.** En `get_candidate_checklist(...)`, reemplazar `public.is_driver_job_position(...)` por `job_positions.requires_driver_license` introdujo un `42703` inmediato porque esa columna nunca existió en `public.job_positions`.
- **La regla correcta es reutilizar el helper semántico ya vigente antes de inventar una nueva dependencia de tabla.** Si la lógica del módulo distingue conductores por `is_driver_job_position(...)`, ese helper es el source of truth hasta que exista una migración explícita que cambie el esquema y todos sus consumidores.
- **El contrato de salida de una RPC compartida también es parte del esquema.** Si React consume `documents`, `semaphore` y `document_validation`, no puedes publicar una recompilación que devuelva `checklist` y `semaphore_color` sin migrar coordinadamente la UI y cualquier otra función backend que lea ese JSON.

## 187. Un bucket operativo no debe inferir “contratado en BUK” solo desde la etapa interna del candidato

- **Que un candidato esté en `hired` no prueba por sí solo que ya exista en BUK.** Si la pestaña final se arma solo con `stage_code`, terminan mezclándose cierres internos, drift histórico y verdaderas altas ya emitidas al integrador.
- **La regla correcta es clasificar por la señal canónica del sistema externo cuando el objetivo del bucket depende de ese sistema.** En reclutamiento BUK, `Personal contratado` debe depender de un `buk_sync_jobs.status = success` con `buk_employee_id` válido; el bucket pendiente debe mostrar a quienes aún no tienen esa confirmación, aunque arrastren una etapa interna adelantada.
- **Cuando la UI expone una fecha de hito externo, esa fecha también debe salir de la fuente externa.** Para “Fecha generación BUK”, usa `finished_at`/timestamp del job exitoso antes que `hired_at`, porque `hired_at` puede venir de otra semántica o de datos históricos previos al endurecimiento del flujo.

## 185. En BUK, un caché geográfico “fresco” puede seguir siendo inválido si fue poblado con el nivel jerárquico equivocado

- **Que `GET /locations` responda 200 y alimente el caché no significa que sirva para crear colaboradores.** En el tenant auditado, la llamada sin filtros devolvía solo 16 regiones `depth=1`; el alta de empleados necesitaba `location_id` de comuna (`depth=3`), por lo que el cache quedaba técnicamente fresco pero semánticamente inútil.
- **La regla correcta es fijar explícitamente el nivel geográfico requerido por el caso de uso.** Para alta de empleados, el worker debe priorizar `GET /locations?depth=3`, derivar la región desde `full_name` cuando BUK no la entregue separada, y solo degradar a niveles superiores si el integrador realmente no expone comunas.
- **La política de frescura del caché debe validar forma, no solo timestamp.** Si la tabla local todavía contiene el formato viejo (por ejemplo, solo regiones sin `depth>=3` ni `region_name` derivada), el worker debe forzar refresh aunque el TTL siga vigente; de lo contrario, la integración persiste un error estructural bajo apariencia de caché saludable.

## 186. En exportación XLS `biff8`, las fechas deben salir como serial Excel; no como `Date` tipado `d`

- **Que una librería soporte `Date` en `xlsx` no implica que soporte el mismo contrato en `xls/biff8`.** En `@mylinkpi/xlsx`, una celda `Date` con `cell.t = "d"` terminó bajando a `parseDate(str)` en la ruta BIFF8 y rompió con `match is not a function`.
- **La regla correcta es usar el tipo nativo del formato destino.** Para `xls`, las fechas deben serializarse como número de Excel y marcarse como `cell.t = "n"` con el `z` apropiado; así se preserva semántica de fecha sin depender de coerciones internas inestables.
- **Cuando un error de exportación apunta a una librería de archivo, reproduce primero el caso mínimo fuera del dominio.** Confirmar que el bug nace del writer con un workbook de dos filas evita perseguir falsos positivos en catálogos, perfiles o templates JSON.

## 184. Un worker async autorizado por UI no debe reconstruir datos auth-bound después de encolar; debe consumir el snapshot ya validado

- **Si un job ya fue creado por una RPC autenticada con `payload_snapshot`, volver a llamar una RPC de dominio dentro del worker rompe la frontera de confianza.** Bajo `service_role` o bajo un runtime sin JWT de usuario, cualquier dependencia de `auth.uid()` o helpers equivalentes puede reaparecer como `Usuario no autenticado` aunque el job original haya sido perfectamente válido.
- **La regla correcta es separar autorización y ejecución.** La capa síncrona del ERP autoriza al usuario, resuelve el payload canónico y lo congela en la cola; el worker asíncrono solo debe consumir ese snapshot, registrar progreso parcial e interactuar con sistemas externos.
- **Si una Edge Function ofrece un modo interno alternativo al JWT, el contrato de despliegue debe reflejarlo explícitamente.** No basta con validar `x-internal-webhook-secret` dentro del código si la plataforma todavía exige JWT por delante; la configuración/deploy debe dejar `verify_jwt = false` y el propio handler debe encargarse de distinguir la invocación interactiva de la interna.

- **No basta con copiar literalmente los `*` de un Excel hacia un formulario si algunos campos dependen del régimen seleccionado.** Tratar `Régimen jubilación` como obligatorio siempre, o exigir planes Isapre aun cuando el trabajador está en Fonasa, rompe la operación igual que si faltara un campo realmente crítico.
- **La regla correcta es separar tres capas pero hacerlas coincidir semánticamente:** defaults automáticos visibles en UI, checklist backend de completitud y payload transaccional que habilita el paso siguiente. Si `Rol Privado = No`, `AFC = Menos de 11 Años` o `Código de Ficha = F1/Fx` se derivan por negocio, esa derivación debe vivir también en backend y no solo en React.
- **Cuando el template externo cambia la marca de obligatoriedad, hay que barrer también el exportador canónico y los mensajes de faltantes.** Si el JSON de headers sigue sin `Tipo de Documento*` o `Email Personal*`, el ERP vuelve a exportar una ficha distinta a la que exige para completar contratación.

## 182. Ante un problema de acceso, primero confirma el rol esperado del usuario antes de ensanchar la matriz de permisos

- **No basta con ver que un rol hermano sí tiene el módulo que falta.** Si el usuario está mal clasificado en `user_roles`, ampliar `role_module_access` para todo el rol equivocado introduce sobrepermisos y corrige el síntoma, no la causa raíz.
- **La regla correcta es auditar la cadena completa y separar dos preguntas:** qué rol tiene hoy el usuario (`profiles -> user_roles`) y qué rol debería tener según la operación real. Solo después se decide si el fix está en la asignación individual o en la matriz global.
- **Cuando el usuario corrige explícitamente el rol esperado, la reparación enterprise debe revertir cualquier sobreacceso transitorio introducido durante la investigación.** En un ERP auditado, el historial puede contener una migración intermedia, pero el estado final debe volver a representar exactamente la intención de negocio.

## 183. Si un selector de contratación usa un catálogo ERP estático, no asumas que nuevos cargos de BUK aparecerán solos

- **Que un cargo exista en BUK o en la operación no significa que el formulario de contratación lo reciba automáticamente.** Si `fetchHiringCatalogs()` lee `public.job_positions`, el source of truth de ese selector es el catálogo versionado del ERP, no `employees.raw_payload`.
- **La regla correcta es auditar primero el contrato de lectura antes de tocar la UI.** Si el cargo falta en `job_positions`, el fix enterprise es cargarlo ahí con migración idempotente; cambiar el select o inventar lecturas paralelas desde BUK solo rompe el diseño modular.
- **También hay que distinguir catálogo de dotación activa.** Un cargo válido para contratar puede no existir hoy en `employees`, y aun así debe estar disponible si el negocio lo requiere; por eso el catálogo de contratación no debe depender implícitamente de la nómina viva salvo que ese contrato se haya definido explícitamente.

## 180. Si una RPC crítica se recompila en una migración posterior, debe arrastrar explícitamente todas las etapas ya vigentes del pipeline

- **En un ERP versionado, una etapa nueva no queda “asegurada” solo porque exista en frontend, constraints o dashboards.** Si una migración posterior vuelve a crear la función operativa y omite esa etapa en sus validaciones, el sistema queda partido: la UI ofrece una acción válida, la base acepta el estado, pero la RPC la rechaza con error genérico.
- **La regla correcta es consolidar cada `create or replace function` crítico sobre la versión más reciente del contrato, no sobre una copia parcial anterior.** Antes de publicar una recompilación de `advance_recruitment_candidate_stage(...)`, hay que barrer whitelist de etapas, transiciones permitidas, validaciones por etapa y side effects terminales para asegurar que ningún comportamiento vigente se pierda por omisión.
- **Cuando el síntoma productivo es `P0001` sobre una etapa visible, la primera auditoría debe comparar la última migración que recompiló la RPC contra la última migración que introdujo la etapa.** Ese diff suele mostrar rápido el drift real y evita tocar frontend o permisos donde no está la causa raíz.

## 175. Un selector operativo no debe ofrecer entidades que el backend ya sabe que son inviables para el contexto activo

## 178. Si el trabajador existe pero falta el mapping operativo primario, el backend debe degradar el contexto; no anular toda la operación

- **Una ausencia de mapping contractual no significa que el trabajador haya dejado de existir ni que toda la solicitud sea inválida.** Si BUK entrega al trabajador activo, su cargo permitido y su identidad contractual, pero el área primaria no está catalogada como `is_operational + is_one_to_one`, bloquear `worker_context`, preview y elegibilidad completa convierte un problema de catálogo en una caída de negocio.
- **La regla correcta es separar reconocimiento del trabajador y resolución del contrato operativo.** Primero se resuelve el trabajador base; luego, si existe mapping operativo propio, se usa y se restringe el selector a esas opciones reales. Solo cuando no existe ninguna opción mapeada se degrada al catálogo vivo de contratos para que la operación siga teniendo una salida controlada.
- **No mezcles el catálogo completo cuando sí existe contexto propio del trabajador.** Ofrecer todos los contratos del ERP a un trabajador ya mapeado reintroduce incoherencia de selección, puede heredar contratos ajenos entre cambios de trabajador y hace parecer “faltantes” incentivos que en realidad se están evaluando contra un contrato incorrecto.

- **Mostrar tipos de incentivo activos pero sin regla aplicable para el trabajador, contrato o fecha obliga al usuario a descubrir la invalidez recién en preview o submit.** Eso degrada la operación y convierte una incompatibilidad determinística en ensayo y error.
- **La regla correcta es resolver elegibilidad contextualmente en backend y usar ese contrato para poblar el dropdown.** Si la misma lógica canónica ya existe en `resolve_hr_incentive_rate_rule(...)`, el selector debe consumir una RPC derivada de esa verdad, no reconstruir filtros locales con catálogos parciales.
- **Cuando la elegibilidad depende de contexto operativo, el estado vacío debe explicarse con semántica de negocio.** “No hay incentivos con regla activa para este trabajador, contrato y fecha” es contrato operativo; un dropdown genérico vacío no lo es.

## 176. Si un diseño depende de datos sensibles de un integrador, primero valida el payload vivo y recién después decides el motor de negocio

## 179. En integraciones HR, no asumas que el sueldo base llegará bajo la misma clave semántica que usó el diseño original

- **Que el modelo hable de `base_salary` no significa que el payload vivo de BUK use esa misma clave.** En los trabajadores auditados de Incentivos, la jornada llegaba correctamente y el sueldo también existía, pero bajo `current_job.base_wage`; como el extractor solo leía `base_salary`, el sistema concluía erróneamente que no podía calcular hora extra.
- **La regla correcta es diseñar extractores defensivos y orientados al payload real.** Si una estrategia crítica como `buk_overtime` depende de un dato externo, el helper debe absorber las variantes efectivas del integrador (`base_salary`, `base_wage`, ramas `contract/current_job/compensation`) antes de degradar la operación.
- **Cuando un incentivo desaparece pese a tener regla global válida, revisa siempre la última condición de resolubilidad.** En tipos `per_hour`, la exclusión puede no venir del match de regla sino de que el motor horario haya marcado `can_resolve = false` por un extractor incompleto.

- **No basta con que un documento técnico diga que BUK “provee” `base_salary` o campos equivalentes.** En el proyecto real, la sync actual puede traer la jornada (`weekly_hours`) pero no el sueldo base por permisos del token o por shape efectivo del endpoint.
- **La regla correcta es auditar el payload remoto antes de acoplar la lógica de negocio a ese dato.** Si el salario no está hoy en `raw_payload`, el contrato enterprise debe contemplar una degradación explícita y versionada, no romper la operación ni inventar heurísticas silenciosas.
- **Cuando un motor nuevo sustituye una regla viva, conserva siempre un respaldo canónico.** En incentivos por hora, el cálculo automático desde BUK puede convivir con fallback salarial versionado y con el `rate_rule_amount` directo como última línea de continuidad para no degradar el ERP mientras la integración madura.

## 177. Si un tipo ya resuelve su monto manualmente, su elegibilidad no puede seguir naciendo desde una regla monetaria obligatoria

- **Un tipo con `allows_manual_amount = true` no debe desaparecer del selector solo porque no exista una fila en `hr_incentive_rate_rules`.** Esa dependencia recrea el mismo bucle que el módulo ya había corregido en preview/create: para usar el tipo te piden una regla, y para la regla te obligan a definir un monto que justamente querías ingresar manualmente al registrar.
- **La regla correcta es separar “capacidad elegible” de “monto automático disponible”.** La RPC de elegibilidad debe incluir explícitamente los tipos manuales activos aunque no exista regla; la regla, si existe, solo agrega contexto o fallback, no la existencia misma del tipo.
- **Una regla vacía para un tipo manual no equivale a monto cero válido.** Si se permite registrar una regla sin monto para conservar contexto contractual, el backend debe tratar ese `0` como ausencia de monto automático y seguir exigiendo monto manual al registrar, en vez de aprobar silenciosamente una solicitud en cero.

## 174. Si una capacidad base resuelve el dato final, no puede seguir bloqueada por un fallback opcional de otra capa

- **Permitir “monto manual” en el tipo de incentivo pero seguir exigiendo una regla activa antes de aceptar ese monto rompe el contrato semántico del módulo.** El sistema dice que el monto manual es fuente válida, pero en ejecución sigue subordinándolo a una regla que ya no es necesaria para ese caso.
- **La regla correcta es separar metadata de tipo y resolución de regla.** Primero se resuelve el tipo activo y sus políticas (`requires_replacement`, `requires_rest_day`, `calculation_basis`, `allows_manual_amount`); recién después se intenta resolver una regla solo si el caso realmente la necesita.
- **Cuando no existe regla y el tipo permite resolución manual, el preview debe degradar de forma explícita, no simular una regla vacía.** La UI debe mostrar “sin regla requerida” o pedir monto manual; nunca inventar un `0` como si fuese una regla válida.

## 173. Si un incentivo permite override manual, el origen del monto debe quedar como contrato explícito y no como inferencia

- **No basta con aceptar un número editable en frontend.** Si el ERP ya usa `calculated_amount` en aprobaciones, historial, exportación y analítica, un override manual sin `amount_source` y `manual_amount` degrada trazabilidad y obliga a inferir después algo que el sistema sí sabía al momento de registrar.
- **La regla correcta es mantener un monto canónico y dos metadatos de auditoría.** `calculated_amount` sigue siendo la cifra operativa final; `amount_source` declara si vino de regla o ingreso manual; `manual_amount` conserva el valor digitado cuando aplica.
- **La autorización del monto manual debe nacer en la configuración base del tipo de incentivo y validarse en backend en preview y create.** Si solo se oculta o muestra un campo en UI, el contrato queda frágil y cualquier cliente alternativo podría saltarse la restricción.

## 156. La bandeja de tareas debe validar la etapa viva, no solo confiar en filas `pending`

## 167. Una matriz enterprise con submódulos no cabe en `role_module_access`; necesita una capa formal de features

- **Si un Excel distingue “módulo” de “submódulo”, intentar resolverlo solo con módulos o capabilities heredadas termina mezclando semánticas distintas.** Un mismo módulo puede requerir lectura ejecutiva, operación parcial y administración avanzada sin que eso signifique acceso total.
- **La regla correcta es separar permisos gruesos y finos.** `role_module_access` gobierna la entrada al módulo; `app_features` y `role_feature_access` gobiernan tabs, subflujos y mutaciones sensibles dentro del módulo.
- **La autenticación efectiva debe exponer ambas capas en el mismo payload.** Si frontend solo recibe módulos, termina reconstruyendo permisos con heurísticas (`candidate_control_access`, roles hardcodeados, tabs “ocultos”) y el contrato se vuelve frágil.

## 168. Una sync masiva no debe depender de un `upsert` monolítico por página cuando el payload crece día a día

- **Que una página de 100 filas haya funcionado ayer no garantiza que siga entrando dentro del `statement_timeout` mañana.** En tablas con `raw_payload`, índices y snapshot diario acumulado, el costo real del `upsert` sube con el volumen histórico aunque el page size del origen no cambie.
- **La regla correcta es particionar la persistencia y reintentar por chunk.** Si el worker sincroniza páginas grandes desde BUK, debe trocear la escritura en lotes más pequeños y aplicar retry sobre cada tramo crítico, no solo sobre una de las dos tablas destino.
- **El mismo script debe resolver variables fallback con semántica de “primer valor no vacío”.** Si el workflow valida una URL usable pero el runtime sigue usando `??`, se reintroduce un fallo viejo justo en una automatización sensible.

## 169. Si el ERP ya tiene un lookup de trabajadores compartido, no abras una variante local para otro módulo

- **Un selector artesanal puede “funcionar”, pero rompe tres contratos a la vez: performance, consistencia visual y semántica de resultados.** Operaciones quedó más lento y mostraba menos contexto porque rehízo búsqueda, debounce, popover y render de opciones por fuera de `WorkerLookupField`.
- **La regla correcta es extender el componente compartido cuando falte contexto, no clonarlo localmente.** Si una búsqueda necesita fecha de servicio, contrato u otro parámetro, el patrón reusable debe absorber ese `searchContext` y seguir resolviendo `React Query`, focus/blur y layout desde un solo lugar.
- **En un ERP modular, la igualdad visual también es contrato funcional.** Nombre, identidad secundaria, línea terciaria, alturas y estados del lookup deben verse iguales entre Jornadas, Incentivos, Movilidad y Operaciones para no degradar la operación ni duplicar deuda de mantenimiento.

## 170. Un search enterprise no debe montarse sobre una vista ya deduplicada si luego el mismo módulo vuelve a deduplicar

- **Buscar sobre `employees_active_current` puede parecer cómodo, pero si la RPC vuelve a aplicar `row_number()`, ranking y orden propio, el costo explota y los índices útiles dejan de participar temprano.** En Operaciones eso empujó una búsqueda simple a varios segundos aun con pocos miles de empleados.
- **La regla correcta es reutilizar el patrón base indexado sobre `public.employees` con `is_active = true`.** Primero se filtra con los índices trigram/prefix/documento, luego se deduplica una sola vez, y recién después se cruza contexto adicional como roster, acreditación o locks.
- **Cuando una búsqueda necesita enriquecimiento por fila, ese enriquecimiento debe ocurrir después del `limit` siempre que el ranking principal ya esté resuelto.** Resolver roster o contexto lateral antes del recorte final es trabajo caro que el usuario nunca verá.

## 171. Si dos controles superiores representan el mismo lenguaje visual, ambos deben compartir también `appearance` y no solo altura/borde

- **En `select` nativos, igualar `min-height`, borde y fondo no basta si uno conserva `appearance` del navegador y el otro no.** El resultado parece “casi” correcto en código, pero visualmente rompe el bloque con un control más pequeño y una flecha distinta.
- **La regla correcta es cerrar el contrato del control completo.** Si fecha/turno/contrato son parte del mismo grupo operativo, deben compartir altura, padding, radio, tipografía y también `appearance`, iconografía y espaciado de flecha.

## 172. Un bloqueo de negocio no debe caer por la rama visual de error genérico si el módulo ya tiene alerta semántica propia

- **Cuando una validación operacional bloquea el flujo, mostrarla como texto rojo suelto degrada jerarquía y hace parecer la pantalla rota en vez de controlada.** El usuario necesita ver un estado de negocio explícito, no una línea perdida debajo del resumen.
- **La regla correcta es reutilizar el mismo componente de alerta del módulo para todas las ramas equivalentes de bloqueo.** Si `previewQuery.data` y `previewQuery.isError` pueden comunicar el mismo tipo de impedimento operativo, ambas salidas deben converger al mismo tratamiento visual, iconografía y copy.

## 161. Un módulo enterprise no puede quedar con dos contratos de acceso distintos entre su capa viva y su capa legacy

## 164. Una carga masiva de jornadas no se valida por conteo bruto; se valida por identidad estable y conciliación versionada

## 166. Una Edge Function operativa no debe aceptar ejecuciones interactivas abiertas sobre una cola compartida

- **Autenticar no basta si el request todavía puede reclamar trabajo ajeno o toda la cola.** En jobs como sync BUK o purga documental, una invocación desde UI debe venir acotada a `jobIds` o `candidateIds` concretos y esos IDs deben validarse contra el ámbito real del usuario antes de hacer `claim`.
- **La regla correcta es separar dos modos de ejecución.** El barrido global o masivo queda reservado al webhook interno; la ejecución interactiva solo procesa targets explícitos y autorizados.
- **Cuando el helper de autorización recibe un `user_id` explícito, su exposición debe ser cero.** Si la función existe solo para service-role o runtime interno, se revoca a `public/anon/authenticated` para no abrir una vía de impersonación lógica.

## 165. Un lookup controlado no debe resincronizar el texto por cada render del padre

- **Si el input mantiene un `searchValue` local y además lo resincronizas desde `selectedWorker` con dependencias inestables, el usuario pierde el control del campo.** Basta con pasar callbacks inline como `getWorkerFullName` o `getWorkerId` para que el efecto se dispare en cada render y pise lo recién escrito.
- **La regla correcta es sincronizar el texto sólo cuando cambia realmente la selección externa.** Usa una identidad estable del trabajador seleccionado para distinguir “nuevo seleccionado” de “simple rerender del padre”.
- **Cuando el usuario vuelve a escribir sobre un trabajador ya seleccionado, primero hay que soltar esa selección.** Si no, el lookup mezcla búsqueda libre con detalle activo y termina reseteando el campo o dejando un contexto visual incoherente.

- **Que el Excel y la dotación activa tengan el mismo número de filas no prueba que representen al mismo universo.** En DRT ambos lados tenían `177`, pero el cruce real por `RUT` dejó `175` matches válidos, `2` trabajadores históricos ya fuera de nómina y `2` trabajadores nuevos no presentes en el archivo base.
- **La regla correcta es reconciliar primero por identificador estable y dejar esa conciliación versionada.** Antes de insertar en `hr_worker_rosters`, el repo debe guardar el origen normalizado y un reporte explícito de `matched / missing / extra`, para que auditoría y operación sepan exactamente qué quedó cargado y qué quedó fuera.
- **Nunca inventes la pauta de un trabajador sin match canónico ni borres a ciegas a un activo nuevo ausente del archivo.** Si el input no representa a la dotación viva 1:1, la carga debe aplicar sólo el subconjunto conciliado y dejar evidencia de las divergencias para seguimiento operacional.

- **Dos queries React con payload distinto no pueden compartir la misma clave de caché.** Si una devuelve lista simple y otra página con `items/totalCount`, React Query puede reciclar la forma equivocada y producir estados incoherentes o trabajo extra de refetch.
- **La regla correcta es versionar la semántica en la propia key.** Usa sufijos explícitos como `list/page`, `summary/detail` o equivalentes para que cada contrato cacheado sea único.
- **En vistas ERP pesadas, volver a enfocar la pestaña no debe disparar otra ráfaga completa de queries si ya existe polling o invalidación dirigida.** `refetchOnWindowFocus` y `refetchOnReconnect` deben quedar desactivados cuando sólo agregan presión y no mejoran la frescura útil del dato.

- **Si una reimplementación canónica ya migró a un `module_code` nuevo, la superficie legacy no debe seguir autorizándose con un módulo o rol distinto.** Aunque hoy no tenga consumidores visibles en React, esa capa sigue siendo parte del backend productivo mientras sus RPCs y tablas existan.
- **La regla correcta es encapsular tanto la capa nueva como la legacy detrás del mismo helper semántico.** En onboarding operacional, toda entrada debe pasar por `user_can_access_operational_onboarding(...)` para que frontend, RLS, storage y RPCs compartan la misma verdad de acceso.
- **`app_modules.route` también es contrato y debe reflejar la ruta real protegida por el router.** Aunque hoy `get_my_effective_permissions()` entregue solo códigos, dejar una ruta distinta en catálogo crea deriva silenciosa para futuras pantallas, auditorías o automatizaciones que sí lean esa metadata.

## 162. Un alias de compatibilidad no debe seguir figurando como ruta oficial del módulo

- **Si el router conserva un path viejo solo para redirigir, ese alias no debe quedarse en `app_modules.route` como si fuera la superficie vigente.** En el corto plazo parece inocuo; en el mediano plazo contamina navegación dinámica, auditorías y cualquier automatización que use el catálogo como source of truth.
- **La regla correcta es registrar en SQL la ruta canónica y dejar los aliases solo en el router.** Los redirects legacy cumplen compatibilidad; el catálogo de módulos debe apuntar siempre al destino oficial actual del ERP.

## 163. Si un workflow valida un fallback de variables, el script que ejecuta debe resolverlas con la misma semántica

- **No mezcles “variable definida” con “variable usable”.** En GitHub Actions una env puede existir como string vacío; si el workflow la trata como fallback inválido pero el script la toma por `??`, ambos contratos divergen y el job falla antes de llegar a la lógica real.
- **La regla correcta es seleccionar la primera variable no vacía en ambos lados.** Si el paso bash usa expansión por contenido para `SUPABASE_URL / VITE_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL`, el script Node debe usar exactamente el mismo criterio, no nullish coalescing.
- **Las variables explícitas del proceso deben ganar sobre `.env.local`.** En automatizaciones o reproducciones controladas, un archivo local no puede pisar lo que el entorno ya definió; primero se carga `.env.local` como fallback de desarrollo y luego `process.env` como fuente autoritativa.

- **Una aprobación marcada `pending` no garantiza que siga siendo trabajo vigente.** Si el request o candidato cambió de estado o avanzó de etapa y quedó una fila rezagada, el dashboard puede resucitar una tarea ya inválida aunque el backend principal haya seguido su curso.
- **La regla correcta es cruzar cada tarea contra el estado canónico del dominio.** En solicitudes y movilidad, la fila pendiente debe coincidir con `current_step_code` y con un estado activo del request; en Who, la participación del candidato debe seguir realmente en `who_pending`.
- **Las bandejas ejecutivas no deben depender de limpieza perfecta de datos históricos.** Aunque hoy no existan residuos visibles, el selector debe ser defensivo para que un rezago transaccional no vuelva a contaminar Inicio ni notificaciones.

## 157. Una cola nocturna no es segura si reclamar jobs y marcarlos `processing` ocurre en pasos separados

- **Leer jobs `pending` y luego actualizarlos en un segundo round-trip deja una ventana real de doble procesamiento.** Basta una corrida manual o superpuesta para que dos workers tomen el mismo candidato y conviertan una purga idempotente en errores falsos de storage o auditoría duplicada.
- **La regla correcta es reclamar la cola atómicamente desde SQL.** Usa `FOR UPDATE SKIP LOCKED` y cambia el estado a `processing` dentro de la misma sentencia o función antes de devolver el lote al worker.
- **No delegues la exclusión mutua a GitHub Actions ni al scheduler externo.** El contrato debe ser robusto aunque existan dos invocaciones legítimas del mismo webhook o una reejecución manual durante la ventana nocturna.

## 158. Un barrido histórico no debe depender de una muestra parcial de `candidate_documents`

- **Limitar primero `candidate_documents` y recién después cruzarlo con candidatos terminales convierte la sweep en una lotería de volumen.** Cuando crece el historial, algunos descartados con documentos remanentes pueden quedar fuera del lote aunque sí cumplan la regla de purga.
- **La regla correcta es seleccionar los targets exactos desde el dominio canónico.** Parte de `recruitment_case_candidates` en etapa `rejected/withdrawn`, exige `exists(candidate_documents ...)` y excluye jobs activos en la misma consulta SQL antes de aplicar el `limit`.
- **Los barridos nocturnos deben paginar sobre entidades de negocio, no sobre residuos.** Si el lote se recorta sobre blobs o documentos sueltos, el sistema optimiza por accidente técnico en vez de por prioridad operativa real.

## 159. Una Edge Function con efectos externos no puede quedar abierta al `anon` path ni reclamar cola en dos pasos

- **Si la function crea empleados en BUK, subir documentos o tocar integraciones externas, no basta con que el frontend normal la llame autenticado.** Mientras el runtime no valide JWT o secreto interno, cualquier invocación con la `anon key` pública del proyecto puede intentar procesar jobs pendientes.
- **La regla correcta es doble:** exigir autenticación real o webhook secreto antes de ejecutar, y reclamar la cola atómicamente con `FOR UPDATE SKIP LOCKED` en lugar de `select pending -> update processing`.
- **Las integraciones async comparten la misma lección que las colas internas.** Si el worker no protege identidad del llamador y exclusión mutua del lote, terminas mezclando riesgo de seguridad con duplicación operativa justo en el tramo más sensible del ERP.

## 160. Un retry de sync externa debe reutilizar evidencia del intento parcial para no duplicar side effects

- **Si una corrida sube algunos documentos a BUK y falla más adelante, el siguiente retry no puede reconstruir el payload como si nada hubiese pasado.** De lo contrario, vuelve a intentar subir documentos ya procesados y termina duplicando side effects en el sistema externo.
- **La regla correcta es persistir progreso parcial en el job y reutilizarlo en los reintentos.** Si `result_snapshot.documents` ya contiene `sourceDocumentId` enviados con éxito, el worker debe saltarlos en la siguiente ejecución del mismo job.
- **La idempotencia de colas externas no termina en reclamar el lote.** También hay que evitar reemitir efectos parciales exitosos cuando el job falla después de avanzar más de una etapa.

## 150. Un reingreso al mismo folio no puede resolverse con `on conflict do nothing`

- **Un retorno “exitoso” de la fila existente no equivale a reactivar al candidato.** Si la participación estaba en `rejected` o `withdrawn`, el backend debe moverla explícitamente a `lead`, resetear el estado derivado que quedó terminal y volver a sincronizar el caso.
- **La UI debe distinguir duplicado activo de participación terminal reactivable.** Bloquear ambos con el mismo mensaje condena al usuario a un falso callejón sin salida y empuja correcciones manuales en base.
- **Reactivar también implica sanear efectos colaterales del estado terminal anterior.** Aprobaciones `who_pending` pendientes, jobs de purga documental y validaciones documentales aprobadas ya no son válidos cuando el candidato vuelve al pipeline.

## 151. Cerrar un candidato también debe cerrar sus tareas Who pendientes

- **No basta con mover `recruitment_case_candidates.stage_code` a `rejected` o `withdrawn`.** Si el candidato venía de `who_pending`, una fila `candidate_stage_approvals.status = pending` seguirá alimentando bandejas y notificaciones con una tarea ya inválida.
- **La regla correcta es cancelar la aprobación pendiente dentro de la misma RPC de transición terminal.** El saneamiento debe ocurrir en la misma transacción que cambia la etapa y antes de encolar efectos diferidos como la purga documental.
- **Cuando una transición limpia trabajo pendiente, la auditoría debe registrarlo explícitamente.** Dejar el contador o señal en `metadata` evita investigaciones ciegas cuando alguien pregunta por qué una aprobación desapareció de la cola.

## 152. La UI puede guiar el motivo de descarte, pero la RPC debe exigirlo

- **No confíes en que el modal o sidebar siempre será el único llamador.** Si `advance_recruitment_candidate_stage(...)` permite `rejected` o `withdrawn` sin comentario, tarde o temprano aparecerá un cierre terminal sin causa persistida aunque la pantalla actual lo bloquee.
- **La regla correcta es duplicar el guardrail crítico en backend.** Las transiciones terminales deben fallar sin motivo tanto para proteger la auditoría como para asegurar que `rejection_reason`, `withdrawal_reason` e historial de etapas no queden vacíos.
- **Cuando recompongas una firma viva, no pierdas correcciones recientes al reescribirla.** El fix debe preservar también cancelación de aprobaciones `Who`, limpieza documental y el resto de invariantes ya endurecidos.

## 153. Un folio reabierto no puede seguir mostrando como resumen el rechazo que lo cerró

- **Elegir “la última aprobación” por timestamp no alcanza cuando el request puede cerrarse y luego reabrirse.** Un rechazo administrativo del cierre manual puede ser más nuevo que la aprobación operativa real, pero si el request volvió a `approved`, esa ya no es la señal vigente para la UI.
- **La regla correcta es condicionar el resumen al estado actual del request.** Si `hiring_requests.status = 'approved'`, el `approval_summary` debe preferir una aprobación `approved` antes que un rechazo histórico de cierre.
- **Los resúmenes SQL que alimentan varias pantallas son contrato de negocio, no solo conveniencia visual.** Si Inicio y Reclutamiento leen el mismo payload, una inconsistencia ahí se multiplica en todo el ERP.

## 154. Si corriges una señal agregada, valida también el detalle que el usuario abre desde esa lista

- **No basta con arreglar el listado principal si el sidebar o detalle sigue usando otra heurística.** El usuario interpreta ambos como la misma verdad operativa; si el resumen dice “aprobado” y el detalle dice “rechazado”, el ERP pierde credibilidad aunque ambas consultas “sean válidas” históricamente.
- **La regla correcta es alinear los selectores de estado vigente entre resumen y detalle.** Cuando el bug está en cómo eliges el evento representativo, todos los payloads hermanos que sintetizan ese evento deben revisarse juntos.
- **Los payloads de detalle también son superficie de contrato.** No son un dump histórico neutral: deben responder la misma pregunta de negocio que el listado desde el que se abren.

## 155. Los widgets de seguimiento no deben filtrar con vocabulario de estados muerto

- **Cuando el dominio cambió sus estados canónicos, cualquier filtro legacy en dashboard se vuelve una fuga silenciosa.** Excluir `approved/rejected/canceled/withdrawn` no protege contra `closed` si ese es el estado final real del flujo actual.
- **La regla correcta es positiva, no negativa.** Para bandejas de trabajo activas, lista explícitamente los estados vigentes que sí deben aparecer y amarra además el join al `current_step_code` actual cuando exista.
- **Un widget de “pendientes” no puede depender de que la ausencia de datos se infiera por descarte histórico.** Debe consultar directamente la etapa viva pendiente, o termina mostrando elementos cerrados como si siguieran en curso.

## 66. En RPCs paginadas, el orden debe sobrevivir hasta el `jsonb_agg`

- **No basta con aplicar `ORDER BY ... LIMIT/OFFSET` antes de agregar JSON**. Si luego se usa `jsonb_agg` sin un ordinal estable calculado después del ordenamiento, PostgreSQL puede devolver los items de la página en orden distinto al solicitado aunque la página seleccionada sea la correcta.
- **El patrón seguro es ordenar en una subconsulta y recién después asignar `row_number()` para el aggregate**. Toda RPC que devuelva `{items,total_count}` debe validar con una query de humo que `sort asc/desc` se refleje en el arreglo JSON final, no solo en el plan SQL intermedio.

## 133. Si el usuario pide "ejecutar un prompt", la salida debe quedar visible como artefacto versionado y no solo implicita en el diff funcional

- **No asumas que una auditoria o prompt ya "se ve" porque produjo fixes reales**. Si el usuario pide ejecutar un prompt de auditoria, el repo debe mostrar documentos o trazas explicitas de esa corrida: mapa modular, matriz de permisos, security review, smoke plan o equivalente.
- **La regla operativa es simple**: cuando el trabajo incluya diagnostico enterprise, deja evidencia navegable en `docs/` y registra el cierre en `tasks/todo.md`; si no, el usuario solo ve el efecto lateral y no la ejecucion auditable.

## 134. Si un estado operativo ya viene del motor canónico, no lo vuelvas a pedir como confirmacion manual en la UI

- **No dupliques en formulario una decision que el sistema ya resuelve desde el cruce vivo de roster/jornadas.** Esa reconfirmacion solo agrega friccion, abre contradicciones artificiales y termina obligando al usuario a “confirmar” algo que el backend ya conoce.
- **La regla correcta es derivar y persistir el dato desde la fuente canónica, y reservar la UI para mostrar el resultado y bloquear con mensajes claros cuando el negocio lo exige.** Si ademas hay prohibiciones, se presentan como alertas visibles de negocio, no como selects redundantes.

## 135. En un menu ERP denso, cualquier cambio de label debe cerrar con una verificacion explicita de ancho util para evitar filas dobles

- **Renombrar una opcion no es solo cambiar texto**. Si el submenu usa `white-space: nowrap`, el panel debe tener ancho suficiente para absorber el label mas largo sin wrap, clipping ni salto de fila visual.
- **La regla correcta es ajustar el contrato visual del dropdown junto con el copy**. Primero se cambia el label, luego se valida el ancho minimo/maximo del panel para que la navegacion siga viendose limpia y consistente.

## 136. La paginacion visible de tablas ERP debe salir del mismo lenguaje de botones que el resto del sistema

- **Un paginador no puede quedar con botones “especiales” o sin clase compartida**. Si `Anterior/Siguiente` usan otra base visual o un estilo huérfano, el usuario percibe inmediatamente que el bloque no pertenece al mismo sistema.
- **La regla correcta es doble**: usar el botón base compartido y luego aplicar una variante de paginación también compartida para relieve, hover, activo y disabled. Así cualquier tabla nueva hereda estética coherente sin rehacer CSS local.

## 137. Si una tabla frontend delega el sort al backend, las claves visibles deben mapear 1:1 al contrato RPC real

- **No basta con mostrar un encabezado clickeable**. Si la columna visible usa una key distinta a la aceptada por la RPC, el usuario percibe que “se puede ordenar”, pero la query cae al orden por defecto y la UX queda mentirosa.
- **La regla correcta es tipar y centralizar el mapping de columnas ordenables**. Cada header debe usar exactamente una clave válida del backend, y las columnas no soportadas deben quedar explícitamente fuera del sort en vez de depender de nombres parecidos.

## 138. Si el usuario pide ordenar una columna temporal, no la “simules” dejando el orden por defecto

- **`Días Abierto` no puede verse ordenable si internamente sigue cayendo a `sort_opened_at desc` como fallback fijo.** Eso da la ilusión de capacidad, pero el usuario nunca puede invertir el sentido ni confirmar que el click hizo algo real.
- **La regla correcta es habilitar la columna extremo a extremo**: header clickeable, clave válida en frontend y soporte explícito en la RPC para `asc/desc`. Si no existe soporte backend, se versiona la migración; no se maquilla el problema en la UI.

## 139. Si BUK es el destino final de documentos, la carga operativa no debe disparar la sync en caliente

- **Que Buk acepte `path` no significa que haya que subir cada archivo en el mismo click del usuario.** Si la experiencia operativa exige rapidez, los documentos se almacenan temporalmente en staging auditable, se sincronizan por cola o corte explícito, y recién después se purga el staging local.
- **Los descartes terminales deben limpiar storage por diseño, no por disciplina manual.** Si un candidato pasa a `rejected` o `withdrawn`, la eliminación de sus documentos debe quedar encolada y auditada, pero la ejecución operativa puede moverse a un barrido programado si el negocio prefiere desacoplarla del click del usuario.
- **Si el negocio fija una hora local de saneamiento, el scheduler debe hablar en hora Chile real y además barrer rezagos históricos.** No basta con procesar “lo recién rechazado”; la corrida nocturna debe revisar también candidatos terminales ya existentes con documentos remanentes y reintentar jobs fallidos.

## 140. En widgets de clima, la ubicación degradada debe seguir siendo útil y no exponer errores técnicos al usuario

- **No dependas de un solo proveedor de IP geolocation ni asumas que siempre devolverá `city` y coordenadas válidas.** Si el fallback llega incompleto, el widget puede terminar mostrando `undefined`, coordenadas inútiles o directamente un mensaje de error como label principal.
- **La salida correcta es una cadena de fallback y parsing defensivo**: reverse geocoding por coordenadas, luego IP geolocation consistente, luego ubicación por defecto. Solo se cachea una ubicación si tiene label y lat/lon válidos, y si todo falla el estado visible debe degradar con copy operacional, no con texto técnico de excepción.
- **El caché debe preservar el origen operativo de la ubicación.** Si una ubicación aproximada por IP se persiste sin marcarse como fallback, el siguiente render la puede tratar como ubicación confiable, ocultar el reintento y degradar silenciosamente la lógica de refresco.
- **En fetches encadenados por ubicación, abortar no es lo mismo que fallar.** Si una request vieja cancelada limpia el estado compartido al entrar al `catch`, el widget puede borrar un forecast válido recién cargado por la request nueva. La corrección mínima es gatear escrituras con un request id activo y salir temprano en `AbortController`.
- **Las APIs públicas de soporte en dashboard necesitan timeout local aunque ya exista abort por desmontaje.** Cambiar de ubicación o salir de la vista no cubre la lentitud del proveedor; si el negocio exige UX estable, el fetch debe autoliquidarse en un umbral razonable y degradar a “sin dato” sin dejar loaders colgados.
- **Si el padre calcula un estado operacional para la UI, el hijo debe consumirlo o el estado sobra.** Mantener `statusLabel` solo en el contenedor crea una falsa sensación de trazabilidad: la lógica existe, pero el usuario no la ve. En dashboards ejecutivos, ese drift entre cálculo y render es deuda de contrato, no solo detalle visual.

## 141. En uploads con binario primero y metadato después, tiene que existir compensación explícita

- **Subir el archivo a storage y registrar la referencia en RPC son dos commits distintos.** Si el segundo falla por permisos, validación o estado del dominio, el primero no puede quedar vivo como residuo silencioso.
- **La corrección mínima no siempre es SQL.** Cuando el contrato actual sube desde frontend a storage y luego llama una RPC, el cliente debe borrar el blob recién subido si la persistencia de base falla. Si también falla la compensación, el error visible debe decirlo explícitamente.

## 142. Si una RPC emite nuevos `action_type`, la constraint del audit log debe evolucionar en la misma pasada

- **No basta con versionar la función que inserta auditoría.** Si `recruitment_case_audit_log_action_type_check` no incluye el evento nuevo, el flujo queda aparentemente correcto en código pero falla justo al escribir trazabilidad.
- **La revisión correcta es bidireccional:** cada vez que una migración agrega `candidate_*` o `document_*` en inserts de auditoría, hay que contrastarlo contra la última constraint efectiva del audit log y extenderla en la misma serie de cambios.

## 143. En entidades compartidas entre casos, no resetees aprobaciones por cualquier update

- **`candidate_profiles` es una ficha compartida; `recruitment_case_candidates` es la participación contextual.** Si un trigger del perfil compartido invalida aprobaciones de todos los casos por cualquier cambio, el ERP castiga más de la cuenta y destruye trabajo válido.
- **La regla correcta es resetear solo por campos que gobiernan la validación que estás protegiendo.** En validación documental personal, los cambios relevantes son identidad, estado civil, nacimiento y domicilio; cambios secundarios o administrativos no deben tumbar aprobaciones documentales ya emitidas.

## 144. Si la UI exige un campo contractual para guardar o sincronizar, la aprobación documental debe exigir exactamente el mismo contrato

- **No permitas que `worker_file_complete` sea más laxo que el formulario contractual o que la cola de sincronización.** Si frontend y sync consideran obligatorio un dato como `payment_period`, pero `get_candidate_checklist(...)` no lo evalúa, el sistema puede aprobar candidatos con una ficha que el mismo ERP declaraba incompleta.
- **La regla correcta es compartir el mismo set de campos críticos entre completitud, aprobación y reset automático.** Los triggers documentales del worker file solo deben reaccionar a cambios en esos campos críticos; cualquier metadato accesorio debe quedar fuera para no destruir aprobaciones válidas.

## 145. Si la UI ya conoce la participación exacta del candidato, la auditoría backend no debe re-inferirla por joins ambiguos

- **No reconstruyas `recruitment_case_candidate_id` desde `recruitment_case_id + candidate_profile_id` cuando el flujo ya opera sobre un `caseCandidateId` concreto.** Ese join puede terminar apuntando a la participación más reciente y no a la que realmente se estaba gestionando, degradando trazabilidad justo en auditoría.
- **La regla correcta es exigir el identificador contextual en la RPC y validarlo contra el documento antes de escribir el log.** Primero se comprueba que el documento pertenezca a ese candidato en ese caso; recién después se actualiza estado y se audita con el `recruitment_case_candidate_id` exacto.

## 146. Trasladar documentos de un folio a otro sin resetear la validación deja aprobaciones fuera de contexto

- **Mover `candidate_documents.recruitment_case_id` no equivale a revalidar el nuevo folio.** Si el checklist depende del cargo o del contexto del caso destino, una aprobación documental anterior no puede sobrevivir al traslado como si siguiera siendo válida.
- **No confíes en triggers implícitos cuando el orden de updates cambia el contexto.** Si primero se mueven documentos y después la participación del candidato, el trigger documental puede no encontrar todavía la fila destino y saltarse el reset.
- **La regla correcta es resetear explícitamente la validación documental desde `transfer_candidate_to_case(...)` una vez movida la participación.** Así la aprobación queda siempre alineada con el folio vigente y no depende de coincidencias temporales entre triggers y updates.

## 147. Si endureces una RPC con nueva firma, elimina la sobrecarga vieja en la misma migración

- **No dejes conviviendo la firma legacy y la firma nueva de una misma RPC documental.** Aunque el cliente actual use la versión correcta, mantener la sobrecarga antigua crea drift operativo: schema cache ambiguo, grants duplicados y contratos muertos que pueden reaparecer por error.
- **La regla correcta es cerrar la migración con una única firma viva.** Si cambias parámetros de una RPC en Supabase/PostgREST, primero se eliminan explícitamente las firmas legacy relevantes y recién después se crea la versión final que el frontend consume.

## 148. Reemplazar un documento en base no basta si el blob anterior sigue vivo en storage

- **Un `on conflict ... do update` sobre `file_path` no limpia por sí solo el archivo viejo.** Si el frontend sube un binario nuevo y la RPC actualiza el metadato al nuevo path, el blob anterior queda huérfano aunque la operación aparente estar “correcta”.
- **La corrección mínima puede vivir en el cliente cuando la UI ya conoce el path anterior.** Si el checklist trae `file_path`, el frontend puede borrar el blob reemplazado justo después de una actualización exitosa, sin tocar RLS ni cambiar el contrato SQL.

## 149. Una purga diferida no debe confiar ciegamente en el snapshot del job

- **Que un candidato estuviera terminal al encolar la limpieza no garantiza que siga en el mismo contexto al ejecutar la tarea nocturna.** Si una corrección administrativa, migración o flujo futuro cambia el caso, el perfil o la etapa antes del barrido, borrar usando solo el snapshot del job vuelve la purga peligrosa.
- **La regla correcta es revalidar el contexto vivo justo antes de eliminar.** La Edge Function debe comprobar que `recruitment_case_candidate_id`, `recruitment_case_id`, `candidate_profile_id` y la etapa terminal actual siguen coincidiendo con el job antes de tocar storage o `candidate_documents`.

## 67. Cuando un cupo puede quedar reservado por movilidad interna, la liberación y la reapertura deben salir del mismo motor de sincronización

- **No basta con cambiar `internal_mobility_requests.status` a `rejected`**. Si esa movilidad contaba dentro de `effective_filled_vacancies`, el backend debe reejecutar la sincronización del caso/folio en la misma operación o el cupo queda liberado solo “en teoría”, pero la bandeja sigue mostrando el folio como lleno o cerrado.
- **La reapertura automática de folios cerrados debe tener una causa explícita**. Reabrir cualquier `hiring_request.status = 'closed'` apenas aparezcan vacantes reintroduce folios históricos no deseados; el gatillo correcto debe exigir una liberación real proveniente del dominio que reservaba el cupo, en este caso una `internal_mobility_request` rechazada.

## 68. Si dos funciones productivas tocan las mismas entidades padre/hija, el orden global de locks debe quedar fijado por diseño y no por accidente

- **No sirve que cada RPC sea “correcta” de forma aislada si una bloquea `recruitment_cases -> hiring_requests` y otra `hiring_requests -> recruitment_cases`**. Ese cruce crea deadlocks intermitentes que solo aparecen bajo concurrencia real.
- **La regla robusta es única para todo el dominio**: cuando un flujo de reclutamiento deba tocar ambos niveles, primero bloquea `hiring_requests` y después `recruitment_cases`. Si otra operación necesita resincronizar dos casos en una misma transacción, además debe fijar un orden determinista entre ellos para no reintroducir el problema por otra vía.

## 69. Los catálogos externos compartidos no pertenecen al hot path de una Edge Function operativa

- **No vuelvas a descargar tablas maestras de BUK en cada ejecución de una cola**. Aunque la lógica funcional sea correcta, eso agrega latencia fija, consumo innecesario de rate limit y un nuevo punto de falla por cada candidato procesado.
- **La forma enterprise es caché local con TTL y fallback stale controlado**. Primero se resuelve desde base local; solo cuando expira se refresca el catálogo externo. Si el proveedor falla pero el caché existe, el proceso debe degradar con resiliencia y no colapsar toda la corrida.

## 70. Una vista de resumen no debe convertirse en superficie operativa, y los detalles filtrados deben poder des-seleccionarse

- **Si el mismo dominio tiene una pantalla de resumen y otra de control, los botones mutables deben vivir en un solo lugar**. Duplicar acciones como `ejecutar`, `rechazar` o `cerrar` en la vista histórica rompe la separación entre seguimiento y operación, y termina creando ambigüedad sobre cuál es la superficie autorizada.
- **Cuando una tabla usa selección por click para filtrar el detalle, el comportamiento debe ser simétrico**. Si un primer click aplica el filtro, un segundo click sobre la misma fila debe retirarlo; además, la UI no debe rehidratar automáticamente la primera fila solo porque la data sigue cargada, o el usuario siente un resumen “pegado” que nunca se limpia.

## 71. Un cambio frontend que depende de una RPC nueva no está cerrado hasta confirmar schema cache remoto

- **No basta con commitear, pushear y pasar `tsc/build` si la UI llama una función nueva de Supabase**. Si la migración no se aplica al proyecto remoto, PostgREST responderá `Could not find the function ... in the schema cache` aunque el código del repo sea correcto.
- **La verificación mínima de cierre para RPCs nuevas es doble**: `supabase db push --linked --include-all` y luego `supabase migration list --linked` o una comprobación equivalente que demuestre que la versión quedó presente en remoto. Solo después de eso el cambio está realmente operativo.

## 72. Si dos filtros representan la misma dimensión operativa, la UI debe exponer uno solo y con catálogo controlado

- **No uses dos inputs distintos para `Contrato` y `Área` cuando el usuario opera ambos como el mismo scope de trabajo**. Esa duplicidad crea ambigüedad, filtros contradictorios y una semántica falsa sobre el dominio.
- **Cuando el scope es único, el filtro correcto es un desplegable respaldado por catálogo backend**. Así la UI evita texto libre inconsistente, el resumen agregado y la búsqueda usan la misma dimensión, y el nombre visible sale de una fuente operativa única.

## 1. Zero Trust y Supabase RLS

- **No confíes en el cliente para gobernar datos sensibles**. Aunque RLS en Supabase ofrece políticas a nivel de tabla, si un usuario tiene permiso `UPDATE` sobre su propio registro en la tabla `profiles`, puede inyectar modificaciones maliciosas a columnas sensibles como `is_super_admin`.
- **Solución implementada**: Triggers `BEFORE UPDATE` en PostgreSQL y uso estricto de Funciones RPC con `SECURITY DEFINER` para aislar las mutaciones de estado operativo.

## 2. Higiene de Control de Versiones

- **No comitees archivos `.DS_Store` o de cache**. Incrementan el ruido en los Pull Requests y ensucian la historia del repositorio. El `.gitignore` global debe filtrar siempre archivos `.DS_Store`, `.env.local` y los directorios `dist/` o `node_modules/`.
- **Los binarios no pertenecen a la raíz**: Archivos pesados de negocio (plantillas Excel, Word, CSV) deben vivir en un directorio segregado (`docs/templates` o `data/seed`) para no abultar la navegación del código base.

## 3. UI/UX: Single Source of Truth

- **Formateadores Compartidos**: Nunca dupliques funciones de parseo de fechas (`formatDaysSince`), moneda (`formatCurrencyValue`), etc., en distintos módulos de React. Usa un directorio compartido global, por ejemplo, `src/shared/lib/format.ts`.

## 4. Estabilidad del Contexto de Autenticación (AuthContext)

- **Fallas silenciosas en Promises**: Cuando se usan múltiples llamadas asíncronas para construir el estado inicial de la sesión (`Promise.all`), la falta de un bloque `try/catch` global puede dejar la UI atascada en un estado de carga indefinida si ocurre un fallo de red o error de BD.
- **Race conditions en Supabase Auth**: Eventos como `onAuthStateChange` pueden dispararse al mismo tiempo que el `getSession` inicial. Es crucial llevar un control (`initialLoadDone`) y configurar *safety timeouts* (ej. 10s) para forzar un escape (`setIsLoading(false)`) y no congelar la aplicación.

## 5. Arquitectura de Seguridad: Patrón "Admin Override"

- **Delegación de Autoridad**: En sistemas con RLS estricto basados en responsables de área (ej. `approver_user_id`), es indispensable incorporar mecanismos de *bypass* para administradores (`user_is_admin()`). De lo contrario, flujos críticos pueden quedar atascados en producción si el responsable original es desvinculado o la data se corrompe en el ambiente de pruebas.

## 6. Evolución ERP: Contratos de Rol y RPCs

- **Los roles del frontend deben converger con la base de datos real**. Si el dashboard o las migraciones ya operan con roles como `operaciones` o `gerencia`, `access.ts` no puede seguir descartándolos en la normalización. El contrato de roles debe mantenerse único y vigente.
- **Una RPC `SECURITY DEFINER` no es segura por existir**. Si acepta `p_user_id` u otros identificadores desde cliente, debe validar explícitamente que coincidan con `auth.uid()` o con un bypass administrativo formal. De lo contrario, nace una vía de impersonación lógica aunque la RLS de tablas esté bien.
- **No introducir motores SQL nuevos sin grants y reload explícito**. Cada bloque nuevo de RPCs debe cerrar con `grant execute` y `notify pgrst, 'reload schema'`, o el despliegue queda en estado incierto entre base y API.

## 7. ERP Operacional: Lecturas de detalle también van por RPC

- **No abrir modales operacionales con `select` directo desde el frontend** si el dato vive en tablas con RLS y relaciones sensibles. Aunque la lista cargue bien, el detalle embebido suele romperse al crecer la gobernanza o cambiar las políticas.
- **Patrón correcto**: la bandeja puede venir resumida, pero el detalle de un folio, caso o candidato debe resolverse mediante una RPC explícita que devuelva exactamente el payload que la UI necesita.

## 8. Migraciones de pipeline: primero backfill, después constraint

- **Nunca endurecer un `CHECK` de etapa antes de migrar los datos vivos**. Si una migración reemplaza estados legacy (`contacted`, `screening`, etc.) por un pipeline nuevo, el orden correcto es: soltar el constraint viejo, remapear datos, crear registros derivados y recién al final agregar el nuevo constraint.
- **La señal de falla típica es `23514` durante `ALTER TABLE ... ADD CONSTRAINT`**. No es un problema de sintaxis; es una violación creada por la propia migración al validar contra filas que todavía no han sido saneadas.
- **No asumir un solo nombre de constraint legacy**. En ambientes que crecieron por migraciones parciales o DDL inline pueden coexistir nombres como `recruitment_case_candidates_stage_code_check` y `recruitment_case_candidates_stage_check`. Antes de introducir etapas nuevas, hay que limpiar ambos.

## 9. Dashboard operativo: si una tarea nace en backend, debe verse en la bandeja

- **No basta con crear una tabla de aprobaciones nueva**. Si el flujo introduce una nueva fuente de trabajo operativo como `candidate_stage_approvals`, hay que conectarla explícitamente a las bandejas del dashboard (`Tareas Pendientes` y seguimiento global). Si no, el usuario dispara una tarea que existe en base pero queda invisible en la operación diaria.
- **La regla práctica es simple**: cualquier aprobación pendiente que pueda bloquear operación debe tener representación en Inicio y no quedar escondida solo en el detalle de otro módulo.

## 10. Who no es un comentario libre; es un resumen estructurado de causas

- **Una aprobación Who no debe modelarse como texto suelto**. Si la decisión depende de causas judiciales concretas, el backend debe guardarlas en estructura estable para que luego puedan revisarse, auditarse y mostrarse en el dashboard sin arrastrar detalles irrelevantes del folio.
- **En Inicio, la información expandida debe corresponder al tipo de tarea**. Una aprobación de folio necesita detalle contractual; una aprobación `Who` necesita el resumen de causas y observaciones. Reusar el mismo bloque expandido para ambos tipos degrada la utilidad operativa.

## 8. Dashboard ERP: La bandeja principal manda

- **La tarea operativa principal debe ocupar el ancho dominante del dashboard**. Si una tabla crítica obliga a scrollear horizontalmente mientras hay widgets secundarios arriba o al lado, la jerarquía visual está mal resuelta.
- **Eliminar widgets sin utilidad inmediata**. Si un bloque como `Actividad Reciente` no soporta una acción, decisión o seguimiento real, sale del layout principal hasta que tenga propósito operativo concreto.

## 9. Densidad operativa: mostrar solo lo que ayuda a decidir

- **No obligar scroll horizontal en la bandeja principal por mala distribución de columnas**. Primero se redistribuye el layout y se permite wrapping controlado; el scroll es último recurso.
- **En overlays operacionales, menos campos pero más relevantes**. Si un dato como el correo del solicitante no cambia la decisión y ensucia la lectura, se retira del modal visible.

## 10. Inicio del dashboard: cero ruido introductorio

- **No usar encabezados institucionales redundantes en el inicio** si no aportan contexto accionable. El dashboard debe abrir mostrando trabajo, no jerarquía interna.
- **Si un widget no participa del flujo principal del inicio, no compite por espacio**. `Alertas Operacionales` puede existir como capacidad, pero no debe desplazar la bandeja principal si no es el foco del arranque diario.

## 11. Contratos de widget: backend y tabla deben evolucionar juntos

- **No desplegar una tabla expandible nueva sobre una RPC vieja**. Si el widget espera `folio`, `requester_name`, `salary_liquid` o conteos de candidatos, la función de backend debe versionarse al mismo tiempo o la UI queda con filas vacías.
- **No aceptar migraciones intermedias con tablas o columnas imaginarias**. Si una propuesta usa `first_name`, `last_name` o `candidate_applications` pero el esquema real usa `full_name` y `recruitment_case_candidates`, esa migración no se promueve.

## 12. KPI sin uso real no entra al dashboard operativo

- **No mantener `Indicadores Clave` solo porque existe la capacidad técnica**. Si el usuario declara que hoy no le sirve, se saca del layout y se deja el motor disponible para una etapa posterior.

## 13. Pendientes no es lo mismo que folios activos

- **No mezclar aprobaciones pendientes con folios operativos activos en una misma bandeja**. Son dos dominios distintos: uno es trabajo personal pendiente de decisión; el otro es seguimiento transversal del proceso ya aprobado.
- **Si un folio cambia de etapa por una acción del usuario, debe cambiar de sección visualmente**. Aprobarlo debe sacarlo de `Tareas Pendientes` y hacerlo visible en `Folios en curso`, no quedarse en una tabla híbrida.

## 14. Jerarquía ERP: las dos bandejas operativas van antes que los atajos

- **Si una sección fue pedida como parte del flujo principal, no puede quedar debajo de widgets secundarios**. `Folios en curso` debe quedar visible junto a `Tareas Pendientes`, no después de `Acciones Rápidas`.
- **El orden visual debe seguir el orden operativo**. Primero se muestran decisiones pendientes y seguimiento activo; los atajos van después porque no son el trabajo en sí.

## 15. Bandeja de aprobación: no mostrar datos de una etapa posterior

- **Una solicitud pendiente de aprobación no debe mostrar métricas del funnel de reclutamiento**. Conteos como `candidatos activos` o `listos` solo aplican una vez que el folio fue aprobado y convertido en caso operativo.
- **Si se pide comentario al decidir, ese dato debe tener salida visible después**. Guardarlo en base sin exponerlo en una vista posterior genera fricción operacional y convierte el campo en ruido.

## 16. La trazabilidad de aprobación debe seguir viva en la etapa siguiente

- **Cuando una aprobación habilita un proceso posterior, su resumen debe viajar con el caso operativo**. En este flujo, Reclutamiento necesita ver la decisión, el actor, la fecha y el comentario directamente en `Resumen de procesos de contratación`.
- **No obligar a cruzar módulos para entender el contexto de origen**. Si el siguiente equipo depende de la aprobación para operar, la información relevante debe estar embebida en el detalle del caso.

## 17. Folios activos: medir aging, no repetir contexto ya conocido

- **En bandejas de seguimiento activo, la última columna debe privilegiar aging operacional antes que identidad redundante**. Si el solicitante ya existe en el detalle, la grilla gana más valor mostrando `Días Abierto`.
- **El aging debe calcularse desde el hito que abre el proceso real**. En este flujo, el contador parte cuando Control de Contratos aprueba y el caso se abre, no desde la creación del borrador.

## 18. Dashboard operativo: los módulos principales necesitan aire

- **Aunque la jerarquía ya sea correcta, las bandejas operativas no deben quedar pegadas visualmente**. Si `Tareas Pendientes`, `Folios en curso` y `Acciones Rápidas` se leen como un solo bloque, falta separación vertical.
- **El espaciado entre módulos principales se resuelve en el grid padre, no con parches dentro de cada widget**. Así se mantiene consistencia al crecer el dashboard.

## 19. Cuando el usuario pide mas espacio, el cambio debe ser perceptible

- **No basta con mover variables de spacing si la diferencia no se ve en pantalla**. Si el usuario marca que "sigue igual", la corrección debe pasar a una separación explícita y visible.
- **Para bloques operativos principales, es preferible un margen directo entre siblings antes que un ajuste fino imperceptible**. Primero se resuelve la percepción; después se afina.

## 20. La separación debe aplicarse con la misma regla a todos los bloques principales

- **Si solo uno de los espacios cambia visualmente, el layout sigue estando mal**. Los módulos principales deben compartir la misma clase o contrato de separación.
- **No confiar en que un selector genérico del contenedor va a afectar todos los casos por igual**. Cuando el usuario exige uniformidad, conviene etiquetar explícitamente cada bloque principal.

## 44. En grids administrativos de dos columnas, las tarjetas no deben heredar altura de la vecina

- **Si una tarjeta queda gigantesca con un formulario pegado abajo, el problema suele ser `stretch` del grid, no el campo en sí**. Para vistas de configuración, el contenedor debe usar `align-items: start`.
- **La densidad administrativa se resuelve desde layout antes que desde padding local**. Primero se evita el estiramiento estructural; después se afinan gaps y listas compactas.

## 45. Si una regla de negocio depende de un dato HR externo, se normaliza una vez y se reutiliza en todo el módulo

- **No mezclar labels libres de BUK dentro del motor de reglas**. Si `sindicato` afecta montos, primero se normaliza a un código estable y luego se usa en catálogos, contexto de trabajador, matching de reglas y trazabilidad.
- **La misma derivación debe alimentar setup, preview y registro final**. Si cada superficie infiere el estado sindical por su cuenta, el módulo termina calculando con contratos distintos para el mismo trabajador.

## 46. En funciones `RETURNS TABLE`, los nombres de salida también ocupan el scope

- **Si una RPC de Postgres devuelve columnas como `job_title`, no reutilices ese nombre sin calificar dentro del cuerpo PL/pgSQL**. Puede colisionar con columnas reales y disparar errores de ambigüedad en runtime.
- **La regla defensiva es simple**: en CTEs y joins internos, usar alias explícitos como `jt.job_title` o renombrar a `normalized_job_title` cuando el nombre coincide con la firma de salida.

## 47. Si el negocio discrimina por sindicato, el campo correcto no es un proxy binario

- **No reemplazar sindicato específico por `sí/no sindicalizado` si BUK ya trae el nombre nominal del sindicato**. Ese proxy pierde la variable real de cálculo y degrada el modelo.
- **Cuando exista un campo canónico como `current_job.union`, ese debe gobernar catálogo, matching de reglas, visualización y persistencia**. Los derivados binarios pueden quedar como apoyo, pero no como criterio principal.

## 48. En Supabase Pro, el primer salto de performance visible no es “más polling”, sino menos roundtrips y Realtime bien acotado

- **Si una vista operativa arma su payload con varias RPCs separadas, consolidarla en un bundle backend suele dar más valor inmediato que subir frecuencias de refresh**. Primero se reduce latencia estructural; después se decide el fallback.
- **Realtime debe invalidar queries críticas, no reemplazar a ciegas toda la estrategia de caché**. El patrón correcto es `Realtime + invalidateQueries + polling largo de respaldo`, no suscripciones desordenadas con refetch agresivo.

## 49. En producción, no mezclar mejoras seguras con cirugía RLS destructiva en la misma migración

- **Si una migración combina índices, grants y un RPC nuevo con `drop constraint`, `drop index` y reescritura masiva de policies, el riesgo operacional sube demasiado**. Es mejor separar una pasada segura aplicable hoy de una segunda pasada de gobernanza más delicada.
- **Cuando el conector o el entorno rechaza una migración por riesgo, la salida correcta no es forzarla**. Se degrada el alcance a cambios no destructivos y se deja trazado explícito qué quedó pendiente por revisión más controlada.

## 50. Who solo debe escalar cuando existen hallazgos reales

- **No conviertas el paso Who en aprobación obligatoria por defecto**. Si el candidato no tiene causas registradas, pedir autorización solo agrega ruido operacional y crea tareas pendientes falsas.
- **La trazabilidad no exige una bandeja pendiente**. El patrón correcto es dejar registro backend del paso Who autoaprobado sin hallazgos y reservar `candidate_stage_approvals` pendientes únicamente para casos con causas efectivas.

## 51. Si el conector de base bloquea una aplicación productiva, no se sustituye con un bypass improvisado

- **Cuando la ejecución remota falla por límite o restricción del conector, el problema ya no es SQL sino de plataforma**. En ese caso se deja la migración lista en repo, se valida localmente y se documenta el bloqueo; no se fuerza un camino lateral contra la misma base.
- **La salida correcta es separar “cambio preparado” de “cambio aplicado”**. Producción solo se considera corregida cuando la migración realmente corre en Supabase y los advisors o queries posteriores lo confirman.

## 52. Al refactorizar una RPC grande, no inventes firmas de helpers ya vivos en producción

- **En este repo, clonar bloques SQL entre migraciones sin contrastar la firma real de los helpers rompe producción aunque el `create or replace function` compile**. `user_can_view_recruitment_process_summary(...)` y `find_active_candidate_contract_lock(...)` deben llamarse con su contrato vigente, no con supuestos heredados del diff que tengas abierto.
- **La verificación mínima después de reescribir una RPC operacional no es solo `apply_migration = success`**. Hay que ejecutar la propia RPC o un query de humo sobre el bloque nuevo antes de darla por sana, porque los errores de firma o ambigüedad aparecen en runtime.

## 53. En RPCs operacionales, no referenciar columnas inexistentes “por analogía” con otras etapas

- **`recruitment_case_candidates` no tiene `documentation_completed_at` en este proyecto**. Si la bandeja necesita una fecha de preparación contractual, debe derivarse desde columnas reales como `document_validated_at`, `stage_entered_at`, `updated_at` o `hired_at`, según el dominio.
- **Un `create or replace function` exitoso no prueba compatibilidad con el esquema vivo**. PostgreSQL valida nombres de columnas al ejecutar la sentencia interna relevante; por eso una RPC grande puede publicarse bien y romper recién en la primera llamada del usuario.

## 54. Si la UI opera por meses, el horizonte futuro también debe gobernarse por mes y en backend

- **No limites solo el selector visual cuando una RPC puede seguir aceptando rangos más largos**. El tope de proyección debe vivir en la función backend y la UI solo debe reflejarlo para evitar consultas inconsistentes o bypass triviales.
- **Cuando el módulo ya depende de una vista canónica de activos como `employees_active_current`, no replique filtros de “activo/inactivo” en React**. La mejora correcta es reforzar el contrato y los mensajes de error alrededor de esa fuente única, no duplicar lógica de estado laboral en el cliente.

## 55. Las búsquedas BUK por nombre deben usar una clave simplificada estable, no depender del `full_name` textual

- **Si el negocio busca por `primer nombre + apellido`, un `LIKE` directo sobre `full_name` es insuficiente**. Obliga a conocer el segundo nombre y genera falsos “no encontrado” aunque la ficha exista y esté activa.
- **La corrección no debe duplicarse por input**. Se resuelve con una helper reusable de backend basada en campos estructurados de BUK cuando existan, con fallback defensivo desde `full_name`, y luego se alinea cualquier filtro local residual con la misma semántica.

## 56. En BUK, `first_name` no siempre es “primer nombre”; puede venir con nombres compuestos

- **No asumas que `first_name = primer nombre`**. En la data real puede llegar como `Jorge Aníbal`, por lo que reutilizarlo completo en la clave de búsqueda reintroduce exactamente el mismo problema que se intentaba corregir.
- **Para matching simplificado, el primer nombre debe reducirse al primer token antes de concatenar apellidos**. Si no, búsquedas como `jorge ara` siguen fallando aunque la helper ya use campos estructurados de BUK.

## 57. Una sync nueva contra BUK no se diseña por intuición de producto; primero se valida permiso real por endpoint

- **Que el token lea `employees` no implica que pueda leer `vacations` o `absences`**. En BUK los permisos son por módulo/endpoint, así que una integración puede estar parcialmente habilitada.
- **Si la validación devuelve `401`, no corresponde implementar una sync “a medias”**. Lo correcto es dejar tooling de validación reutilizable, documentar el permiso faltante y retomar la sync solo cuando el token tenga el alcance requerido.

## 58. Cuando una restricción de negocio es correcta pero genera fricción, primero se mejora el mensaje y no la regla

- **No relajes una validación operativa solo porque el usuario reporta confusión**. Si la restricción protege el proceso, el ajuste correcto puede ser exclusivamente de comunicación.
- **Los bloqueos relevantes deben explicarse igual en backend y frontend**. Si el preview puede fallar por excepción o por validación visible, ambos textos deben converger en la misma causa de negocio para evitar diagnósticos contradictorios.

## 59. Si un flujo aprobado cambia el calendario operativo, la mutación debe persistirse en la misma transacción de backend

- **No delegues a la UI el marcado de estados operativos derivados**. Si registrar un incentivo válido implica convertir un descanso en turno adicional, esa marca debe nacer en la RPC de creación para que historial, calendario y auditoría no diverjan.
- **Las automatizaciones de calendario no pueden pisar excepciones de mayor jerarquía**. Antes de grabar un `extra_shift`, hay que preservar vacaciones, licencias u otras excepciones activas ya registradas y dejar trazabilidad explícita del resultado.

## 60. Cuando la validación operativa debe reaccionar al seleccionar un trabajador, no se acopla al cálculo monetario

- **El estado de turno/descanso/ausencia y el cálculo del monto no tienen el mismo ciclo de carga**. Si la UI necesita alertar apenas se elige trabajador y fecha, debe consultar la pauta con una lectura dedicada y no esperar a que el usuario complete tipo, contrato o duración.
- **El preview financiero sigue siendo otra responsabilidad**. Reusar una RPC de monto para gobernar señalética operativa inmediata crea dependencia innecesaria y retrasa la validación visible.

## 61. Si una fuente prioritaria como BUK puede sobreescribir estado operativo, el diseño también debe saber restaurar

- **No basta con que BUK “gane” al escribir**. Si la ausencia oficial desaparece, el sistema debe poder reconstruir el estado manual o automático que existía antes; de lo contrario, la sync destruye trazabilidad y deja al calendario en un estado falso.
- **La forma simple y robusta es persistir el estado supersedido en la misma fila canónica** cuando el modelo solo permite una excepción activa por trabajador/fecha.

## 62. Si un incentivo depende de un trabajador reemplazado, esa validación operativa también debe vivir en backend

- **No alcanza con exigir el trabajador principal correcto**. Cuando un tipo de incentivo pide trabajador reemplazado, ese segundo trabajador también participa de la regla de negocio y debe validarse contra la pauta canónica en la misma RPC de registro.
- **La UI puede anticipar el bloqueo, pero no gobernarlo**. El patrón correcto es: consulta visual dedicada para informar el estado del reemplazado y, además, validación transaccional en `create_hr_incentive_request(...)` para impedir bypass por cliente o drift de estados.

## 63. Si una RPC pública cambia de filtros escalares a arreglos, el contrato se reemplaza completo y no por coexistencia

- **No dejes viva la firma antigua cuando PostgREST expone la función por nombre**. Mantener sobrecargas `text` y `text[]` para el mismo RPC abre ambigüedad operativa y vuelve frágil el binding desde `supabase-js`.
- **El cliente debe aceptar transición sin rehacer la UI entera**. La salida robusta es versionar la nueva firma en SQL, sanear arreglos en backend y adaptar el servicio/frontend para serializar tanto el formato singular heredado como el múltiple nuevo mientras las vistas evolucionan.

## 64. En analítica, los catálogos de filtros nunca deben depender de la tabla fact histórica

- **Los dropdowns de filtros no se llenan con `SELECT DISTINCT` sobre la tabla transaccional si existe una tabla maestra pequeña para el mismo dominio**. Ese patrón parece inofensivo al inicio, pero degrada la UX justo en la vista analítica a medida que crece el histórico.
- **La regla correcta es separar universo de análisis y universo de catálogos**. Los montos y conteos pueden leer la tabla fact; los contratos y tipos disponibles deben salir de `contracts`/`buk_contract_mappings` y `hr_incentive_types`, o de una dimensión equivalente gobernada.

## 64. Una auditoría pesada no pertenece al hot path de una bandeja operativa

- **No ejecutes validaciones globales de integridad dentro de cada RPC de lectura** si la misma comprobación ya puede correrse por trigger barato, constraint o auditoría manual. En bandejas con crecimiento mensual, eso convierte una revisión administrativa en costo fijo por cada render.
- **La regla correcta es separar invariantes de operación y auditorías profundas**. Lo que debe bloquear escritura se expresa con `CHECK`, `UNIQUE`, snapshots o validación transaccional; lo que sirve para revisión histórica se deja como función explícita de auditoría.

## 65. Si una bandeja puede superar cientos de filas, la paginación y el search server-side no son opcionales

- **No cargues el universo completo en React para luego filtrar, ordenar y expandir en memoria**. Aunque hoy el volumen parezca bajo, ese patrón se degrada rápido y duplica costo en red, CPU del navegador y Realtime invalidations.
- **La forma robusta es paginar en backend, debouncizar el input y limitar el polling a respaldo largo**. Las exportaciones masivas quedan como acción consciente y aislada; la operación diaria consume páginas acotadas y ordenadas desde SQL.

## 64. En BI, cada pestaña debe construirse con su propio universo operativo y no reciclar widgets “parecidos”

- **No reutilices el grid de otra pestaña dentro de una condición compartida solo porque comparten filtros**. Si `Reclutamiento` y `Dotación` viven bajo el mismo módulo pero responden a fuentes distintas, la condición de render debe separar explícitamente filtros compartidos de contenido específico.
- **Una métrica ejecutiva sin trazabilidad operativa es peor que una tarjeta vacía**. Si el tablero de reclutamiento debe contrastarse contra bandejas reales, las tarjetas y gráficos tienen que nacer desde esas mismas RPCs operativas (`get_recruitment_control_dashboard_v2`, `get_internal_mobility_requests`) y no desde un agregado BI derivado cuya semántica ya se desalineó del flujo vivo.

## 65. Cuando una RPC operacional se reescribe por una mejora puntual, hay que volver a contrastarla contra el esquema vivo completo

- **No basta con portar la nueva lógica del dominio si las tablas accesorias cambiaron de contrato**. En `submit_internal_mobility_request(...)`, arreglar la resolución del destino por folio no servía de nada si los inserts de aprobaciones y auditoría seguían usando columnas legacy como `request_id`.
- **Toda reescritura de una RPC productiva debe validar también los writes laterales, no solo el `select` principal**. Si la función toca snapshots, approvals, audit log o side effects como `sync_recruitment_case_status(...)`, cada bloque debe compararse contra la estructura real actual antes de publicar.

## 64. Si un catálogo one-to-one se normaliza en backend, ninguna resolución downstream puede seguir uniendo solo por `contract_number`

- **Cuando `contracts` permite múltiples filas activas para el mismo `contract_number`, cualquier RPC que resuelva destino por ese campo aislado queda ambigua**. La resolución correcta debe usar también el identificador operativo que distingue la variante real, idealmente `buk_area_name_normalized`, y solo después un fallback controlado como `cost_center_code`.
- **El frontend no debe vaciar listas operativas apoyándose en payloads auxiliares opcionales**. Si `eligible_folios` ya viene resuelto desde backend, filtrarlo otra vez contra `destinations` o catálogos secundarios reintroduce falsos “sin resultados” cuando una migración posterior deja ese payload vacío o parcial.

## 65. Si una bandeja necesita expandirse, la fila debe consumir la RPC de detalle ya auditada y no crear un resumen paralelo

- **No abras un segundo contrato de backend solo para mostrar la expansión inline si ya existe una RPC de detalle aprobada para ese dominio**. Duplicar payloads entre lista, modal y expansión hace divergir fechas, actores y labels operativos.
- **El patrón correcto es lista liviana + detalle on-demand por fila expandida**. Así la grilla se mantiene rápida, el detalle conserva la misma fuente de verdad y cualquier ajuste de auditoría ocurre una sola vez.

## 65. Si un flujo consume cupos compartidos, la reserva debe nacer en la primera etapa pendiente, no al aprobarse

- **No basta con mostrar `pending_mobility_count` como dato informativo si `available_vacancies` no lo descuenta**. En ese diseño, el sistema aparenta conocer la cola pero sigue aceptando nuevas solicitudes como si el cupo estuviera libre.
- **La regla correcta es doble**: la métrica de disponibilidad debe restar `pendientes + aprobadas`, y la aprobación final debe revalidar que la solicitud aún conserva una reserva efectiva para contener sobrecupos legacy o carreras históricas.

## 64. Una auditoría sobre `supabase/migrations` no describe por sí sola el estado vivo de producción

- **No tomes como vulnerabilidad actual cualquier policy o constraint visto en una migración antigua si existen redefiniciones posteriores del mismo objeto.** En este repositorio hay funciones, policies y constraints que fueron endurecidos varias veces; antes de corregir hay que seguir la cadena completa de `create or replace`, `drop policy`, `alter table ... drop/add constraint` y quedarte con el estado final.
- **Renombrar o reescribir migraciones históricas ya versionadas casi nunca es una corrección segura.** Si el hallazgo es de nomenclatura o de orden de hotfixes en archivos ya ejecutados, la respuesta correcta suele ser documentarlo como deuda de proceso futura, no mutar historia congelada en un sistema que ya opera.

## 123. En transiciones operativas con payload estructurado, la UI no puede filtrar silenciosamente campos incompletos

- **Si un paso como Who depende de causas tipificadas, cada fila iniciada debe terminar completa o bloquear el envío**. Filtrar en React los registros parciales y seguir adelante hace que el usuario perciba que “no pasó nada” o que el sistema decidió otra cosa sin avisar.
- **El feedback crítico debe vivir al lado de la acción**. Los mensajes de error o éxito del cambio de etapa no pueden quedar enterrados al final de un panel largo; deben verse junto al botón que ejecuta la transición.

## 124. Un trigger lateral también forma parte del contrato operativo del paso principal

- **No declares sana una RPC porque su `update/insert` principal compila o parece correcto**. Si la transición dispara triggers de correo, auditoría o colas, cualquiera de esas funciones puede romper el flujo completo en runtime aunque el núcleo de negocio esté bien.
- **Las referencias legacy suelen sobrevivir en funciones accesorias**. Cuando aparezca un error de columna inexistente tras una mutación válida, hay que revisar también los `after insert/update` asociados y no solo la función que invocó el frontend.

## 125. En contratos de permisos, no inventes nombres de columnas “semánticamente obvios”

- **Si la tabla ya normaliza capacidades por `capability_code`, no uses `capability` por intuición**. En este repositorio los joins de permisos están estandarizados sobre `role_capabilities.capability_code`, y apartarse de ese contrato rompe helpers laterales aunque la lógica de negocio sea correcta.
- **Los hotfix de funciones deben copiar también el contrato exacto de autorización**. Al reemplazar una función productiva, hay que contrastar sus joins contra la DDL real y contra helpers vigentes como `user_has_capability(...)`, no reescribirlos de memoria.

## 126. En buscadores operativos, el usuario busca por conceptos de negocio, no por columnas aisladas

- **No limites la búsqueda a las cuatro columnas visibles si el proceso se reconoce por etiquetas más amplias**. En bandejas ERP, términos como gerencia, área, CECO, folio o descriptor operativo deben resolverse desde un índice textual unificado del caso.
- **La normalización del filtro debe tolerar escritura real**. Tildes, mayúsculas y búsquedas multipartes como `zona ii` o `prevencion riesgos` deben converger en el mismo matcher para evitar falsos “no existe”.

## 127. En filtros ejecutivos, el valor técnico puede viajar oculto, pero la etiqueta visible debe ser de negocio

- **Si el backend filtra por claves como `contract_code`, la UI no debe mostrar esa clave como nombre del contrato cuando ya existe un `area_name` o label operativo humano**. El valor interno puede seguir siendo técnico, pero el usuario siempre debe ver el descriptor real del negocio.
- **La misma regla aplica a gráficos y filtros**. Si un contrato se presenta con nombre en el selector pero con código en tooltip o eje, el módulo queda inconsistente y vuelve a generar ruido operacional.

## 128. Un multiselect ERP con catálogos largos necesita acciones explícitas de masa

- **Checkboxes individuales no bastan cuando el catálogo puede ser grande**. Debe existir, como mínimo, `Seleccionar todos` y `Limpiar` visibles dentro del mismo control para soportar selección total y selección parcial sin fricción.
- **El resumen del control debe reflejar el estado real**. Si todas las opciones están activas, el campo debe decirlo explícitamente y no seguir viéndose como una selección opaca o accidental.

## 129. Una bandeja paginada o limitada nunca debe ser la fuente de un KPI ejecutivo

- **No agregues métricas de BI en React desde payloads operativos con `LIMIT`**. Una lista diseñada para renderizar 20, 60 o 200 registros puede ser correcta como bandeja y, al mismo tiempo, producir totales falsos cuando se usa como universo estadístico.
- **Los KPI deben calcularse en una RPC agregada sobre el universo completo autorizado**. La función debe aplicar el mismo scope por rol/CECO, devolver solo dimensiones y métricas necesarias, y dejar las listas detalladas para sus flujos operativos.
- **Las métricas de stock y de flujo no comparten necesariamente la misma fecha**. Un folio actualmente abierto no desaparece por haber sido creado en otro mes; el período debe aplicarse a eventos temporales cuando corresponda y no recortar silenciosamente el stock vigente.

## 129. En filtros cruzados, las opciones visibles deben depender del estado del otro filtro y sanear selecciones inválidas

- **Si contrato y cargo representan el mismo universo operativo desde dos ejes distintos, no pueden ofrecer combinaciones imposibles entre sí**. Cuando el usuario selecciona uno, el otro debe reducirse automáticamente a las opciones compatibles.
- **La UI debe autolimpiar selecciones que queden fuera del universo válido tras un cambio cruzado**. Dejar valores incompatibles activos genera dashboards vacíos o estados que parecen bug aunque el backend esté correcto.

## 130. Un KPI visible no debe ocupar espacio si el negocio realmente necesita un ratio más accionable

- **No mantengas una tarjeta de conteo como `Contratos Activos` si la decisión diaria depende más de un ratio como `% de ausentismo`**. En vistas ejecutivas, la prioridad la marca la utilidad operativa, no la facilidad del dato.
- **Si el numerador y denominador ya existen en el mismo payload filtrado, primero reutiliza ese contrato antes de abrir una RPC nueva**. La solución elegante es derivar el KPI compuesto desde la misma fuente auditada.

## 131. En BI operacional, la dimensión visible del filtro debe coincidir con la dimensión real del backend

- **Si el usuario elige contratos por `area_name`, el backend no puede seguir filtrando por `contract_code` interno y esperar resultados coherentes**. En BUK una misma área operativa puede agrupar múltiples códigos internos, y mezclar ambas dimensiones genera gráficos aparentemente “arbitrarios”.
- **La compatibilidad correcta es doble**: el filtro principal opera por la dimensión de negocio (`area_name` normalizado), pero las RPCs pueden aceptar además el código técnico como fallback para no romper estados legacy o transiciones parciales.

## 132. Un label operativo puede requerir una versión limpia para UI y otra cruda para matching

- **No uses el mismo string crudo de BUK para todo** si trae sufijos técnicos entre paréntesis. La UI ejecutiva necesita una versión limpia del contrato, pero el filtro y los joins pueden seguir trabajando con la variante completa o normalizada.
- **La limpieza visual debe centralizarse en una helper reusable**. Si chips, ejes, tooltips y selectores limpian el label cada uno por su cuenta, la vista vuelve a desalinearse al siguiente ajuste.

## 64. En vistas compuestas, cada submódulo debe colgar de su propio contrato de acceso

- **No reutilices una capability lateral para esconder una pestaña que en realidad responde a acceso modular distinto**. Si `Movilidad Interna` depende de `movilidad_interna`, no puede quedar secuestrada por `candidate_control_access` solo porque comparte pantalla con Reclutamiento.
- **El fallback de la vista también debe respetar esa separación**. Cuando un usuario pierde acceso a una subvista, solo se le debe expulsar de esa subvista específica; no de otra que sí tiene habilitada por rol o módulo.

## 127. En catálogos BUK, “operativo” y “seleccionable” no son sinónimos si el flujo resuelve por `contract_id`

- **No abras automáticamente todos los mappings `is_operational = true` en formularios solo porque el workbook los marque como operativos**. Si el flujo de negocio todavía selecciona y valida por `contract_id` único, los mappings `non one-to-one` siguen siendo ambiguos y deben quedar fuera de la selección hasta rediseñar ese contrato.
- **La sincronización del maestro y la elegibilidad del formulario son dos capas distintas**. Primero se alinea `buk_contract_mappings` con la fuente oficial; después se verifica que la UI ofrezca solo destinos que además pasen la validación transaccional vigente del backend.

## 128. Si el negocio trata variantes BUK como contratos distintos, la unicidad real debe resolverse creando contratos exactos, no forzando flags

- **No marques `is_one_to_one = true` a mano cuando varios mappings operativos siguen compartiendo el mismo `contract_id`**. Eso solo maquilla la ambigüedad y deja a contratación/movilidad consumiendo opciones distintas que internamente apuntan al mismo contrato.
- **La corrección robusta es `contract_number + buk_area_name -> contract_id` dedicado**. Si el esquema `contracts` permite varias filas por `contract_number` con distinto `contract_name`, cada variante operativa válida debe tener su propio contrato exacto y luego recién recalcular `is_one_to_one` desde el uso real del catálogo.

## 65. En integraciones externas, el contrato auditable no puede vivir duplicado ni sobreescribir su propio input

- **Si dos módulos suben documentos al mismo proveedor, ambos deben compartir el mismo helper de transporte y parseo**. Dejar una copia en Reclutamiento y otra en Acreditaciones facilita el drift silencioso, como ocurrió al seguir usando `/documents` después de que BUK confirmó `/employees/{id}/docs`.
- **Una cola de sincronización debe conservar por separado el payload original y el resultado del intento**. Sobrescribir `payload_snapshot` con la respuesta final destruye auditoría y vuelve imposible reconstruir qué input exacto produjo un alta o un error.

## 65. Un build silencioso no es un build colgado; la validación debe hacer observable cada fase

- **No concluyas que `vite build` se atascó solo porque deja de imprimir durante `transforming...`**. En este repo el build puede entrar en una fase corta pero silenciosa y aun así cerrar bien segundos después.
- **La salida robusta es un runner explícito por fases**. Separar `tsc` y `vite`, con timestamps y timeout real por etapa, elimina la ambigüedad y vuelve auditable el estado del pipeline frontend.

## 66. Cuando un proceso gana una subetapa operativa, el estado visible del historial también debe consolidar ese cierre

- **No basta con agregar `hr_execution_status` como columna auxiliar si el usuario final sigue leyendo el proceso por una sola etiqueta de estado.** Si RRHH cierra una movilidad, el resumen del solicitante o gerente debe reflejar `Ejecutada`, no quedarse semánticamente en `Aprobada`.
- **El aging de una cola no puede seguir corriendo después del cierre real.** Si la vista reemplaza una columna secundaria por `Días abierta`, ese contador debe detenerse en `hr_execution_executed_at` o en `rejected_at`; de lo contrario, la tabla sigue mostrando como “abierto” algo que ya está materialmente resuelto.

## 64. En migraciones de workflow, borrar la lógica legacy implica también borrar triggers activos, no solo dejar RPCs nuevas

- **No basta con publicar la versión nueva del flujo si quedan triggers heredados escuchando la misma tabla**. Aunque el frontend invoque la RPC correcta, un trigger viejo puede reescribir estados o columnas con semántica obsoleta y romper constraints vigentes en runtime.
- **La verificación de cierre debe incluir inventario vivo de triggers y helpers críticos en la base remota**. Si un workflow reemplaza estados o transiciones, hay que confirmar que no sobrevivan funciones como `refresh_*` o `handle_*_change` ligadas al pipeline antiguo.

## 64. En refactors SQL, no cambies por intuición el tipo de identificadores heredados

- **Si un helper ya expone IDs de tablas legacy o catálogos, el tipo debe rastrearse hasta la tabla real antes de recastearlo**. En este repo, `public.buk_contract_mappings.id` es `bigint`; convertirlo a `uuid` dentro de una RPC compila, pero rompe en runtime apenas el payload devuelve valores como `79`.
- **Las optimizaciones de RPC deben validar el contrato completo con un caso real, no solo con `create or replace function`**. Un query de humo sobre la función publicada es el control mínimo para detectar estos drift de tipos antes de que el frontend quede mostrando solo campos parciales.

## 64. Un `chunk load error` no prueba por sí solo que hubo deploy

- **Los fallos de import dinámico de Vite/React (`failed to fetch dynamically imported module`, `loading chunk`, `importing a module script failed`) también ocurren por red intermitente o errores puntuales de carga, no solo por hashes viejos post-deploy**.
- **El boundary de recuperación debe ser honesto con el diagnóstico**. Puede sugerir recarga y mencionar que una actualización reciente es una posibilidad, pero no debe afirmar “hubo publicación” salvo que exista una señal más fuerte que un mensaje genérico del navegador.

## 65. En Pages con deploy automático, el shell HTML y los chunks lazy deben defenderse juntos

- **Si Cloudflare Pages publica cada push a `main`, sí existen deploys reales aunque nadie los dispare manualmente**. En una SPA con chunks hasheados, una pestaña vieja puede seguir viva mientras el servidor ya expone otro set de archivos.
- **La mitigación no es solo `lazyWithRetry`**. También hay que forzar revalidación del HTML (`_headers` con `no-cache, must-revalidate`) y mantener los `assets` como `immutable` para no mezclar shell viejo con bundles nuevos.
- **Precargar rutas visibles reduce la ventana de falla en módulos lazy críticos**. Hacer `prefetch` en `idle` y en `hover/focus` de navegación es una defensa útil cuando la app vive muchas horas abierta y los usuarios navegan por primera vez a vistas pesadas después de una publicación.

## 66. En Incentivos, el buscador y el contexto del trabajador deben compartir exactamente el mismo filtro operativo

- **No basta con que el worker search respete “cargo elegible” si luego la RPC de contexto exige además contrato activo y mapeo BUK 1:1**. Si ambas funciones no convergen, el usuario puede seleccionar un trabajador válido para el lookup pero inválido para el resto del flujo.
- **Cuando una RPC dependiente falla y deja vacíos campos críticos, la UI no puede quedar silenciosa**. Debe mostrar el error de contexto explícitamente y bloquear el avance, aunque ofrezca fallback visual mínimo como RUT o cargo ya conocidos desde el resultado de búsqueda.

## 123. Un rol compuesto no queda listo solo copiando módulos; la herencia también debe cubrir los checks legacy por nombre

- **Si el backend todavía mezcla `user_can_access_module(...)`, `user_has_capability(...)` y `user_has_role(..., 'rol')`, crear un rol nuevo solo en `app_roles` y `role_module_access` lo deja funcional a medias**. Los flujos viejos seguirán preguntando por los nombres heredados.
- **La salida robusta es centralizar la compatibilidad en la capa de autorización**. Si un rol nuevo debe comportarse como suma de otros, la equivalencia debe vivir en un helper único como `user_has_role(...)`, no en una cascada de parches repartidos por RPC.

## 124. Cuando un módulo nace después que un rol compuesto, la herencia de acceso debe revisarse contra ese catálogo incremental

- **Copiar módulos al momento de crear un rol compuesto no garantiza cobertura futura**. Si después se registra un módulo nuevo como `bi_analytics`, ese rol no lo heredará automáticamente salvo que exista una regla explícita o una migración incremental.
- **La verificación correcta no es solo revisar `role_module_access`**. También hay que comprobar el helper vivo que gobierna la ruta o las RPCs (`user_can_access_module(...)`) sobre un usuario real del rol para evitar una falsa sensación de acceso resuelto.

## 67. Si Incentivos gobierna una marca operativa en Jornadas, ese origen debe existir como estado de primer nivel en toda la cadena

- **No conviertas en `manual` un origen automático solo porque el frontend todavía no conoce el enum nuevo**. Si backend persiste `exception_source = incentive_auto`, tipos, mappers, badges, botones y bloqueos deben alinearse con ese tercer estado o la UI rompe trazabilidad y ofrece acciones inválidas.
- **Las automatizaciones cruzadas también necesitan cierre de ciclo**. Si crear un incentivo genera `extra_shift` en calendario, cancelar o rechazar esa solicitud debe reconciliar la misma excepción en backend para no dejar sobreturnos huérfanos ni pisar excepciones manuales previas.

## 68. En dashboards con visibilidad por proceso, la capa de dotación no puede asumir que `contract_code` significa lo mismo en todas las fuentes

- **No mezcles por intuición `contracts.code`, `cost_center_code` y el `contract_code` que llega desde BUK**. En este repo, `hr_incentive_requests.selected_contract_code` sí sigue `contracts.code`, pero `employees_active_current.contract_code` quedó alineado al CECO BUK y hasta puede venir con sufijo `.0`.
- **La regla segura es validar cada agregado contra una query real del bundle antes de cerrar**. Si el widget devuelve `0` en dotación mientras reclutamiento e incentivos sí muestran datos, el problema no es de permisos sino de semántica de join entre fuentes.

## 69. Un dashboard mixto no debe derivar dotación o incentivos desde la existencia de folios de contratación

- **El scope de reclutamiento y el scope de dotación no son intercambiables**. Que un usuario pueda ver ciertos procesos en `hiring_requests` no implica que toda su población visible quede representada solo por los contratos/CECO que ya tuvieron folios.
- **Para roles amplios o gerenciales, el universo de dotación debe salir del alcance estructural del rol**. En este repo eso significa usar acceso broad por rol (`admin`, `reclutamiento`, `control_contratos`, directores) o CECO asignado en `cost_center_approvers`, y dejar el fallback basado en solicitudes solo para perfiles acotados tipo requester.

## 64. En Supabase, “aplicado” y “registrado en historial” no son la misma cosa

- **Si una migración se ejecuta manualmente en SQL Editor o mediante un conector que genera otro timestamp, el esquema puede quedar correcto pero `supabase_migrations.schema_migrations` desalineado respecto del repo**. Eso rompe auditoría, trazabilidad y cualquier intento serio de comparar local vs remoto.
- **La corrección segura no es reejecutar DDL histórico a ciegas sobre producción**. Primero se verifica que el efecto exista o haya sido absorbido por migraciones posteriores; recién después se hace backfill del historial. Si el bloque legacy mezcla timestamps duplicados o más de un esquema de versionado, se aísla como saneamiento histórico aparte.

## 65. La deuda legacy de migraciones no se arregla renombrando primero; se arregla congelando una baseline y poniendo guardias

- **Cuando producción está sana pero el árbol histórico está desordenado, la prioridad no es “dejar lindo `supabase/migrations`”**. La prioridad es impedir que el problema siga creciendo mientras se conserva capacidad de auditoría.
- **El primer paso seguro es una baseline explícita más un auditor automatizable**. Eso permite tolerar la deuda heredada conocida, detectar de inmediato cualquier migración nueva fuera del estándar y postergar la cirugía histórica real para una fase separada y controlada.

## 21. Para separación vertical uniforme, `row-gap` es más confiable que márgenes acumulados

- **Si la distancia entre siblings no se percibe igual, conviene mover la responsabilidad al layout principal**. Un `row-gap` único en el contenedor evita diferencias entre secciones grid/flex.
- **Cuando el usuario pide misma distancia para todo, la solución debe ser estructural**. No se resuelve afinando una sección; se resuelve con una regla única para todas.

## 68. Una pantalla de configuración operativa no puede depender de texto libre ni de semántica implícita

- **Si el usuario debe adivinar qué significa cada campo, el contrato está incompleto aunque el CRUD funcione**. La configuración crítica debe explicar inline qué dato pide, de dónde se alimenta y en qué tabla o regla impacta.
- **Los enums operativos no deben quedar como `TextField` salvo justificación fuerte**. Tipos como `site_type` o `category` deben salir de metadata versionada en backend para que frontend y SQL no deriven catálogos distintos.
- **La autodocumentación útil nace del mismo payload de setup**. Si React inventa hints por su cuenta y SQL evoluciona aparte, la pantalla vuelve a mentir con el tiempo. Lo correcto es exponer `field_guides` y catálogos controlados desde la RPC de configuración.

## 69. En checklists documentales de reclutamiento, “aplica” y “es obligatorio” son dos dimensiones distintas

- **Si el negocio pide que un documento se vea para todos pero solo bloquee a un subconjunto, no basta con tocar `required_*`**. También hay que abrir el `applies_to_*` del grupo adicional o el documento ni siquiera aparece en el checklist.
- **La validación correcta es contractual y no visual**. Después de migrar, hay que revisar en base que cada documento quede con `applies_to_other = true` y `required_for_other = false` cuando se pidió “opcional para otros cargos”.

## 70. Un panel lateral seleccionado desde una grilla no debe cerrarse por listeners globales si el usuario pidió toggle explícito

- **Cerrar detalle por click fuera y cerrarlo al volver a pinchar la misma fila son dos UX distintas**. Si el requerimiento es toggle explícito desde la tabla, cualquier `mousedown` global o click del contenedor rompe el contrato.
- **La forma simple y robusta es concentrar la deselección en la misma fila origen**. Si la fila ya está seleccionada, un segundo click limpia selección; cualquier otro click fuera del listado no debe mutar estado.

## 22. Evolución ERP: el estado remoto debe salir de `useState` manual

- **Cuando un módulo ya combina carga inicial, caché implícita, refresh manual y mutaciones con recarga, es señal de migrarlo a TanStack Query**.
- **El primer paso no es rehacer todo el dominio**. Conviene empezar por el dashboard, dejar `QueryClientProvider` en la raíz y luego extender el patrón a los módulos operativos.

## 66. En flujos masivos, no reutilices RPCs pesadas de lectura completa dentro del camino de escritura

- **Si una RPC pública arma payloads ricos para la UI, no debe ser la fuente interna del camino transaccional de alta**. En Incentivos, recalcular `get_hr_incentive_worker_context(...)` dentro de preview y luego otra vez en creación metía trabajo de `available_areas` que el backend de escritura no necesitaba.
- **La salida escalable es separar un helper interno mínimo y reutilizable**. Primero se resuelve el núcleo del trabajador y luego se compone el payload rico solo para la UI; las RPCs de creación/preview deben compartir el núcleo, no encadenar lecturas completas redundantes.

## 67. Un bulk administrativo no es enterprise si puede dejar éxito parcial silencioso

- **Procesar un lote fila por fila atrapando excepciones individuales simplifica la UI, pero degrada integridad operacional**. Para aprobaciones masivas, eso permite que un mismo click deje solicitudes mezcladas entre aprobadas y pendientes sin rollback global.
- **La forma robusta es bloquear el conjunto en orden determinístico y dejar que cualquier error aborte toda la transacción**. Si además existe una mutación derivada por unicidad, como `extra_shift`, debe resolverse con `upsert` atómico y no con `select + insert/update` separados.

## 23. Evolución ERP: el frontend no debe reconstruir permisos efectivos

- **Si el acceso depende de perfil, roles activos, módulos activos y bypass administrativo, el frontend no debe recomponer ese contrato con varias lecturas y reglas locales**. Esa composición debe resolverse en una RPC única basada en `auth.uid()`.
- **`access.ts` puede seguir existiendo, pero como capa de tipado y normalización, no como autoridad de negocio**. Roles y módulos efectivos deben llegar ya resueltos desde backend para evitar drift entre UI y Supabase.

## 24. Un plan externo no se implementa literal si la arquitectura ya cambio

- **Si un documento propone componentes, vistas o flujos que ya no existen en el repo, primero se aterriza el plan a la arquitectura real antes de programar**. De lo contrario, se termina creando una segunda superficie operativa sin necesidad.
- **La intención funcional se respeta, pero la implementación debe montarse sobre las piezas vigentes del sistema**. En este proyecto, eso significa priorizar `TasksWidget`, `ApprovalModal`, `HiringCandidatesView` y `CandidateDetailSidebar` antes de inventar nuevos shells.

## 25. Si un dato bloquea una aprobación, la obligación vive en backend y debe reflejarse en todas las superficies

- **No basta con deshabilitar un botón en una vista si existe otra superficie que ejecuta la misma decisión**. La regla debe imponerse en la RPC y luego reflejarse en cada UI que dispare la acción.
- **Para catálogos de negocio, guardar códigos estables y no labels visibles**. Los textos de interfaz pueden cambiar; la base debe conservar valores controlados como `travel_allowance` y `company_purchase`.

## 26. Flujos de recuperación y magic links no deben depender implícitamente del host actual

- **Si el sistema vive en múltiples ambientes, la URL pública para recuperación debe poder fijarse por entorno**. Confiar solo en `window.location.origin` es frágil cuando conviven local, preview y producción.
- **Si un correo de recuperación aterriza en `localhost`, primero revisar Supabase Auth y la URL pública configurada antes de culpar al router**. El problema suele estar en la generación del enlace, no en la pantalla `/reset-password`.

## 27. Una bandeja personal no puede heredar el bypass administrativo

- **Si una lista se presenta como trabajo pendiente del usuario, su contrato debe ser estrictamente personal**. Permitir que un admin vea ahí aprobaciones de terceros hace que una transición de etapa parezca un no-op, porque el siguiente paso del mismo folio reaparece inmediatamente.
- **El override administrativo sirve para soporte y continuidad operacional, no para contaminar bandejas diarias**. Si hace falta una vista global, debe existir como sección separada, no mezclada con `Tareas Pendientes`.

## 28. Seguimiento global y trabajo personal son dos widgets distintos

- **Si el usuario necesita visibilidad transversal de un flujo, no se resuelve relajando la bandeja personal**. Se crea una segunda vista con contrato propio y ubicación explícita en el layout.
- **Las aprobaciones en curso deben poder seguirse sin depender de que ya exista un caso operativo**. Mientras el folio no está aprobado por Control de Contratos, su lugar natural es un bloque intermedio de `Seguimiento de aprobaciones`, no `Folios en curso`.

## 29. Un campo obligatorio por etapa debe depender de `step_code`, no de un beneficio general

- **Si una regla aplica solo en una etapa del workflow, el frontend necesita conocer explícitamente esa etapa**. Inferirla desde campos laterales como `pasajes` provoca que un aprobador vea controles que no le corresponden.
- **Los selectores de negocio sensibles deben condicionarse por `step_code` y el backend debe seguir siendo la última barrera**. La UI orienta, pero la autoridad final sigue en la RPC.

## 30. Los errores operativos no se deben reemplazar por textos genéricos

- **Si una integración externa falla, la primera necesidad es ver el error real**. Cubrirlo con un mensaje fijo ralentiza el diagnóstico y obliga a adivinar entre SMTP, URLs, templates o permisos.
- **La UI puede mantener un tono limpio sin perder precisión**. Si el backend o Supabase entrega un mensaje útil, debe propagarse al menos en ambientes operativos de prueba.

## 94. En dashboards analíticos, un contrato parcialmente migrado rompe aunque compile

- **Si el frontend ya cambió de métrica o shape, la RPC agregada debe evolucionar en la misma pasada.** En `Análisis de Incentivos`, la UI ya consumía `amount_by_driver`, pero la función SQL seguía devolviendo solo `deviations_by_contract`; el resultado no era un error de TypeScript, sino tarjetas vacías o datos desalineados en runtime.
- **No reescribas la migración histórica para “corregirla” después.** Cuando el drift aparece más tarde, la salida enterprise es una nueva migración puntual que redefine la RPC y deja rastro claro del ajuste productivo.
- **Si una vista vigente sigue usando parte del contrato anterior, no la rompas por purismo.** Mientras `IncentiveAnalyticsView.tsx` todavía renderice desviaciones por contrato, el backend puede sumar `amount_by_driver` sin retirar `deviations_by_contract`; primero se corrige el desacople, después se elimina la superficie vieja en otra pasada consciente.

## 95. En analítica ERP, “quién solicita” y “quién recibe” son dimensiones distintas y no intercambiables

- **No reutilices el agrupador por costumbre cuando la pregunta de negocio cambió.** Un ranking por `requester_name` responde quién carga incentivos; un ranking por `employee_full_name` responde quién recibe dinero. Son cortes distintos y el backend debe nombrarlos distinto (`amount_by_driver` vs `amount_by_worker`) para no inducir lecturas erróneas.
- **Cuando una tarjeta deja de mostrar desvíos y pasa a mostrar dinero, el nodo JSON debe renombrarse también.** Mantener nombres legacy como `deviations_by_contract` para un gráfico monetario crea deuda semántica y vuelve frágiles tanto el frontend como futuras consultas ad hoc.
- **Las migraciones de corrección analítica deben preservar los demás nodos estables del dashboard.** Si el cambio pedido es solo en los gráficos inferiores, no se tocan KPIs, filtros o series superiores salvo que el contrato realmente lo exija.


## 55. Si una acción es sensible, el mismo permiso debe cerrarse en UI y en RPC

- **Ocultar un botón no equivale a gobernar la operación**. Si `Anular` cambia estado auditable de un incentivo, la restricción real debe vivir en la función `SECURITY DEFINER`; el frontend solo refleja ese contrato para no ofrecer acciones inválidas.
- **Las exportaciones auditables no se construyen con payloads resumidos**. Si el usuario necesita sacar XLS “con todo lo guardado”, la fuente correcta es la RPC canónica del historial ampliada con columnas persistidas, no una mezcla de detalle parcial y campos reconstruidos en React.

## 56. En exportaciones analíticas, una fecha bonita de UI sigue siendo un dato malo

- **No reutilices helpers de presentación como `formatRequestDate(...)` para XLS analítico**. Eso produce texto legible, pero no una fecha nativa de Excel; después fallan ordenamientos, filtros, pivots y fórmulas.
- **La regla correcta es separar semántica y visualización**. El exportador debe emitir objetos `Date` y recién allí aplicar formato Excel por columna (`dd-mm-yyyy` o `dd-mm-yyyy hh:mm`) según si el campo es fecha de negocio o timestamp auditable.

## 57. No abras un módulo operativo completo cuando el requerimiento real es solo una superficie analítica

- **Si un rol gerencial necesita ver dashboards pero no operar el flujo, no le des acceso global al módulo por `role_module_access` solo para que vea una pestaña**. En este repo eso habría abierto también RPCs de registro, historial y configuración porque `user_can_manage_hr_incentives(...)` depende del acceso al módulo.
- **El patrón correcto es doble capa**: autorización backend específica para la RPC analítica y autorización frontend específica para ruta/navegación/tabs, permitiendo entrar solo a la vista analítica sin elevar permisos operativos sobre el resto del módulo.

## 106. Nunca parchear permisos de módulos mediante arreglos duros en el Frontend (UI)
- **Problema:** Ocultar un botón de menú inyectando atributos `visibleForRoles` quemados en el cliente porque falta la migración SQL, rompe el único origen de la verdad (la base de datos). Un usuario con el rol alterado en el backend seguirá bloqueado (o malamente expuesto) en la UI.
- **Solución:** La autorización debe regirse estrictamente por la lista de módulos accesibles que retorna el backend (vía `get_my_effective_permissions`). Toda nueva sección debe darse de alta formalmente en `app_modules` y cruzar sus accesos en `role_module_access`, para que la navegación reacione automáticamente y de manera unificada.

## 54. Un alias sobre una RPC compartida nunca se implementa reescribiendo una variante vieja del motor

- **Si el cambio pedido es solo agregar campos al JSON, la base obligatoria es la implementación viva exacta de la RPC, no una migración parecida encontrada en el historial**. En este repo, sustituir `get_recruitment_control_dashboard_v2()` desde una variante distinta rompió `candidate_control` y `personnel_to_hire` aunque el objetivo funcional era solo exponer `salary` y `turno`.
- **La verificación correcta no termina en compilar o correr la migración**. Después de tocar una RPC operacional grande hay que contrastar el cuerpo final contra la última versión sana y ejecutar al menos una validación de humo sobre la propia bandeja afectada.

## 55. Un error de detalle no debe contaminar vistas hermanas ni esconder la causa real

- **Si una pantalla comparte varios subflujos, los errores deben estar condicionados al subflujo activo**. En `Control de Contrataciones`, un fallo al cargar `get_recruitment_case_detail` no debe seguir pintando error cuando el usuario vuelve a `Resumen de procesos`.
- **Los RPC de detalle deben propagar el mensaje real y la UI debe diferenciar “detalle no cargado” de “tablero roto”**. El mensaje genérico retrasa el diagnóstico y hace parecer que toda la página falló cuando el problema era solo el expandible.

## 58. Una nueva cola operativa no sirve si sus aprobadores no pueden entrar al módulo

- **No basta con crear la tabla de aprobaciones y la vista React**. Si la ruta está protegida por `accessible_modules`, hay que revisar al mismo tiempo `get_my_effective_permissions()` y la matriz `role_module_access`, o la cola queda viva en SQL pero invisible para quienes deben trabajarla.
- **Cuando el aprobador nace de datos operativos y no de un rol fijo**, la salida elegante no es abrir el módulo a toda la organización, sino exponerlo dinámicamente solo a usuarios con pendientes reales.

## 59. En frontend web tipado con Vite, los timers no deben depender de `NodeJS.Timeout`

- **Si un componente React corre en navegador, `NodeJS.Timeout` es un olor de tipado cruzado**. La forma estable es `ReturnType<typeof setTimeout>`, que compila tanto en browser como en entornos híbridos sin arrastrar el namespace de Node.
- **Cuando un layout usa timeouts para hover o navegación**, el cleanup debe cubrir todos los refs de timer al desmontar, no solo uno, para evitar fugas y estados colgados.

## 60. En Supabase, primero se limpia el ruido del árbol de migraciones y después se intenta reconciliar historial

- **No mezclar archivos no SQL dentro de `supabase/migrations`**. Aunque no rompan la base, contaminan `supabase migration list` y vuelven ambiguo el diagnóstico operativo.
- **Si el repo conserva migraciones legacy con formato `YYYYMMDD_HHMMSS_nombre.sql`, no las renombres en lote por prolijidad**. Antes hay que contrastar `schema_migrations` remoto, porque un rename local sin reconciliación puede empeorar el historial en vez de sanearlo.

## 61. En endpoints ERP compartidos, agregar alias es más seguro que renombrar campos ya consumidos

- **Si un payload JSON ya expone campos usados por pantallas vivas, no renombres `salary_offer` o `shift_name` solo por preferencia semántica**. La salida segura es agregar alias nuevos como `salary` o `turno` y conservar el contrato existente.
- **Antes de tocar una RPC grande, primero verifica si el dato realmente ya existe en el JSON actual**. En este caso, el problema no era ausencia de join ni de dato fuente, sino exponer nombres alternativos sin romper consumidores existentes.

## 54. En ERP con artefactos Excel heredados, no retires una librería de planillas sin mapear primero el contrato real de salida

- **Si el sistema todavía exporta `.xlsx` y `.xls`, la decisión no puede basarse solo en `npm audit`**. Antes de reemplazar una dependencia hay que verificar qué superficies leen, escriben o generan formatos legacy, porque pasar a una librería incompleta rompe operación silenciosamente.
- **Cuando la API de negocio ya está extendida en frontend y scripts, un reemplazo compatible y acotado puede ser mejor que una reescritura total**. En esta pasada, la salida correcta fue retirar `@xenova/transformers` por estar muerto y cambiar `xlsx` por un fork mantenido con contrato equivalente, manteniendo exportaciones y utilidades operativas sin abrir refactor innecesario.

## 55. La limpieza de dependencias no termina al instalar: debe cerrar con build, audit y prueba mínima del runtime reemplazado

- **Que `npm install` termine no demuestra compatibilidad real**. Si la dependencia participa en imports dinámicos o scripts fuera del bundle principal, hay que validar al menos el build de Vite/TypeScript y una ejecución de humo del paquete nuevo.
- **Los archivos de configuración también son superficie de regresión**. Al retirar una dependencia, hay que limpiar sus chunks/vendors y volver a validar la compatibilidad de `vite.config.ts`, o el ajuste queda técnicamente incompleto.

## 56. En RRHH, el contrato primario del trabajador no siempre coincide con el contrato aplicable del incentivo

- **No restringir el selector operacional al contexto laboral actual si el negocio permite imputar el incentivo a otro contrato activo**. El default debe venir del trabajador, pero el catálogo visible debe obedecer la gobernanza del ERP, no la última ficha BUK.
- **La corrección correcta va en la RPC de contexto, no en un parche del formulario**. Si `available_areas` sale recortado desde backend, el frontend solo maquilla el problema; la fuente canónica debe devolver preselección más catálogo ampliado.

## 57. En funciones `RETURNS TABLE`, no reutilices nombres de salida sin calificar en `RETURNING`

- **Si la función devuelve `folio`, `status` u otro nombre común, `insert ... returning folio` puede colisionar con la variable OUT implícita**. PostgreSQL lo interpreta como referencia ambigua aunque la tabla tenga esa columna válida.
- **La salida robusta es calificar siempre el `RETURNING` con alias de tabla o renombrar la variable de salida cuando el nombre es sensible**. En módulos ERP con folios y estados, esto no es opcional; es una medida defensiva básica.

## 58. Si un flujo ERP gana aprobaciones secuenciales, el estado visible, la bandeja y la trazabilidad deben evolucionar juntos

- **No basta con crear una tabla de aprobaciones nueva**. Si el registro pasa a depender de `Administrador de contrato -> Gerente de área`, la solicitud principal debe reflejar esa transición con estados visibles consistentes (`P`, `E`, `F`, `R`, `C`), la bandeja debe resolver al aprobador pendiente real y el historial debe conservar cada creación/decisión de etapa.
- **La aprobación masiva no se resuelve bien desde loops ciegos en frontend**. Cuando el negocio pide aprobar o rechazar muchos ítems a la vez, la gobernanza correcta va en una RPC backend que procese cada aprobación, respete permisos, registre auditoría por fila y devuelva resultados parciales por item.

## 58. En visibilidad operacional, “ser gerencia” no debe anular la propiedad del solicitante

- **Si un usuario puede crear folios y además tiene rol `gerencia`, su visibilidad como solicitante no puede quedar subordinada al amarre de centro de costo**. La propiedad del folio es una regla basal; la visibilidad por gerencia es una capacidad adicional.
- **La condición de “es el requester” debe evaluarse antes de ramas por rol**. Si se deja como excepción solo para “no gerencia”, los folios históricos o migrados quedan invisibles para sus propios dueños cuando el mapeo operativo no calza exactamente.

## 54. Si una vista compartida reutiliza el gate visual, también debe reutilizar el gate backend

- **No basta con mostrar una pestaña porque el frontend comparte un capability como `candidate_control_access`**. Si la RPC subyacente sigue validando solo `user_can_access_module('movilidad_interna')`, el usuario queda en un estado incoherente: ve la vista autorizada pero el backend la rechaza o la vacía.
- **La regla correcta en superficies ERP reutilizadas es alinear ambos contratos**. Si `Movilidad Interna` cuelga de `Personal a Contratar` dentro de `Control de Contrataciones`, la lectura backend debe aceptar exactamente ese mismo contexto operativo y la visibilidad de filas debe delegar en la helper canónica del dominio padre para evitar drift futuro.

## 55. Librerías visuales pesadas entran al ERP solo con capa compartida y carga diferida

- **No instales una librería de gráficos directo dentro de un módulo aislado**. Si el objetivo es reutilización ERP, la integración debe nacer en `src/shared` con wrapper propio, loading, empty state y API estable; de lo contrario cada módulo termina reinventando lifecycle y configuración.
- **Si una librería empuja chunks grandes, el showcase o laboratorio debe ir con `lazy()` desde el primer día**. La dependencia puede quedar instalada globalmente, pero la experiencia base de la app no debe pagar ese costo hasta que una ruta realmente necesite gráficos.

## 56. El criterio para elegir motor gráfico es ajuste al caso de uso, no solo potencia máxima

- **Si el ERP solo necesita líneas, barras y pie interactivos, una librería declarativa como Recharts suele ser mejor costo-beneficio que un motor generalista más pesado**. Menos runtime, menos capa adaptadora y menos superficie de mantenimiento.
- **La métrica correcta no es solo “qué tan potente es la librería”**. En un ERP modular, importa más cuánto pesa en bundle, cuánto código compartido exige y qué tan fácil resulta sostenerla durante años.

## 57. Un `npm audit` no se “arregla” mezclando parches seguros con downgrades peligrosos

- **Si el audit ofrece un parche compatible y acotado, se aplica**. Ejemplo: `react-router-dom` sí admitía una subida patch para cerrar un advisory moderado sin tocar arquitectura.
- **Si el audit solo propone un downgrade mayor o no tiene `fixAvailable`, no se fuerza dentro de una pasada funcional**. Casos como `@xenova/transformers` o `xlsx` deben tratarse como decisión de stack o reemplazo de librería, no como parche oportunista en medio de otra entrega.

## 31. Limpiar datos no es inventarlos

## 62. Si BUK gobierna ausencias, el bloqueo operativo debe vivir en la resolver canónica y no en un parche lateral de Incentivos

- **No supongas que un trabajador con vacaciones o licencia médica tendrá siempre una pauta activa local.** Si la ausencia viene de BUK y manda sobre el calendario, la función canónica de estado diario debe revisar excepciones aunque no exista asignación de roster, o el bloqueo se vuelve dependiente de un dato secundario.
- **Las restricciones de incentivos por ausencia no se modelan solo en frontend ni solo al guardar.** El preview backend debe rechazar el caso desde la misma fuente canónica que consume el registro final, para que alerta roja, botón deshabilitado y persistencia hablen exactamente el mismo idioma.

## 63. Si una fuente externa manda sobre excepciones operativas, el origen debe persistirse explícitamente

- **No alcanza con “saber” que BUK tiene prioridad si la tabla no guarda el origen.** Sin un campo estable como `exception_source`, cualquier upsert manual o automático termina dependiendo de la última escritura y la prioridad de negocio queda implícita, no gobernada.
- **La prioridad de BUK no se resuelve ocultando botones solamente.** Debe imponerse en las RPC de escritura: el panel manual puede seguir existiendo, pero no puede editar ni desactivar filas `source='buk'`, y la sync oficial debe poder sobreescribir manuales cuando la información difiera.

- **Una migración de saneamiento solo puede completar valores cuando existe una fuente confiable dentro del sistema**. Si un histórico carece de `travel_methodology`, solo se backfillea desde auditoría real; no se asume un default para cerrar visualmente el dato.
- **Los campos derivados de identidad deben converger al registro canónico**. Si `requester_name` y `requester_email` ya existen en `profiles`, mantener variantes como `maximiliano.contreras` solo agrega ruido operacional.

## 32. El dashboard no debe consultar lo que no renderiza

- **Cada llamada remota del inicio debe justificar su presencia en pantalla**. Si hoy no existe un widget de notificaciones, alertas o KPIs en el layout activo, no se consultan en la carga principal.
- **La limpieza de performance simple suele estar en la poda, no en la complejidad**. Antes de optimizar cachés o paralelismo, hay que eliminar fetches que no tienen consumidor.

## 33. Si una movilidad depende de un folio, el folio es la fuente de verdad de destino y cupo

- **No modelar movilidad interna con cargo, contrato o turno destino libres cuando la operación realmente depende de un caso abierto con vacantes**. Eso rompe consistencia entre aprobación, disponibilidad y seguimiento de cupos.
- **El patrón correcto es seleccionar el folio y derivar desde ese caso el resto del destino**. El backend debe volver a validar disponibilidad y visibilidad del caso al guardar, aunque el frontend ya haya autocompletado.

## 34. Los contadores operativos deben centralizar candidatos y movilidades en una sola métrica efectiva

- **Si un folio puede cerrarse tanto por contratación externa como por movilidad interna, `filled_vacancies` no puede depender solo de candidatos `hired`**. La métrica debe incorporar también movilidades aprobadas.
- **La misma regla aplica a activos**: si una movilidad en aprobación compite por el mismo cupo, debe reflejarse como volumen operativo en los resúmenes del folio. La forma estable de hacerlo es una helper única de métricas efectivas consumida por todas las RPCs del dashboard.

## 35. En RPCs de escritura, compilar no valida el camino real de inserción

- **No des por cerrada una función `create` solo porque la migración aplicó y los payloads de lectura se ven bien**. Si la función inserta en tablas existentes, todavía puede romper por columnas `NOT NULL`, defaults ausentes o joins que ya no completan el contrato esperado.
- **La validación mínima correcta es ejecutar la RPC dentro de una transacción con `ROLLBACK`**. Así afloran errores reales de escritura como ambigüedad por `RETURNS TABLE` o `destination_contract_id` nulo, sin ensuciar producción con registros de prueba.

## 33. En BUK, el cargo operativo no necesariamente vive en la columna derivada del view

- **No asumas que `employees_active_current.job_title` trae el cargo real**. En este proyecto quedó vacío para toda la dotación activa, mientras el dato correcto venía en `raw_payload.current_job.role.name` y `raw_payload.jobs[*].role.name`.
- **Si una búsqueda operativa depende de BUK, el mismo helper debe gobernar setup, search, contexto y persistencia**. Si el cargo se resuelve distinto en cada RPC, la UI queda con dropdown vacío, búsqueda rota y solicitudes guardadas con `Sin cargo`.

## 34. Los códigos de empresa no siempre coinciden entre `company_id` y el sufijo contractual BUK

- **No mezcles `company_id` con el sufijo `:000X` del contrato como si fueran la misma llave**. En este ambiente, `Servicios Industriales Minardi S.A.` usa `company_id = 3`, pero sus contratos BUK terminan en `:0002`.
- **La resolución de empresa debe contemplar equivalencias explícitas por fuente**. Una tabla o helper único debe mapear por `company_id` y por código contractual; si no, el catálogo destino queda incompleto aunque el dato exista.

## 57. Si BUK cambia de label textual a identificador numérico, el módulo no puede colapsar por una sola dimensión no resuelta

- **No bloquees todo el contexto de un trabajador solo porque la empresa no llegó como texto**. Si BUK entrega `company_id`, primero intenta resolver por catálogo, por otras filas históricas o por el área mapeada; si aun así no aparece el nombre, la UI debe cargar el resto de los datos y marcar la empresa como no resuelta.
- **Los campos derivados por lookup externo deben degradar con gracia y no endurecer `NOT NULL` antes de comprobar la fuente real**. En movilidad interna, empresa actual y `requiere finiquito` dependen de una resolución secundaria; por eso el guard correcto es seguir operando con fallback visible, no levantar excepción temprana.

## 58. En módulos con reglas parametrizadas, backend y pantalla deben exponer la misma resolución

- **No basta con que el motor calcule internamente si la UI no muestra qué regla ganó**. Cuando un monto depende de contrato, cargo o sindicato, el usuario debe ver antes de guardar el monto final y los criterios aplicados.
- **Si una familia de RPCs fue redefinida varias veces en migraciones sucesivas, se debe cerrar con una consolidación explícita**. Dejar overloads históricos en producción aumenta el riesgo de drift entre setup, preview y registro final.

## 58. Una etapa nueva en pipeline no se cierra tocando solo labels

- **Cada etapa adicional exige barrer frontend, constraints y RPCs de transición juntos**. Si agregas `En Proceso` entre `Who` y `Exámenes Médicos`, hay que actualizar unions TypeScript, filtros, labels, opciones siguientes, `CHECK` de base y validaciones de `advance_recruitment_candidate_stage(...)`.
- **Los permisos de una bandeja especializada deben seguir el caso visible, no una capability global suelta**. Dar `candidate_control_access` al aprobador Who sin acotar `user_can_view_recruitment_case(...)` o la policy de `candidate_stage_approvals` termina filtrando casos ajenos.

## 52. `npm run build` no valida Edge Functions de Supabase

- **Un build limpio de Vite/TypeScript no demuestra que una Edge Function esté lista para producción**. El frontend puede compilar perfecto mientras `supabase/functions/*` conserva errores de contrato, imports o despliegue.
- **Cada cambio relevante en ORION debe cerrarse con dos validaciones separadas**: build del frontend y despliegue o verificación explícita de la function remota. Si la segunda no ocurre, la tarea no está operativamente cerrada.

## 53. Si ORION conserva salida configurable hacia un LLM externo, el deploy puede bloquearse por política aunque el código sea correcto

- **No asumir que “terminal autenticada” equivale a “despliegue permitido”**. Cuando la function puede enviar contexto del ERP a un proveedor externo mediante secrets como `ORION_LLM_*`, el bloqueo puede venir de política de entorno y no de credenciales ni de Supabase.
- **El cierre correcto en esos casos es dejar el repo listo y separar explícitamente “implementación terminada” de “deploy autorizado”**. No se debe intentar forzar rutas indirectas para publicar la function.

## 54. En ORION con tool-calling, “sin respuesta” puede ser un bug de cierre del loop, no del proveedor

- **Si el modelo entra en `tool_calls` repetidos y el loop termina sin `message.content`, la conversación puede persistir una respuesta vacía aunque HTTP haya cerrado en `200`**. Ese síntoma no se arregla en frontend ni con otro fallback; se arregla forzando una respuesta final del modelo después de usar herramientas.
- **La regla operativa es clara**: tras ejecutar herramientas, si no existe texto final, ORION debe hacer una última llamada sin tools (`tool_choice: none`) para sintetizar el resultado sobre la evidencia ya obtenida.

## 57. Si una política bloquea el proveedor externo, la salida correcta es degradar ORION a modo seguro local

- **La autorización del usuario no invalida una política de exportación del entorno**. Si el deploy a un tercero como Groq sigue rechazado por compliance, no se insiste con workarounds; se cambia el contrato técnico.
- **El fallback correcto no es dejar ORION roto**. Se preserva persistencia, autenticación y contexto local en Supabase, pero la respuesta pasa a un modo determinístico seguro sin salir del perímetro.
- **El cliente ORION debe tolerar ambos contratos**. Si hoy responde JSON local y mañana vuelve un proveedor aprobado por SSE, `orionChat.ts` debe aceptar ambos sin romper el módulo.

## 58. Las notificaciones de workflow deben engancharse al evento backend que crea la tarea, no a una pantalla concreta

- **Si un correo depende de quién quedó responsable del siguiente paso, el disparador correcto es la inserción real de la aprobación o del caso, no la acción visual del frontend**. Así el aviso sale igual aunque mañana cambie la UI o aparezca otra superficie que ejecute la misma RPC.
- **Para evitar duplicados, la idempotencia debe vivir junto al dispatcher**. Un `event_key` único por aprobación pendiente o por apertura de caso evita reenviar correos cuando existan reintentos o llamadas repetidas del flujo.

## 59. No mezclar en producción una reversión temporal de visibilidad con un contrato nuevo sin reassert explícito

- **Si una migración intermedia quita a un rol de `role_module_access` o de una helper de visibilidad, no basta con asumir que otra RPC posterior lo corrige indirectamente**. Hay que volver a afirmar el acceso final en la base o el home y la vista dedicada pueden quedar desalineados.
- **Cuando `Inicio` y `Control de Contrataciones` muestran realidades distintas para el mismo rol, la causa raíz suele ser drift entre RPCs SQL, no React**. Primero se revisan las últimas migraciones que tocaron `role_module_access`, `user_can_view_*` y `get_recruitment_control_dashboard_v2()`.

## 60. Un “dashboard en cero” puede ser una RPC rota, no ausencia real de datos

- **Si la vista muestra contadores en `0` pero la base sí tiene casos abiertos, no asumas visibilidad incorrecta de inmediato**. Una excepción en una sección lateral de la RPC puede vaciar todo el payload útil y el frontend puede degradar a defaults.
- **En este dashboard, `candidate_control` no puede referenciar columnas inventadas del lock helper**. Si `find_active_candidate_contract_lock(...)` expone `recruitment_case_id`, volver a usar `case_id` rompe la RPC completa para sesiones con `candidate_control_access`.
- **La vista principal debe renderizar el error de query explícitamente**. Si no, un fallo backend se disfraza como “no hay folios”, que es operativamente engañoso.

## 58. Una exportación operativa masiva no puede depender del panel lateral seleccionado

- **Si RRHH necesita exportar varias personas a la vez, la fuente de datos debe resolverse por candidato seleccionado y no por el `case detail` actualmente abierto**. De lo contrario, la exportación queda limitada a un solo caso o a la última selección visual.
- **La plantilla de negocio debe vivir como contrato reutilizable, no como archivo manual oculto fuera del repo**. Si ya normalizamos headers y listas de `Empleados.xls`, la exportación debe reconstruir esa plantilla desde código para mantener trazabilidad y evitar dependencia de archivos locales ad-hoc.

## 59. Si una migración nueva aún no está aplicada, se corrige en origen y no con un parche encima

- **Cuando una capacidad nueva todavía vive solo en migraciones locales no ejecutadas en Supabase remoto, la forma correcta de estabilizarla es arreglar esa migración base**. Apilar una cuarta migración “hotfix” sobre tres archivos todavía no aplicados solo introduce ruido y drift innecesario.
- **Esto aplica especialmente a RLS, grants y `search_path`**. Si la primera versión local ya viene abierta o no idempotente, se corrige ahí antes de llevarla a producción.

## 60. En Storage y base relacional, el identificador operativo debe ser la ruta real, no el nombre visible

- **Si un documento se guarda con prefijo técnico (`timestamp_nombre.ext`), ese `storagePath` es el identificador canónico para borrar, reprocesar o sincronizar vectores**. El nombre “bonito” sin prefijo es solo presentación.
- **Cuando UI y backend se separan en ese punto, el sistema falla en silencio**. El síntoma típico es “el documento parece borrarse” o “queda procesado” pero Storage y la tabla de embeddings siguen desalineados.

## 53. Un módulo experimental no puede saltarse el contrato de acceso de la app

- **Si una funcionalidad todavía no está en producción, no basta con “no publicitarla”**. Debe quedar cerrada por visibilidad de navegación, widget y ruta, o cualquier usuario con URL directa termina entrando igual.
- **Los accesos experimentales no se hardcodean por fuera del sistema de guardas**. Si un link superior o widget global vive fuera de `navigationModules` o `RoleProtectedRoute`, hay que envolverlo explícitamente en una guarda equivalente antes de considerar el módulo controlado.

## 52. En RPCs que consumen funciones `RETURNS TABLE`, el nombre exacto de las columnas es parte del contrato productivo

- **No renombres ni inventes aliases de salida al consumir un helper tabla sin ejecutar la RPC completa contra una sesión autenticada**. Un cambio mínimo como usar `contract_lock.case_id` en vez de `contract_lock.recruitment_case_id` no degrada datos: derriba completo el dashboard en runtime.
- **La verificación correcta no es “compila la migración” sino “la RPC responde”**. Cada cambio sobre `get_recruitment_control_dashboard_v2()` o funciones similares debe cerrarse con una ejecución autenticada real del RPC, no solo con lectura estática del SQL.

## 52. Ver resumen operativo no es lo mismo que abrir el subflujo sensible

- **No mezclar permiso de seguimiento con permiso de edición documental**. Si un rol solo debe ver `Resumen de procesos de contratación`, ese contrato se expresa con una helper backend separada y no relajando `candidate_control_access`.
- **Cuando una misma página tiene superficies con distinta sensibilidad, el backend debe devolver payloads distintos según el nivel de acceso**. El resumen del caso puede abrirse a roles ejecutivos; candidatos, auditoría y documentos siguen gobernados por la capacidad específica.

## 53. La validación documental final debe ser una instancia independiente del semáforo

- **Un semáforo verde no reemplaza una aprobación trazable**. Si el negocio exige verificar datos y documentos antes de contratar, la base debe registrar explícitamente estado, aprobador, fecha y comentario de esa validación final.
- **Toda aprobación derivada de datos editables debe invalidarse sola cuando cambian sus insumos**. Si se modifica un documento o la ficha del candidato después de aprobar la revisión documental, la autorización anterior deja de ser válida y debe resetearse automáticamente.

## 57. En geolocalización productiva, fallback visual no puede significar ubicación falsa

- **Nunca uses una ciudad fija como fallback “válido” para un widget de ubicación real**. Si el navegador no entregó coordenadas confiables, mostrar `Santiago, CL` degrada el dato y genera un error operativo más grave que mostrar ausencia o aproximación.
- **La traducción de coordenadas a ciudad no debe depender de un solo proveedor externo**. Si el caso de uso es crítico para el inicio del ERP, el widget debe intentar al menos una segunda fuente o caer explícitamente a coordenadas/aproximación, no fingir una ciudad exacta.

## 58. En Safari, el timeout nativo de geolocalización no basta como contrato operativo

- **No asumas que `getCurrentPosition(..., { timeout })` va a cortar siempre cuando la app lo necesita**. En producción real, Safari puede demorarse demasiado o comportarse de forma inconsistente, dejando la UI colgada en estado de resolución.
- **Si la tarjeta del dashboard depende de geolocalización para mostrarse operativa, el frontend debe envolver esa llamada con un hard-timeout propio**. El navegador sigue intentando resolver, pero la UI no puede quedar esperando indefinidamente a un contrato externo poco confiable.

## 59. Un módulo conversacional no puede nacer con estado compartido si no persiste por usuario

- **Sin persistencia real, un widget y una vista completa solo “parecen” integrados**. Si ambos comparten contexto pero la sesión desaparece al refrescar, la etapa arquitectónica sigue incompleta para un ERP.
- **La base mínima correcta es `sessions + messages + RLS por dueño` antes de conectar IA real**. Primero se consolida trazabilidad y continuidad por usuario; después se conecta Edge Functions, streaming o modelos externos.

## 60. Un frontend que apunta a una Edge Function aún no publicada debe degradar sin romper la conversación

- **No reemplaces una respuesta operativa existente por una dependencia remota no desplegada sin plan de contingencia**. Si la función o el secret del modelo no están publicados todavía, el módulo no puede quedar en error duro.
- **La integración correcta de una IA experimental en producción es `backend real cuando existe` + `degradación explícita cuando falta infraestructura`**. Así se gana arquitectura sin introducir una regresión de uso.

## 33. Un panel seleccionable no debe reabrirse por “ayuda” del contenedor padre

- **Si la UI permite cerrar manualmente un resumen lateral, el componente padre no puede volver a autoseleccionar el primer registro al siguiente render**. Eso transforma el cierre en una ilusión y deja la vista “pegada”.
- **El criterio correcto es conservar selección solo si el registro sigue existiendo**. Si el usuario limpió la selección, se respeta hasta que vuelva a hacer click explícito en otra fila.

## 34. Los warnings operativos no deben depender de integraciones backend fuera del repo

- **Si una validación crítica del flujo vive en una Edge Function no versionada junto al código principal, el frontend queda ciego ante fallas o drift**. Para señales operativas como “este RUT ya estuvo en la empresa”, la fuente debe ser una RPC controlada dentro del mismo repositorio o una tabla sincronizada auditable.
- **Cuando existe una sync local confiable de BUK, se consulta primero esa réplica**. Así el warning sigue funcionando aunque la integración en vivo cambie, y además se pueden enriquecer mensajes con estado histórico y fecha de salida.

## 35. Un efecto de geolocalización no puede depender del mismo estado que muta durante la resolución

- **Si el `useEffect` que inicia la ubicación depende de `statusLabel`, `isResolved` o flags que la propia rutina modifica, se crean ciclos de reentrada y requests solapados**. El síntoma típico es quedarse en `Resolviendo ubicación...` o caer de forma errática a un fallback fijo.
- **La estructura estable es `effect único + refs de control + request in flight`**. La geolocalización se dispara una vez por ciclo, los reintentos se gobiernan explícitamente y el fallback solo corre cuando realmente se agotaron los intentos válidos.

## 36. Una SPA productiva no puede depender de `lazy()` sin recuperación

- **Si las rutas se cargan con `React.lazy()` puro y no existe `ErrorBoundary`, cualquier fallo de chunk o excepción al montar una página puede dejar la app completamente en blanco**. En producción esto aparece mucho después de deploys, cuando el shell antiguo intenta pedir un archivo con hash viejo.
- **El patrón mínimo aceptable es `lazyWithRetry + ErrorBoundary global`**. Primero se intenta una recarga controlada para resincronizar chunks y, si el problema persiste, se muestra una vista de recuperación en vez de matar todo el árbol React.

## 33. Un widget descartado operativamente también debe apagarse en la base

- **Si una sección ya no forma parte del dashboard real, no basta con sacarla del layout**. También hay que desactivarla en `dashboard_widgets` y limpiar preferencias huérfanas para que el catálogo no siga prometiendo piezas que el frontend ya no usa.
- **Primero se podan consumidores y luego se apaga el catálogo**. Ese orden evita romper usuarios activos mientras se limpia deuda histórica del ERP.

## 34. Un workflow nuevo no debe autorizarse preguntando por roles en React

- **Si una decisión de negocio sensible depende de una autorización específica, esa autorización debe llegar resuelta desde backend como capability efectiva**. El frontend solo consume `hasCapability(...)`; no decide si un rol “equivale” o no a permiso operativo.
- **Primero se crea la fuente de verdad (`app_capabilities`, `role_capabilities`, RPC de permisos efectivos) y recién después se monta la UI del flujo**. Saltarse ese orden termina mezclando diseño de pantalla con gobierno de seguridad.

## 57. Un RPC agregador no puede reinterpretar el contrato de retorno de sus fuentes

- **Si una función base devuelve `jsonb`, el agregador no debe tratarla luego como `setof` o tabla derivada**. Ese tipo de desalineación no degrada solo un widget: puede tumbar completo un bundle crítico como el Inicio.
- **Antes de cerrar una optimización por consolidación de RPCs, hay que probar el bundle final autenticado y no solo las funciones hijas por separado**. El error real apareció en la composición, no en `get_upcoming_birthdays(...)` aislada.

## 58. En geolocalización de navegador, un único intento de alta precisión no es un contrato operativo suficiente

- **No se debe caer a un fallback fijo de ciudad solo porque la lectura `enableHighAccuracy: true` falló o agotó tiempo**. En escritorio y Safari eso puede romper ubicaciones reales que sí son recuperables con una lectura más tolerante.
- **La secuencia correcta es degradar**: primero intento preciso, luego intento relajado, y solo después fallback fijo. Si no, el widget parece “estable” pero devuelve una ciudad falsa.

## 59. En widgets de ubicación, dos timeouts en serie también son una regresión

- **No encadenar dos llamadas `getCurrentPosition()` una detrás de la otra si la UI depende de respuesta rápida**. Aunque la lógica sea “más robusta”, el usuario solo percibe un widget colgado.
- **La estrategia operativa correcta es paralelizar una lectura rápida y una precisa**. La primera da ubicación usable pronto; la segunda puede mejorarla. El fallback fijo entra únicamente cuando ambas fallan.

## 60. Un Excel de conciliación no puede ser la fuente runtime del ERP

- **Si una matriz externa solo sirve para definir equivalencias de negocio, esa lógica debe terminar persistida en backend como catálogo curado**. Consultar `employees.area_name` libre o rehacer el match en frontend deja el sistema expuesto a drift y ambigüedad.
- **La regla práctica es 1:1 o no entra como fuente operativa**. Para selectores críticos como `Nombre de contrato` o `Área / contrato`, solo deben exponerse áreas BUK que ya estén conciliadas de forma exacta con contabilidad y versionadas dentro de Supabase.

## 60. La matriz de usuarios es una fuente de negocio; Auth y autorización no se sincronizan igual

- **No mezclar alta de cuentas con reasignación de permisos en una sola operación opaca**. Crear usuarios faltantes en Supabase Auth y sincronizar `profiles`/`user_roles` son pasos distintos y deben poder reejecutarse por separado.
- **Si la matriz de negocio usa labels humanos, primero se normaliza a códigos canónicos de la app**. Roles como `control de contratos` o `operaciones_L_1` no deben llegar crudos al frontend ni a `user_roles`; se mapean una vez a `control_contratos` y `operaciones_l_1` para evitar drift.
- **Cuando el requerimiento explícito es “no tocar claves existentes”, el aprovisionamiento debe crear solo cuentas faltantes**. Actualizar contraseñas por conveniencia rompe el contrato operativo y genera incidentes evitables.

## 61. La UI no debe adivinar permisos sensibles ni esconder estados terminales útiles

- **Si una acción sensible como cerrar un folio depende de reglas mixtas de rol y estructura operativa, el frontend no debe reconstruirlas con módulos o roles parciales**. La autorización debe resolverse en backend y viajar en el payload como una señal explícita por registro, por ejemplo `can_close_request`.
- **En PL/pgSQL, los nombres definidos en `RETURNS TABLE` también ocupan scope interno**. Si coinciden con columnas reales como `hiring_request_id`, aparecen ambigüedades difíciles de detectar después. La salida debe renombrarse o todo uso interno debe quedar completamente calificado.

## 62. Limpieza estructural de base: “sin uso hoy” no equivale a “sin contrato”

- **No se deben borrar tablas, índices o RPCs solo porque hoy tengan `0` filas o `0` usos en el advisor**. En un ERP vivo, una tabla vacía puede seguir siendo parte del contrato runtime de un módulo recién desplegado o de un flujo estacional.
- **La limpieza segura de producción parte cruzando consumidores reales del código con objetos vivos de la base**. Primero se eliminan duplicados exactos, sobrecargas legacy y objetos reemplazados explícitamente; después, y en otra pasada, se cuestiona la superficie que aún tiene contrato.
- **No mezclar en una sola migración limpieza estructural con recorte de grants o rediseño de seguridad**. Borrar legacy técnico es una operación; cambiar exposición de funciones productivas es otra y requiere validación específica de runtime.

## 63. Renombrar claves no autoriza romper el contrato del payload

- **Una migración de “normalización” (`camelCase` -> `snake_case`) no puede adelgazar ni reinterpretar la estructura que ya consumen las pantallas vivas**. Si `Control de candidatos` espera `recruitment_case_id`, `contract_name`, `owner_name` o locks contractuales, esos campos siguen siendo obligatorios aunque cambie el estilo de nombres en el nivel superior del JSON.
- **Si el objetivo es solo renombrar claves, la validación mínima no es que la función compile, sino que la UI siga pudiendo leer el mismo dominio operativo completo**. Cambiar shape y naming en el mismo paso vuelve opaco el rollback y rompe producción con facilidad.

## 63. Las migraciones SQL locales deben ser secuenciales y ejecutables sobre esquema real

- **No dejes dos archivos de migración con el mismo timestamp**. Aunque Git los acepte, el orden real queda ambiguo y un entorno nuevo puede aplicar una secuencia distinta a la que se probó manualmente.
- **No promociones migraciones que referencien columnas imaginarias o no desplegadas**. El caso típico es `rcc.is_contracted`: aunque la función se vea coherente a nivel de negocio, si la columna no existe en el esquema real, el dashboard completo cae en runtime.
- **Cerrar un proceso no siempre significa sacar de todas las bandejas sus entidades derivadas**. Si un candidato ya está `hired`, ocultarlo de `Personal a Contratar` por cancelar el caso de origen rompe la continuidad operativa de ficha y documentos. Los tableros deben distinguir entre cierre del folio y vida útil posterior del contratado.

## 64. Los scripts de diagnóstico no viven en la raíz del ERP

- **Un archivo suelto tipo `test_*.mjs`, `check_*.mjs` o `run_test.mjs` en la raíz no es neutral**. Ensucia `git status`, confunde qué forma parte del producto y degrada la mantenibilidad del repo.
- **Si hace falta instrumentación temporal, debe ir en un espacio explícito y descartable**. En este repo, lo correcto es usar herramientas versionadas reales o un directorio de scratch ignorado; no dejar pruebas operativas mezcladas con el código productivo.

## 65. La URL pública de la app debe resolverse desde una única capa de runtime

- **Si el sistema puede vivir detrás de un subdominio empresarial y seguir desplegando en Cloudflare, no conviene repartir lógica de host entre componentes**. Los redirects sensibles como recuperación de contraseña deben construirse desde una sola fuente configurada.
- **La variable pública y el fallback del navegador deben compartir el mismo saneamiento**. Si no, aparecen mezclas de `pages.dev`, subdominio corporativo y `window.location.origin` difíciles de auditar.

## 66. La invalidación de caché repetida es deuda de arquitectura, no detalle de UI

- **Cuando varias vistas invalidan las mismas queries con arrays literales repetidos, el contrato de caché ya está disperso**. Eso aumenta el riesgo de drift cuando se renombra una key o se agrega una query derivada.
- **Las invalidaciones operativas deben encapsularse igual que las query options**. Si `reclutamiento` o `incentivos` ya tienen hooks propios, también deben exponer helpers únicos para refrescar su estado compartido.

## 35. Un cambio de pipeline no sale sin migración de datos viva

- **Si se renombran o eliminan etapas operativas, primero hay que medir qué estados existen realmente en producción y diseñar el mapeo contra esos datos**. Cambiar enums sin revisar la base deja registros inválidos o interfaces que ya no pueden leer su propio historial.
- **El backend debe impedir saltos arbitrarios entre etapas nuevas desde el primer día**. No basta con actualizar labels; la RPC de transición tiene que volverse explícita sobre qué etapa puede seguir a cuál.

## 36. Un botón visible en producción sin contrato operativo es un bug, no una promesa

- **Si una acción todavía no tiene comportamiento implementado, no debe quedar renderizada como botón clickeable en superficies operativas**. QA y usuarios lo interpretan correctamente como error del sistema, no como “función futura”.
- **La forma correcta de preservar opciones futuras es separarlas del flujo principal y marcarlas como backlog no operativo**. Un único menú colapsable o un placeholder explícito es aceptable; varios botones muertos repartidos por el dashboard no lo son.

## 37. Un launcher secundario debe descansar como icono, no competir como CTA principal

- **Si un menú solo agrupa acciones futuras o secundarias, en reposo debe ocupar el mínimo espacio visual posible**. Un chip textual en cabecera compite con el trabajo principal del dashboard y ensucia la jerarquía.
- **Para accesos rápidos tipo asistente, el patrón correcto es icono en reposo y despliegue contextual por hover o clic**. El usuario ve disponibilidad sin sentir que hay una tarea primaria pendiente en ese control.

## 38. En dashboards claros, la separación entre lienzo y módulos debe venir de materialidad, no solo de borde

- **Si fondo y tarjetas comparten casi el mismo blanco, el usuario percibe todo como una sola capa y pierde jerarquía**. En ese caso conviene usar un tinte frío sutil, borde más legible y sombra amplia de baja opacidad para despegar módulos del lienzo.
- **Los paneles flotantes necesitan un tratamiento visual más expresivo que las tarjetas base**. Para overlays tipo launcher, funciona mejor un glass acuoso/translúcido con gradientes suaves y blur que un bloque blanco plano, porque mejora contraste sin endurecer el UI.

## 39. Un overlay flotante debe ganar siempre la guerra de stacking

- **Si un panel flotante convive con tablas, tarjetas y headers con sombras, su z-index no puede quedar implícito**. Hay que definir explícitamente la jerarquía del contenedor, el trigger y el panel para evitar que el overlay quede “detrás” visualmente aunque esté abierto.
- **La diferenciación visual de un overlay no se resuelve solo con blur**. Si debe sentirse como otra capa del sistema, necesita además un matiz cromático propio y más transparencia que las tarjetas base.

## 40. La ficha del candidato no debe mezclar identidad persistente con datos del ingreso actual

- **Si un dato acompaña a la persona en cualquier proceso futuro, vive en `candidate_profiles`; si depende del caso actual, vive en una tabla transaccional ligada a `recruitment_case_candidates`**. Mezclar ambos en una sola bolsa vuelve opaca la trazabilidad y dificulta reutilizar el candidato en otro proceso.
- **La escritura de la ficha debe pasar por `p_case_candidate_id` y no por `candidate_profile_id` expuesto directamente**. Así la autorización se valida contra el caso operativo y la auditoría queda amarrada al flujo real de reclutamiento.
- **Las tablas satélite transaccionales no deben persistir filas vacías por defecto**. Si un bloque como la ficha del ingreso actual se guarda completamente en blanco, el sistema debe evitar crear o mantener registros sin valor operativo.

## 43. Si una configuración depende de maestros sincronizados, la UI debe consumir ese maestro real

- **No basta con que el backend use BUK en el flujo transaccional si la pantalla administrativa sigue pidiendo texto libre**. Eso crea drift entre configuración y operación.
- **La regla es única**: cuando un selector gobierna cargos, contratos u otros maestros provenientes de una sync externa, `Configuración base` debe leer exactamente el mismo catálogo canónico que usa el resto del módulo.

## 41. Un subflujo sensible dentro de un módulo compartido necesita capability propia

- **No basta con proteger el módulo padre cuando una subsección expone datos sensibles o mutaciones operativas adicionales**. Si `Control de candidatos` vive dentro de `Control de Contrataciones`, debe tener capability explícita y no heredar visibilidad por defecto de todos los roles del módulo.
- **La restricción debe aplicarse tanto al render del frontend como al payload del backend**. Ocultar una pestaña sin recortar la respuesta RPC deja la data expuesta en la red; el backend debe devolver `[]` o bloquear el detalle cuando el usuario no tenga la capability específica.

## 50. En producción, una segunda pasada de RLS debe entrar por el núcleo compartido antes que por las tablas operativas grandes

- **Si el conector rechaza una reescritura masiva de policies, el siguiente movimiento correcto es recortar al bloque auth/config compartido y a índices faltantes, no insistir con toda la cirugía a la vez**. Ese corte sigue generando mejora real y mantiene el riesgo acotado.
- **Las policies `FOR ALL` suelen esconder dos problemas distintos: `multiple_permissive_policies` y `auth_rls_initplan`**. Separarlas por operación (`INSERT`/`UPDATE`/`DELETE`) en tablas maestras pequeñas es una forma segura de reducir ruido del advisor antes de tocar workflows críticos.

## 42. Si una tarjeta del dashboard depende de un SaaS externo, el frontend no debe leerlo directo

- **Para datos de soporte como cumpleaños desde BUK, el patrón correcto es sincronizar primero a una tabla local y luego leer desde una RPC propia**. Eso permite controlar permisos, normalizar esquema y evitar que el dashboard dependa de credenciales o formatos cambiantes del proveedor externo.
- **Las filas informativas del inicio no se completan con placeholders para “llenar” diseño**. Si una tarjeta entra al dashboard, debe tener una fuente real y un contrato local explícito antes de publicarse.

## 43. Los scripts operativos del repo deben aceptar el contrato de variables vigente, no uno heredado

- **Si el frontend ya estandarizó `VITE_SUPABASE_URL`, un script de soporte no puede seguir exigiendo `NEXT_PUBLIC_SUPABASE_URL` como única fuente**. Los scripts compartidos deben tolerar el contrato actual del repo o fallan en producción aunque las credenciales estén presentes.

## 44. En BUK, la identidad operativa debe colapsarse a la ficha activa canónica

- **Si un trabajador puede existir con varias fichas en BUK, los consumos operativos no deben leer la tabla cruda sin criterio canónico**. Para efectos futuros, la fuente correcta es una vista o contrato que conserve solo la ficha activa vigente por identidad documental.
- **Las tarjetas y listas derivadas de `employees` deben apoyarse en esa fuente canónica, no replicar filtros locales distintos en cada módulo**. Si no, reaparecen duplicados o fichas históricas fuera de contexto.

## 45. Un estado terminal de funnel debe salir de la bandeja operativa y pasar a una bandeja de handoff

- **Si un registro deja de ser “candidato” y pasa a “contratado”, no debe seguir apareciendo en la misma vista de control del pipeline**. Los estados terminales requieren una superficie distinta orientada a handoff y preparación contractual.
- **Cuando la siguiente etapa reutiliza la misma ficha y documentación, se reutiliza el detalle; no se duplica el componente**. Lo correcto es cambiar el origen de datos y ocultar acciones que ya no aplican, manteniendo una sola fuente visual de trazabilidad.

## 46. Si una sincronización depende de cron UTC pero el negocio habla en hora Chile, hay que resolver explícitamente el desfase horario

- **GitHub Actions agenda en UTC, no en `America/Santiago`**. Si el negocio pide una corrida diaria a las 20:00 hora Chile, no basta con fijar un único cron UTC porque se desalineará con horario de verano/invierno.
- **El patrón seguro es abrir las dos ventanas UTC posibles y validar la hora local dentro del job**. Así la sincronización se ejecuta una sola vez cuando en Chile realmente sean las 20:00.

## 47. Ubicación física real y zona operativa son conceptos distintos

- **Si el usuario pide ubicación real en tiempo real, la fuente correcta es el navegador y no una base de datos**. Ni BUK ni tablas del ERP representan presencia física actual; solo describen relaciones administrativas u operativas.
- **La tarjeta de clima debe resolver coordenadas con `navigator.geolocation` y dejar un fallback explícito si el permiso falla**. Cualquier uso de maestros internos para “adivinar” la ubicación física repite el error de modelar presencia con datos administrativos.

## 50. Las APIs de servicios gratuitos requieren alternativas confiables sin llaves

- **La resolución de coordenadas a ciudad (reverse geocoding) no debe fallar silenciosamente en el navegador**. En integraciones frontend, servicios de reverse geocoding como BigDataCloud son preferibles a otros que restringen CORS o no tienen endpoints gratuitos (como Open-Meteo geocoding-api reverse), asegurando que la ubicación real siempre pueda pintarse en la UI.

## 51. Los cambios ambientales deben ser visuales pero respetando la estética ERP

- **Si un widget reporta condiciones externas (como el clima), su materialidad puede reaccionar para dar contexto inmediato (temas fríos, cálidos, lluviosos)**. Sin embargo, las variaciones deben ser gradientes sutiles y pálidos. En un ERP, ningún módulo informativo debe saturar colores ni perjudicar visualmente el peso de las tareas operativas críticas.

## 48. Toda migración SQL nueva debe seguir el contrato transaccional y de grants del proyecto

- **Las migraciones deben envolverse en `BEGIN`/`COMMIT`**. Si una sentencia intermedia falla (CREATE INDEX, ALTER, etc.), la transacción asegura que la base no quede en estado parcial.
- **Toda RPC `SECURITY DEFINER` necesita validar `auth.uid() IS NOT NULL`** como primera línea. Sin esto, una exposición accidental de grants permite lectura anónima de datos internos.
- **Las funciones RPC deben cerrar con `REVOKE ALL FROM public, anon` + `GRANT EXECUTE TO authenticated` + `NOTIFY pgrst, 'reload schema'`**. Omitir cualquiera de estas tres puede dejar la función invisible para PostgREST o accesible para roles no deseados. Este patrón ya estaba documentado en la Lección 6, pero debe verificarse en cada nueva migración sin excepción.

## 49. Eliminación de módulos: no dejar vestigios

## 57. En layouts operativos con sidebar sticky, el breakpoint debe responder a la holgura real, no al mínimo teórico

- **Si un formulario principal comparte fila con un resumen sticky, el colapso a una sola columna debe ocurrir antes de que la composición entre en compresión visual**. Esperar hasta que “todavía cabe técnicamente” produce páginas montadas, grids apretados y sensación de layout roto en anchos intermedios.
- **Para flujos como `Solicitud de Contrataciones`, primero se protege la legibilidad del formulario y luego se decide si el resumen puede seguir sticky**. Cuando el ancho ya no da holgura, el resumen pasa a flujo normal (`position: static`) y el layout colapsa completo.

## 58. Si un script conserva retrocompatibilidad de variables, el workflow debe conservarla también

- **No endurecer un GitHub Actions rompiendo nombres de variables que el script aún soporta**. Si `sync-buk-employees.mjs` acepta `NEXT_PUBLIC_SUPABASE_URL`, pero el workflow solo exporta `VITE_SUPABASE_URL`/`SUPABASE_URL`, el job puede fallar en GitHub aunque la lógica local siga siendo correcta.
- **En transiciones de naming de entorno, primero se agrega compatibilidad múltiple y recién después se elimina el nombre viejo cuando el ambiente ya fue migrado**. Cambiar el workflow antes que la configuración real del repo genera regresiones silenciosas.

## 59. En workflows con secrets opcionales, string vacío y valor ausente no son lo mismo

- **No usar `??` como único criterio de fallback para URLs opcionales provenientes de GitHub Actions**. Un secret o variable vacía llega como `\"\"`, no como `undefined`, y puede romper `new URL(\"\")` antes de que el script empiece a trabajar.
- **Toda variable opcional de entorno que alimente una URL debe normalizarse (`trim`) y tratar string vacío como `null`**. Recién después se decide el fallback seguro.

## 60. Un dashboard operativo no puede depender de F5 para enterarse de trabajo nuevo

- **Usar TanStack Query no vuelve “viva” una pantalla por sí solo**. Si no hay `refetchInterval`, ni refetch al volver al foco, ni invalidaciones externas, una bandeja operativa puede quedarse congelada indefinidamente aunque existan datos nuevos en backend.
- **Para tableros de trabajo como `Inicio`, el contrato mínimo es polling razonable + refetch al recuperar foco/conectividad**. La inmediatez total puede venir después con realtime, pero depender de recarga manual es un bug operativo.

## 61. Un fallo de resolución en Vite puede venir de una dependencia publicada defectuosa, no del código tocado

- **Si `vite build` rompe resolviendo el entrypoint de un paquete, hay que verificar el paquete instalado antes de tocar imports o config.** En este repo, `@tanstack/react-query@5.100.14` declaraba `build/modern/index.js` en `exports`, pero ese archivo no existía físicamente en `node_modules`.
- **La prueba rápida es intentar `import("paquete")` fuera de Vite.** Si también falla ahí con `ERR_MODULE_NOT_FOUND`, el problema es de la dependencia instalada o de su versión publicada, no de la app.
- **Cuando la regresión viene de un paquete defectuoso, la corrección elegante es pinnear una versión estable conocida, no parchear el bundler alrededor del síntoma.**

## 62. Un ERP modular no necesita buses genéricos cuando solo existe una intención real

- **Si un componente recibe `onAction(type, payload)` pero en la práctica solo existe una acción válida, esa abstracción está sobrando.** En el dashboard, un callback directo `onRefresh()` es más claro, más seguro y más fácil de mantener que un mini-protocolo de strings.
- **Los widgets muertos deben salir del repo, no solo del layout.** Si un componente como `QuickActionsWidget` o `TimelineWidget` ya no participa del producto y no tiene contrato futuro aprobado, mantener el archivo solo agrega ruido y falsa superficie de mantenimiento.

## 63. En geolocalización, perder el nombre de ciudad no es lo mismo que perder la ubicación

- **Si el navegador ya entregó coordenadas reales, el widget no debe volver a un fallback administrativo como `Santiago, CL` solo porque falle el reverse geocoding.** Eso degrada una ubicación válida a una ubicación falsa y produce diagnósticos erróneos de “no resolvió ubicación”.
- **El orden correcto es: primero persistir coordenadas reales, luego intentar resolver la etiqueta humana.** Si la traducción a ciudad falla, la UI debe conservar una representación honesta de la ubicación real (por ejemplo coordenadas) y un estado operativo claro del error.

## 64. El fallback geográfico no puede ser también el estado inicial

- **Un fallback con coordenadas reales no debe usarse como estado inicial de un widget de geolocalización.** Si `DEFAULT_LOCATION` contiene Santiago y se usa antes de saber si el navegador respondió, el widget consulta y muestra Santiago mientras dice que sigue resolviendo ubicación.
- **Separar estado pendiente de fallback explícito evita ubicaciones falsas.** El flujo correcto es: estado inicial sin coordenadas, ubicación real si el navegador responde, y fallback solo si hay error, falta de soporte o timeout propio.
- **No publicar estados intermedios que reinicien el efecto que aún está resolviendo el nombre humano.** Si `setLocation` cambia dependencias antes de terminar el reverse geocoding, React puede limpiar el efecto y abortar la petición que debería entregar la ciudad.

## 65. La geocodificación inversa debe soportar payloads anidados, no solo campos planos

- **No asumir que un proveedor siempre expondrá `city` o `locality` en el primer nivel del JSON.** Algunos payloads útiles entregan la ciudad real solo dentro de estructuras anidadas como `localityInfo.administrative`.
- **Antes de degradar a coordenadas, el parser debe agotar las fuentes semánticas del payload.** En un widget operativo, mostrar coordenadas cuando la ciudad sí venía en el JSON es una regresión de parsing, no un fallo inevitable del proveedor.

## 66. Cuando el dashboard deja de ser configurable, el catálogo SQL también debe desaparecer

- **No mantener tablas y RPCs de configuración de widgets si la UI ya opera con layout estático.** `dashboard_widgets`, `user_dashboard_preferences` y sus funciones asociadas agregan consultas, políticas y deuda de mantenimiento sin entregar valor cuando el inicio ya no expone personalización real.
- **La limpieza correcta no es solo borrar tablas en Supabase; primero hay que retirar el acoplamiento del frontend.** Si el código sigue pidiendo el catálogo aunque solo renderice un widget fijo, el problema es arquitectónico antes que de base de datos.
- **Los scripts SQL sueltos fuera de `supabase/migrations` son deuda, no infraestructura.** Si un ajuste fue temporal y no forma parte del historial oficial, debe salir del repo para no competir con la verdad versionada.

## 67. Una view derivada para consumo autenticado no debe quedar con semántica de security definer

## 68. Si una refactorización del widget empeora la resolución real, se vuelve al flujo simple

- **No insistir con orquestadores de geolocalización “más robustos” cuando el comportamiento real en navegador empeora.** Si la UI se cuelga o termina en una ciudad falsa, la complejidad adicional no está ayudando.
- **Para este widget, el contrato confiable es una sola lectura del navegador seguida de reverse geocoding.** Cualquier estrategia multiintento solo debe reintroducirse con evidencia real de que mejora la precisión sin degradar tiempos ni estabilidad.

- **Si una view solo consolida filas ya gobernadas por RLS o grants de lectura, debe marcarse como `security_invoker = true`.** Dejarla con el comportamiento por defecto expone permisos del creador y genera alertas válidas del advisor de Supabase.
- **La corrección correcta no es mover lógica a otra RPC si el problema es solo la propiedad de la view.** Basta con recrearla preservando el mismo `SELECT`, los mismos grants y cambiando explícitamente la semántica de seguridad.

## 68. En Supabase, recrear funciones sin re-revocar grants reabre exposición accidental

- **`CREATE OR REPLACE FUNCTION` puede dejar vigente o reintroducir `EXECUTE` heredado para `public` y `anon` si no se cierra explícitamente después.** En este ERP, varios warnings no venían de una decisión de diseño, sino de recreaciones sucesivas de funciones que nunca reaplicaron el endurecimiento de grants.
- **La regla segura es: después de cualquier lote de RPCs o helpers nuevos, re-revocar `public` y `anon` en todo el schema expuesto y luego regrant solo lo que la app autenticada sí necesita.** Si no se hace, las funciones internas quedan publicadas por accidente vía `/rest/v1/rpc/...`.

## 69. Una tabla fuente detrás de una view `security_invoker` necesita política explícita, no solo grants

- **Si una view autenticada pasa a `security_invoker = true`, la tabla base debe tener un contrato RLS explícito compatible con ese consumo.** Dejar RLS habilitado sin políticas hace que el advisor marque un problema real y vuelve ambiguo quién puede leer la fuente.
- **El endurecimiento correcto combina tres capas: policy mínima de `SELECT`, revocación de escrituras innecesarias y eliminación total de permisos para `anon`.** Eso mantiene operativas las vistas legítimas como `employees_active_current` sin dejar abierta la tabla cruda más allá de lo necesario.

- **Un módulo eliminado no está eliminado hasta que se limpian todas sus capas.** Borrar el componente React no basta; hay que quitar también: imports en archivos consumidores, bloque CSS completo, scripts de sincronización, workflows de CI/CD, migraciones de creación de tabla/función, y crear una migración destructiva explícita.
- **Las migraciones de creación no se borran del historial.** Aunque el módulo ya no exista, las migraciones que lo crearon deben permanecer en el repositorio porque representan la historia real de la base de datos. Lo que se agrega es una migración nueva que destruye los objetos de forma limpia.

## 50. Simetría y consistencia de layout

- **Márgenes y gaps deben ser exactos, no aproximados.** Si el contenedor superior tiene `margin-bottom: 18px` pero el contenedor inferior usa `row-gap: 64px`, la cuadrícula se rompe visualmente. La elegancia de un ERP se logra respetando los tokens de espaciado estrictamente entre todos los módulos.
- **Los títulos grandes y gruesos deben limitarse a "Heros" o portadas.** En cabeceras de formularios o secciones internas operativas, usar un `h2` enorme con font-weight pesado distrae y rompe la sobriedad. Ajustar `clamp` a proporciones más discretas (`1.75rem`) con pesos medianos (`600`) es crucial para la legibilidad elegante.

## 51. Una auditoría externa no se aplica literal; primero se contrasta con el estado vivo del repo

- **Antes de corregir hallazgos de una auditoría, hay que verificar si el problema sigue existiendo en el código actual.** En este repo, la crítica al dashboard por falta de caché global ya estaba desfasada porque `useDashboard` ya usa TanStack Query; implementar esa recomendación otra vez solo habría creado ruido.
- **La forma correcta de trabajar con auditorías es separar hallazgos vigentes de hallazgos históricos.** Los primeros se corrigen; los segundos se registran como deuda ya resuelta o evidencia de evolución, no como trabajo nuevo.

## 52. Los errores del navegador en producción deben salir sanitizados

- **`console.error` crudo en Auth o Dashboard filtra demasiada información operacional cuando algo falla en producción.** Los errores deben pasar por un logger compartido que muestre detalle solo en desarrollo y mensajes genéricos en producción.
- **El patrón recomendado es centralizar el logging antes de tocar más superficies.** Corregir un archivo aislado sirve poco si otros módulos siguen imprimiendo objetos completos de Supabase o stack traces en el navegador.

## 53. Las relaciones de Supabase no deben tiparse por intuición

- **Cuando un `select` anidado de Supabase devuelve una relación, hay que confirmar si el payload viene como arreglo u objeto antes de tiparlo.** En Operaciones, relaciones como `contracts:contract_id (...)` llegan como arreglo, y asumir objeto rompe tipos o fuerza casts defectuosos.
- **La solución correcta es tipar las filas de query explícitamente y encapsular su transformación en helpers reutilizables.** Eso reduce `any`, baja la complejidad del componente contenedor y evita repetir casts inconsistentes.

## 54. Si un patrón de estilos inline ya se repitió, dejó de ser excepción

- **Los estilos inline solo son tolerables para casos realmente aislados.** Cuando un bloque operativo empieza a repetir grids, acciones, helpers de texto o estados vacíos, hay que extraer clases reutilizables y consolidarlas en el CSS del módulo o en estilos globales del patrón.
- **El objetivo no es "quitar inline por estética", sino bajar fricción de mantenimiento.** Componentes como `CandidateDetailSidebar` y tarjetas del dashboard se vuelven más legibles y menos propensos a divergencias visuales cuando la materialidad compartida vive fuera del JSX.

## 55. Migraciones destructivas: la firma del DROP debe coincidir con la del CREATE

- **`DROP FUNCTION IF EXISTS` solo funciona si la firma (nombre + tipos de parámetros) coincide exactamente con la función creada.** Si la función original se llama `get_home_news()` sin parámetros y el DROP apunta a `get_latest_news(text, integer)`, la sentencia pasa sin error pero no destruye nada. Siempre verificar la firma real en la migración de creación antes de escribir el DROP.
- **Una migración de eliminación debe limpiar en orden inverso al de creación:** primero grants y policies, luego funciones, luego índices, y finalmente la tabla. Aunque `CASCADE` manejaría dependencias, ser explícito evita sorpresas y deja trazabilidad legible.
- **El ERP debe contener solo datos internos operativos.** Fuentes externas (APIs de noticias, feeds RSS, etc.) no pertenecen al dashboard si no alimentan una decisión operativa directa. Si se incorporan y luego se retiran, el proceso de limpieza debe ser completo: frontend, backend, CI/CD y base de datos.

## 56. REGLA FUNDACIONAL: revisar `todo.md` y `lessons.md` antes de cualquier acción

- **Antes de proponer, planificar o ejecutar cualquier cambio, el agente debe leer `tasks/todo.md` y `tasks/lessons.md` completos.** Estos documentos son la fuente de verdad del proyecto: contienen el estado real de las tareas, las decisiones de arquitectura vigentes, los patrones obligatorios y las trampas ya descubiertas.
- **No se acepta ninguna recomendación, plan o corrección que contradiga o ignore lo registrado en estos documentos.** Si una auditoría externa o un hallazgo nuevo entra en conflicto con una lección existente, primero se contrasta y se registra la diferencia; no se aplica a ciegas.
- **Toda acción completada debe reflejarse en `todo.md` (tarea y resultado) y, si genera conocimiento reutilizable, en `lessons.md`.** Un cambio que no queda documentado es un cambio que se pierde o se repite.
- **Esta regla aplica sin excepción a cualquier modelo, sesión o agente que trabaje sobre este repositorio.** Es la primera lectura obligatoria antes de tocar código, SQL, CI/CD o documentación.

## 57. Las sincronizaciones programadas deben fallar temprano y dejar resumen operativo

- **Un workflow programado no debe depender de fallos tardíos para revelar variables faltantes.** Si una sincronización usa secretos y variables críticas (`BUK_AUTH_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`/`SUPABASE_URL`), el job debe validarlas explícitamente antes de ejecutar el script principal.
- **Para jobs periódicos, la instalación de dependencias debe ser determinista y alineada con el lockfile.** En este repo, `npm ci --omit=dev` es preferible a instalar una sola dependencia suelta porque reduce drift entre el runtime programado y el contrato real del proyecto.
- **El script de sincronización debe emitir un resumen auditable al terminar.** Contadores como `pagesProcessed`, `synced`, `finalCount` y `activeCount` hacen que una alerta de actualización fallida sea diagnóstica en vez de ambigua.
- **Si un workflow programa dos cron UTC para cubrir horario de verano e invierno, no debe decidir la ejecución mirando la hora real de arranque del runner.** GitHub puede disparar el run con retraso; eso produce éxitos falsos si la sync se salta por comparar `date +%H`. La decisión correcta debe basarse en `github.event.schedule` más el offset actual de `America/Santiago`.

## 70. Las plantillas externas de onboarding no se injertan en el payload general del caso

- **Si una ficha operativa crece para alinearse con una plantilla externa grande como BUK, no hay que inflar la RPC general del detalle del caso con todos esos campos.** El patrón correcto es una lectura dedicada para la ficha (`get_candidate_buk_profile`) y una UI que la consuma de forma aislada.
- **Los catálogos desplegables del negocio deben vivir como artefacto versionado, no como listas hardcodeadas en JSX.** Si el origen real está en un Excel o maestro operativo, se extrae a un módulo de datos estable y luego se reutiliza desde la UI.
- **Separar datos persistentes del candidato de datos transaccionales del ingreso evita contaminar futuras reutilizaciones del perfil.** Identidad, contacto y atributos personales pertenecen a `candidate_profiles`; payroll y condiciones del ingreso vigente pertenecen a `candidate_worker_files`.

## 71. Los identificadores heredados deben respetar el formateo canónico del sistema

- **Si una ficha reutiliza datos ya capturados en otra etapa, no basta con copiarlos como texto crudo.** Para RUT e identificadores equivalentes, el valor inicial debe reconstruirse usando los helpers compartidos del sistema (`normalizeRut` / `formatRut`) para que el usuario vea el mismo formato en todo el flujo.
- **La persistencia también debe respetar ese contrato.** Si el tipo de documento es `RUT`, el frontend debe guardar el valor normalizado aunque lo muestre formateado en pantalla; así se evita drift entre captura inicial, ficha extendida y búsquedas posteriores.

## 72. En Supabase productivo, recrear funciones no es seguro si el retorno pudo derivar del historial real

- **`create or replace function` no alcanza cuando el ambiente remoto arrastra una firma efectiva distinta en los parámetros OUT o en `RETURNS TABLE`.** Aunque el nombre y los tipos de entrada coincidan, Postgres rechaza el reemplazo con `42P13` si cambió el row type derivado del retorno.
- **Para endurecimientos sobre RPCs vivos, primero se inspecciona la firma remota y luego se usa `drop function if exists ...` antes del `create`.** Eso hace la migración resistente al drift entre el historial local del repo y el estado real de producción.

## 73. Seguridad en integraciones: No exponer APIs de terceros en el Frontend

- **El frontend jamás debe hacer solicitudes HTTP directas a APIs privadas** (como BUK o servicios que exijan un Token de Autorización Privado) ya que las credenciales quedarán expuestas en el navegador.
- En Supabase, la arquitectura exige que estas integraciones **siempre** ocurran del lado del servidor utilizando **Edge Functions**.
- El frontend llama a la Edge Function usando `supabase.functions.invoke()`, la cual, dentro del entorno seguro, usa un secreto (ej. `BUK_AUTH_TOKEN`) almacenado de forma segura en `npx supabase secrets`.

## 74. Historial persistente e Identidad del Candidato

- Un candidato se mantiene único en el sistema de acuerdo a su `national_id` (RUT) en la tabla `candidate_profiles`.
- El historial de sus postulaciones, incluyendo descartes o retiros, siempre debe obtenerse consultando la tabla pivot `recruitment_case_candidates` cruzada con la tabla de perfil maestro.
- **Regla de negocio:** Un candidato descartado en un proceso debe poder volver a postular a un nuevo proceso, pero el sistema está obligado a recuperar y mostrarle al reclutador su historial de descartes (alertas de retención/descarte) de casos anteriores para proteger los estándares de ingreso.

## 75. Un rechazo especializado no debe delegar a una RPC genérica con otro dominio de permisos

- **Si una decisión vive en una capability distinta, la RPC especializada debe cerrar el flujo completo por sí misma.** En este caso, `reject_candidate_stage_who(...)` no debía delegar el descarte a `advance_recruitment_candidate_stage(...)` porque esa transición valida permisos de gestión del caso, no permisos de aprobación `Who`.
- **La auditoría debe nombrar la acción real, no reciclar el action type del camino opuesto.** Un rechazo `Who` debe persistir algo como `candidate_stage_approval_rejected`; reutilizar `..._approved` destruye trazabilidad y complica cualquier dashboard o investigación posterior.

## 76. Un formulario gobernado por reglas no sale a producción sin su superficie de maestros

- **Si una pantalla operativa depende de catálogos o reglas que determinan quién aparece y cuánto se calcula, esos maestros deben tener UI de mantenimiento desde el primer release.** En `RRHH > Incentivos`, publicar solo el formulario habría dejado una pantalla técnicamente viva pero operativamente bloqueada, porque sin cargos elegibles ni reglas activas la búsqueda y el cálculo quedan vacíos.
- **La validación del monto y de elegibilidad debe vivir en backend, pero el mantenimiento de esos criterios no puede depender de SQL manual.** El patrón correcto es lanzar juntos: tablas maestras, RPCs seguras y una pestaña de configuración base para que la operación no dependa del equipo técnico.

## 76. El polling no reemplaza la invalidación; cada mutación debe refrescar solo su dominio

- **Si un módulo ya usa TanStack Query, volver a `loadX()` imperativo después de cada acción reintroduce inconsistencia y fetch redundante.** El patrón correcto es centralizar `queryKey`s, dejar queries compartidas por dominio y luego invalidar solo el tablero o detalle realmente afectados por la mutación.
- **Los datos maestros de baja volatilidad no deben recargarse en cada montaje.** Catálogos como cargos, contratos y turnos deben vivir en queries con `staleTime` largo y `gcTime` amplio; así se reduce latencia percibida y ruido de red sin sacrificar consistencia operativa.

## 77. Si una tarjeta productiva deriva fechas, la fórmula SQL debe verificarse con casos reales de borde

- **No basta con que una función de fechas “parezca correcta” al leerla.** En producción hay que validarla con ejemplos concretos del mismo mes, especialmente cuando usa `make_date`, `date_trunc`, `least` o ajustes para febrero.
- **Para widgets de agenda o cumpleaños, la fuente real es el ranking resultante, no solo el conteo base.** Una sync puede estar perfecta y aun así el widget mentir si la función que ordena próximos eventos desplaza días al `1` del mes o calcula mal el siguiente aniversario.

## 78. La arquitectura de color del ERP no soporta colores "quemados" (hardcoded) en un entorno de Modo Oscuro

- **El contraste de fondos y fuentes no puede depender de hexadecimáles fijos en la declaración de un componente.** Utilizar `#f5f7fb` o `#4b5563` en hojas de estilo locales o inline destruye la adaptabilidad del diseño cuando se inyecta un modo nocturno.
- **La solución estructural es el uso intensivo de CSS Variables Semánticas.** Al reemplazar un gris específico por `var(--text-muted)` o un blanco humo por `var(--surface-soft)`, el sistema responde instantáneamente al cambio de tema, reduciendo código, disminuyendo el riesgo de textos invisibles y centralizando el rediseño en `global.css`.
- **Los efectos de opacidad se logran inyectando RGBs desestructurados, no opacando un hexadecimal puro.** Reemplazar blancos transparentes con `rgba(var(--surface-soft-rgb), 0.88)` garantiza que los brillos, superposiciones y gradientes se adapten a la oscuridad como un reflejo nocturno y no como "flashes blancos".

## 79. Los CHECK constraints del audit log deben ampliarse con cada nuevo tipo de acción

- **Toda migración que introduce RPCs con inserts al `recruitment_case_audit_log` debe, como primer paso, ampliar el `CHECK` constraint `action_type`.** Si se omite y el constraint del historial no incluye el nuevo valor, la RPC falla en runtime con error de violación de constraint, aunque todo lo demás del SQL sea correcto.
- **El constraint debe reconstruirse de forma acumulativa**: incluir todos los `action_type` de migraciones previas más los nuevos. La forma segura es `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT` con la lista completa.
- **Antes de proponer valores nuevos de `action_type`, auditar el constraint vigente** buscando en las migraciones anteriores el último `add constraint recruitment_case_audit_log_action_type_check`.

## 80. El traslado de candidatos entre folios es atómico y debe protegerse en múltiples capas

- **La RPC de traslado debe validar en orden:** (1) candidato existe y no está en etapa terminal, (2) permisos sobre folio origen, (3) folio destino existe y no está cerrado, (4) permisos sobre folio destino, (5) candidato no duplicado en destino, (6) documentos sin conflicto de unicidad.
- **La migración de documentos debe hacerse antes de mover al candidato:** así, si el `UPDATE` de documentos falla por conflicto de unicidad, el candidato no queda en un estado inconsistente.
- **La ficha del trabajador (`candidate_worker_files`) no requiere migración explícita** porque está enlazada por `recruitment_case_candidate_id`, que no cambia en el traslado. Viaja automáticamente con el candidato.
- **`auth.uid()` no debe usarse en el bloque `DECLARE` de una función PL/pgSQL.** Aunque en PostgreSQL funciona técnicamente, es más correcto y predecible inicializarlo en el bloque `BEGIN` para garantizar que se evalúa en el contexto de la transacción activa.

## 81. En geolocalización, cambiar de subdominio cambia el origen y puede invalidar el permiso previo

- **Mover la app de `pages.dev` a un subdominio propio no rompe geolocalización por sí mismo, pero sí crea un origen nuevo para el navegador.** Eso significa que el permiso concedido antes no necesariamente aplica al nuevo host.
- **Si el widget reintenta solo una vez con `enableHighAccuracy: true`, el cambio de origen amplifica el fallo.** Un timeout o una lectura no disponible en ese primer intento termina enviando al usuario a IP o a una ciudad fija aunque el dispositivo sí pueda entregar coordenadas reales segundos después.
- **El patrón correcto para producción es**: lanzar un intento rápido y otro preciso, aceptar la mejor coordenada real disponible, cachear la última ubicación válida del navegador y reservar el fallback por IP únicamente para el doble fallo real.

## 82. Supabase Auth: Sesiones Atrapadas en Recovery Mode
- **No confíes en que el evento `PASSWORD_RECOVERY` se limpia solo tras cambiar la contraseña.** Si un usuario recupera su cuenta, el flujo de Supabase Auth puede dejar tokens en memoria que atan la sesión activa al estado de recuperación, causando bloqueos o refrescos infinitos en pantallas protegidas.
- **La solución radical pero necesaria**: Tras una mutación de contraseña exitosa, el frontend debe forzar un `signOut()` completo, limpiar estados locales e invocar una navegación dura a la raíz (`window.location.href = '/'`). Esto garantiza la destrucción de cualquier fragmento de la sesión de recuperación.

## 83. Renderizado de Temas Globales y Estética Brutalista "E-Ink"
- **El brutalismo de software (modo papel) es extremadamente performante si se estructura correctamente.** En lugar de aplicar pesados filtros CSS (`filter: sepia() grayscale()`) en el root, reescribir las variables semánticas de color hacia versiones mate/acuarela y eliminar `box-shadow` globalmente ahorra muchísimos ciclos de CPU de la GPU.
- **Las texturas SVG ganan la guerra de rendimiento:** Aplicar un SVG con `feTurbulence` inyectado mediante `background-image` en el pseudo-elemento `body::after` con `mix-blend-mode: multiply` logra un efecto de textura de papel fotorrealista a un costo de memoria muy bajo.

## 84. Control de Navegación Basado en Permisos (UI Level)
- **Ocultar módulos experimentales desde el root:** En lugar de ensuciar los componentes de `AppShell` con lógica condicional dura, la propiedad `adminOnly` en la definición estructural del menú (`navigation.ts`) permite filtrar los menús centralizadamente, evitando la exposición de zonas de pruebas (como `/labs`) a usuarios estándar, incluso sin depender de RLS para el ruteo.

## 85. La visibilidad del resumen de folios se gobierna desde `hiring_requests`, no desde el caso ni desde la asignación
- **Si la regla de negocio habla de "quién solicitó" o "qué gerencia pertenece", el permiso del resumen debe resolverse contra la solicitud original.** Basarlo solo en `recruitment_case_assignments` o en acceso amplio al caso termina mostrando procesos abiertos a roles que no corresponden.
- **La matriz correcta debe tener precedencia explícita por rol.** En este flujo: `reclutamiento`, `control_contratos`, `director_eje`, `gerente_general` y `director_op` ven todo; `gerencia` ve solo centros de costo donde figura como aprobador activo; el resto ve únicamente sus propias solicitudes.

## 86. Un folio rechazado o cerrado puede existir sin `recruitment_case`, y el resumen debe contemplarlo
- **No asumas que todo folio visible en `Resumen de procesos` tiene un caso operativo asociado.** Si la solicitud fue rechazada antes de abrir reclutamiento, vive solo en `hiring_requests` y desaparecerá del frontend si el payload nace exclusivamente desde `recruitment_cases`.
- **La solución segura es un payload híbrido para la pestaña de cerrados.** Los casos reales siguen entrando desde `recruitment_cases`, pero los folios finales sin caso deben agregarse como filas de solicitud con detalle expandible propio y sin intentar cargar un `case_detail` inexistente.

## 87. Arquitectura Ágil: Eliminación temprana de Módulos Mockeados
- **Si un módulo "placeholder" o "mock" no tiene ruta de implementación a corto plazo, es mejor eliminarlo**. Mantener código 100% hardcodeado (como el Generador y Seguimiento de Certificados original) ensucia el enrutador (`AppRouter`), el sistema de menús (`navigation.ts`) y la matriz de permisos (`access.ts`), agregando carga cognitiva innecesaria. Cuando se requiera la funcionalidad, se debe construir desde cero con bases de datos reales.

## 88. En flujos multi-etapa, un estado pendiente no prueba que la cola operativa exista
- **No des por cerrado un flujo de aprobaciones solo porque la solicitud quedó con `status = 'P'` o el historial la muestra como pendiente.** Si la tabla operativa de cola (`hr_incentive_request_approvals`) no tiene la fila correspondiente, la bandeja real quedará vacía aunque el registro principal parezca correcto.
- **La verificación de cierre debe contrastar siempre las dos superficies:** el registro maestro (`hr_incentive_requests`) y la cola de trabajo (`hr_incentive_request_approvals`), idealmente con una consulta de huérfanos `status pendiente + count(approvals)=0`.
- **Cuando aparezcan huérfanos productivos, la reparación segura es reconstruir la etapa faltante desde la fuente canónica de aprobadores** y dejar trazabilidad explícita en historial (`approval_created` con motivo de reparación), en vez de alterar manualmente el estado principal o “simular” la bandeja desde frontend.

## 89. Compartir fuente de datos no obliga a compartir la misma densidad visual
- **Si una misma fuente (`tasksData`) alimenta dos superficies distintas, no asumas que ambas deben mostrar el mismo universo de filas.** La campana admite alta densidad porque es un resumen global; el widget principal del inicio no.
- **Cuando un tipo de tarea satura una sola superficie pero sigue siendo útil en otra, filtra en el consumidor más estrecho, no en la fuente canónica.** En este caso, los incentivos pendientes deben seguir llegando a la campana, pero no al `TasksWidget` del inicio.

## 90. Un modal intermedio no puede depender del `input[type=file]` como almacenamiento transaccional

- **Si la subida requiere metadata adicional después de elegir el archivo, el `File` debe vivir en estado React propio hasta confirmar la operación.** Limpiar el `input` antes de cerrar la transacción rompe el flujo silenciosamente y deja al modal sin archivo real que persistir.
- **Los modales de decisión no deben cerrarse por defecto cuando falla la mutación.** En flujos auditables, cerrar el modal tras un error obliga al usuario a rearmar contexto y borra evidencia operativa; primero se muestra el error, y solo se cierra en éxito confirmado.
- **`window.prompt` y `window.confirm` son deuda operativa en módulos auditables.** No validan estructura, no dejan espacio para trazabilidad rica y no son reutilizables. El patrón correcto es un modal tipado con comentario obligatorio/opcional según la decisión.

## 91. Las reglas de vencimiento documental viven en el catálogo, no en el componente

- **Si un documento exige fecha de vencimiento, esa obligación debe resolverse desde `document_types.requires_expiry_date` y no mediante condicionales en React.** El checklist ya consume ese contrato y cualquier excepción hardcodeada solo introduce drift entre UI, migraciones y validaciones backend.
- **Cuando el negocio agrega o reclasifica documentos, hay que sincronizar también las plantillas de migración o carga masiva.** Dejar el catálogo de base y la plantilla operativa con listas distintas termina generando importaciones inválidas y tickets evitables.

## 92. Los períodos de incentivos y sus alertas no pueden derivarse “en la vista” si deben sobrevivir auditoría

- **Si el período de pago sigue una ventana no mensual estándar, como `21 -> 20`, debe existir una helper backend canónica y usarse tanto en el registro como en el backfill histórico.** Guardar `YYYYMM` directo desde la fecha del servicio sin esa regla genera clasificación contable incorrecta.
- **Las alertas operativas que dependen del momento de ingreso deben persistirse o derivarse desde timestamps históricos estables, nunca desde `today` en la UI.** `Fuera de Plazo` no puede recalcularse según cuándo alguien abre el historial meses después.
- **Cuando una regla de negocio exige un rango temporal acotado, la UX debe acompañar la validación backend pero no reemplazarla.** El selector de fecha puede recortar a `hoy - 7`, pero la autoridad final sigue siendo la RPC que registra el incentivo.

## 93. Un módulo operativo nuevo no queda enterprise si la regla crítica vive solo en React

- **Cuando una nueva capacidad cruza otro flujo sensible, la validación estructural debe imponerse en la RPC compartida y recién después reflejarse en la UI.** En `Jornadas y Turnos`, exigir descanso para ciertos incentivos en el formulario habría sido insuficiente porque otras superficies futuras podrían seguir llamando `create_hr_incentive_request(...)`.
- **La configuración de negocio reusable debe vivir en catálogo, no en lógica ad hoc de formulario.** Marcar `requires_rest_day` sobre `hr_incentive_types` evita listas hardcodeadas, permite auditoría y mantiene a `calculate_hr_incentive_preview(...)` y `create_hr_incentive_request(...)` usando la misma fuente de verdad.
- **Al crear un submódulo con permiso propio, el cierre no es solo la ruta React.** También hay que registrar `app_modules`, sembrar `role_module_access`, conceder `grant execute`, notificar `pgrst` y tipar el payload frontend desde el contrato real del backend; si falta una de esas piezas, el módulo “existe” en código pero no en operación.

## 94. REGLA ELEONORA (Gobernanza de Alcance Frontend)

- **Alcance cerrado a frontend puro:** Archivos permitidos son `src/**`, estilos, componentes, hooks y utilidades de UI. Archivos prohibidos son `supabase/**`, `.github/workflows/audit-supabase-migrations.yml`, `scripts/audit-supabase-migrations.mjs` y `package.json` salvo aprobación explícita de negocio.
- **Respeto irrestricto del contrato backend:** No alteres contratos backend ni nombres de campos de RPC por inferencia. Si una vista no calza con el payload, reporta el desacople sin corregir código SQL.
- **Protocolo obligatorio antes de cerrar:**
  1. Corre `npx tsc -b`.
  2. Corre `git diff --check`.
  3. Confirma explícitamente que no tocaste `supabase/**` ni archivos de gobernanza de migraciones.
  4. Si hubo que compensar algo por limitación del backend, déjalo escrito en `tasks/todo.md` sin inventar soluciones del lado SQL.

## 95. Si el dominio ya tiene un onboarding legacy, el nuevo módulo no se “reaprovecha” por nombre

- **No mezcles un onboarding operacional nuevo con tablas o RPCs legacy solo porque comparten etiqueta de negocio.** Si el modelo anterior resuelve cursos o entrenamiento y el nuevo pide plantillas, tareas bloqueantes, evidencias y auditoría, forzar reutilización crea deuda semántica y rompe contratos existentes.
- **La integración correcta es por gobernanza compartida, no por colisión de estructuras.** Se reutilizan `app_modules`, `role_module_access`, `profiles`, `storage.objects` y helpers de autorización; las tablas operativas nuevas deben quedar separadas cuando el ciclo de vida y la trazabilidad no son equivalentes.

## 96. Un módulo operacional no cumple estándar enterprise si su UI promete más control del que realmente gobierna el backend

- **La misma regla de acceso debe vivir en la ruta y en la pantalla.** Si la navegación habla de acceso modular `admin/superadmin`, no se puede dejar la ruta protegida por un guard más restrictivo solo por comodidad; eso rompe el contrato real de operación.
- **Las configuraciones sensibles no deben mutarse directo desde React aunque exista RLS.** Para plantillas, tareas y reglas operativas, el patrón correcto es RPC versionada con validación centralizada y trazabilidad explícita, no `insert/update/delete` ad hoc desde el cliente.
- **Los placeholders de flujo principal son deuda operativa, no detalle cosmético.** Si una fila expandible promete tareas o bitácora, debe renderizar datos reales o no existir; de lo contrario el módulo parece completo pero falla en confianza y auditabilidad.

## 97. Un incidente de `service_role` exige corrección de código y rotación real de credencial

- **Eliminar el secreto del repositorio no invalida la llave ya expuesta.** Si un JWT `service_role` apareció en código, el cierre técnico exige dos acciones separadas: limpiar/versionar el repo y rotar la credencial en Supabase antes de producción.
- **Los scripts administrativos deben fallar si no reciben secretos por entorno.** Nunca deben incluir URL/llave productiva embebida; el patrón aceptable es `SUPABASE_URL`/`VITE_SUPABASE_URL` más `SUPABASE_SERVICE_ROLE_KEY` desde runtime seguro.
- **Las mutaciones operativas masivas no deben escribir directo desde React a tablas sensibles.** Cuando hay permisos por contrato, idempotencia y validaciones cruzadas, debe existir una RPC transaccional que valide `auth.uid()` y devuelva errores estructurados por fila.
- **Un scanner propio debe distinguir críticos de deuda legacy.** JWT `service_role` hardcodeado debe bloquear CI; warnings como grants amplios legacy, helpers con parámetros de usuario o policies por bucket deben quedar visibles para saneamiento progresivo sin impedir todo deploy seguro.

## 98. En sincronizaciones server-to-server, el grant no reemplaza la validación interna de la RPC

- **Si una función `SECURITY DEFINER` valida permisos con `auth.uid()` o claims, `grant execute to service_role` no basta.** Una llamada desde Supabase JS con `service_role` llega por PostgREST con JWT, por lo que no calza con la condición de "contexto interno sin claims" y puede terminar bloqueada por la propia función.
- **La solución segura es reconocer explícitamente `request.jwt.claim.role = service_role` dentro de la RPC crítica.** Eso mantiene bloqueados `anon` y `authenticated` comunes, pero permite automatizaciones server-to-server sin escribir directo a tablas sensibles.
- **Las syncs que cruzan BUK y Jornadas deben filtrar contra la fuente canónica local de activos antes de escribir.** Si BUK reporta ausencias de trabajadores no activos o no presentes en `employees_active_current`, esos registros se reportan como omitidos y no deben hacer fallar el workflow.
- **No confiar en el límite implícito de 1.000 filas del cliente REST de Supabase.** Cualquier auditoría o sync que lea empleados/excepciones debe paginar con `range(...)`; si no, los totales y decisiones de limpieza quedan truncados silenciosamente.

## 99. Un clickwrap de cumplimiento no es un modal frontend; es un contrato auditado

- **La aceptación normativa debe persistirse y auditarse en backend.** Mostrar un popup sin RPC, timestamp y log inalterable solo prueba UX, no cumplimiento ISO.
- **Si `profiles` permite updates amplios por compatibilidad legacy, la auditoría debe cubrir también cambios fuera de la RPC.** Un trigger sobre `aup_accepted_at` evita que una actualización directa autorizada deje la aceptación sin evidencia.
- **El estado de aceptación debe viajar en el payload de permisos existente.** Hacer otra query global a `profiles` por cada carga duplica red y puede crear carreras; `get_my_effective_permissions()` ya es la fuente correcta para bloquear la app.
- **El bloqueo visual debe montarse en el shell autenticado, no en páginas individuales.** Si el usuario no aceptó la política, ninguna ruta operacional debe quedar navegable por omisión.

## 100. Un ERP no debe convivir con dos motores gráficos en producción

- **La migración de librería de charts debe ser Big Bang si ambas resuelven la misma superficie.** Mantener Recharts y ECharts al mismo tiempo duplica bundle, patrones de tooltips, responsive y criterios visuales; la salida enterprise es un wrapper único y una búsqueda de vestigios antes del cierre.
- **El wrapper compartido debe absorber el vendor, no cada módulo analítico.** Los módulos de negocio deben construir `option` y eventos, mientras `EChartSurface` gobierna carga diferida, shell visual, estados vacíos/carga y tokens de tema.
- **No uses metadata con nombres reservados del motor gráfico.** En ECharts, campos como `label` tienen semántica propia dentro de `series.data`; la metadata operacional debe usar nombres explícitos como `displayLabel` o `periodLabel` para evitar errores de tipos y runtime.

## 101. En PL/pgSQL, los nombres de salida de `RETURNS TABLE` también compiten dentro de la query

- **No reutilices como alias SQL un nombre ya declarado como columna de salida del `RETURNS TABLE`.** En PL/pgSQL, esos nombres viven como variables implícitas y pueden chocar con columnas/aliases locales, disparando errores `42702` por referencia ambigua aunque la consulta parezca correcta a simple vista.
- **La revisión de RPCs masivas no termina en el happy path individual.** Si la función bulk deduplica IDs con `unnest(...)`, ordena, bloquea y luego delega a una RPC unitaria, hay que ejecutar o leer específicamente ese wrapper; de lo contrario una colisión de nombres en la etapa de normalización deja rota toda la operación masiva mientras la aprobación individual sigue sana.
- **Cuando una campana o bandeja resume tareas agrupadas, la navegación debe resolver el subtab operativo real y no la landing genérica del módulo.** Si no, el dato pendiente existe pero el usuario cae en una vista que no le permite actuar y el flujo se siente roto aunque backend esté correcto.

## 102. Si ya existe un `UNIQUE`, la capa extra de seguridad debe auditar integridad derivada y ejecutarse dentro del flujo real

- **No repitas una constraint por ansiedad de control.** Si `folio` ya es `identity unique`, la capa adicional no agrega valor copiando otro `UNIQUE`; debe verificar anomalías que importan al negocio, como desalineación entre `period_code` y `service_date`, o duplicidades detectables al consultar por período.
- **La auditoría útil no vive solo como query manual.** Debe tener una forma explícita de inspección (`audit_*`) y otra de enforcement (`assert_*`) conectada tanto a las mutaciones como a las RPCs de lectura críticas, para que una inconsistencia rompa temprano y no quede escondida hasta una revisión posterior.
- **Cuando se aplica una migración con `supabase db query`, el cierre incluye registrar la versión en `supabase_migrations.schema_migrations`.** Si no, el esquema puede quedar correcto pero la trazabilidad remota vuelve a degradarse y reaparece la misma deuda de auditoría histórica.

## 103. En integraciones ERP hacia BUK, el plan funcional se valida primero contra la API oficial y luego contra la ficha local real

- **No implementes un “Generar en BUK” solo porque la UI ya exporta una nómina parecida.** Exportar una planilla y crear un empleado por API no exigen el mismo contrato; antes de escribir cola o Edge Functions, hay que contrastar la ficha local contra los campos obligatorios reales del endpoint oficial.
- **Si la API obliga datos que el modelo local aún no persiste, el cambio correcto es extender la ficha canónica existente, no abrir otra tabla ad hoc.** En este caso, `payment_period` faltaba en `candidate_worker_files` y `location_id` debía resolverse desde `region/comuna` vía API Buk.
- **La cola asíncrona debe fallar antes de encolar si el candidato no está realmente listo.** La validación de “contratado + documentación aprobada + ficha BUK completa” tiene que vivir en backend, no en un aviso blando de React.
- **Desplegar una Edge Function no la vuelve operativa por sí sola.** El cierre real incluye verificar secretos remotos (`BUK_AUTH_TOKEN`) y hacer un smoke HTTP contra la función publicada.

## 104. Vistas analíticas y seguridad: El dashboard también respeta RLS

- **Las vistas BI no son una excusa para evadir políticas de datos.** Crear una vista estadística sobre tablas de empleados no debe eludir la seguridad y no justifica el uso de roles administradores.
- **La corrección es estructural:** Toda vista analítica nueva debe definirse explícitamente con `with (security_invoker = true)` para que PostgreSQL resuelva el query con los permisos del usuario que consulta (el llamador), en lugar de los del creador de la vista. Esto garantiza que un jefe solo vea agregaciones de sus propios trabajadores o áreas permitidas sin crear brechas en la arquitectura.

## 105. El dominio operacional y el dominio analítico deben vivir en módulos separados

- **La vista operativa no debe penalizar la carga ni ensuciar la arquitectura con herramientas analíticas.** Un dashboard de RRHH enfocado en aprobar solicitudes no debería verse forzado a importar pesadas librerías de gráficos (ECharts) ni a lidiar con roles analíticos gerenciales, ya que ralentiza el trabajo principal de operaciones.
- **Los módulos analíticos (BI) tienen su propio ciclo de vida y políticas de caché.** Una tabla de solicitudes necesita *Realtime* (websockets) para evitar colisiones entre aprobadores; sin embargo, los tableros analíticos demandan polling mitigado (`staleTime: 5 mins`) para no hacer DDoSing a la base de datos con `count(*)` masivos en cada re-render. Separar los módulos permite asignar estrategias de caché a nivel de carpeta de forma natural.
- **Tipar vistas de lectura es igual de crítico que tipar tablas transaccionales.** Aunque los *views* de Supabase retornen JSON planos (`Record<string, unknown>`), el frontend no debe inyectarlos ciegamente en ECharts. Los mappers explícitos (e.g. `mapHeadcountByContract`) y contratos estrictos (`interface BukBiHeadcountByContract`) previenen que un campo renombrado en el *view* explote en silencio durante el runtime del navegador.

## 106. Un ajuste visual pequeño no justifica degradar semántica ni mover estados interactivos a inline styles

- **Si un control ya pertenece a un módulo estable, su hover/focus debe vivir en CSS del módulo, no en mutaciones DOM dentro de `onMouseEnter/onMouseLeave`.** Ese patrón dispersa tokens visuales, dificulta auditoría y vuelve más frágil cualquier refactor posterior.
- **Cambiar un botón textual por un ícono exige reforzar accesibilidad explícita.** `title` no reemplaza `aria-label`; además, el control debe conservar semántica de botón real y foco visible para no degradar navegación asistiva.
- **Los tabs o chips de navegación también necesitan semántica mínima aunque “solo cambien la vista”.** `type="button"` evita submits accidentales y `aria-current` deja claro cuál sección está activa cuando la navegación se renderiza dentro de shells reutilizados.

## 107. La deuda de performance real no se tapa subiendo el límite del warning; se saca del bundle base y se modulariza el vendor

- **Si una dependencia pesada vive detrás de una ruta opcional o un widget condicional, no puede importarse eager desde el shell principal.** En este repo, ORION y `react-markdown` debían cargarse diferido; de otro modo, el costo del copiloto se pagaba incluso fuera del módulo AI.
- **Un wrapper compartido pierde su razón de existir si los módulos de negocio vuelven a importar el vendor directo.** BI debe usar el mismo `EChartSurface` que Incentivos/Labs; permitir `import ReactECharts from "echarts-for-react"` en componentes de negocio reintroduce peso y divergencia.
- **Con ECharts, “lazy” no basta si el runtime sigue trayendo el paquete completo.** El estándar alto es `echarts/core` + registro explícito de charts/componentes realmente usados.
- **Cuando un vendor sigue grande aun modularizado, la separación debe seguir el grafo real de dependencias, no nombres genéricos.** Partir `echarts`, `zrender` y el wrapper React en chunks distintos elimina vendors monolíticos y vuelve auditable el costo de cada capa.

## 108. En dashboards híbridos, los filtros analíticos deben tolerar drift contractual controlado y la navegación no debe dejar módulos huérfanos

- **Si una RPC analítica cambia el nombre de una clave de filtros (`types` vs `incentive_types`) y el backend vigente ya está desplegado, el frontend no puede asumir una sola forma mientras exista historial de migraciones con ambos contratos.** El mapper debe aceptar explícitamente ambas variantes hasta que el contrato quede consolidado.
- **Un módulo promovido a primer nivel no puede seguir colgado visualmente de otro dominio por inercia de navegación.** Si Business Intelligence es transversal, debe vivir como módulo propio al nivel de Operaciones, no como subopción de RRHH.
- **Eliminar un sandbox o laboratorio exige limpiar también preload, rutas y archivos muertos.** Quitar solo el botón de navegación deja deuda de bundle, paths huérfanos y superficies mantenibles a medias.

## 109. El orden del top nav debe salir de una sola fuente de verdad; los accesos especiales no pueden romper la secuencia operacional

- **Si un acceso especial como ORION debe existir en la barra principal, su posición final debe respetar el orden del menú, no inyectarse “a mano” antes de los módulos visibles.** De otro modo, el orden percibido por el usuario diverge del orden declarado por producto.
- **La secuencia top-level es una decisión operacional, no cosmética.** Si el negocio define `Inicio -> Reclutamiento -> Recursos Humanos -> Operaciones -> Business Intelligence -> ORION`, la implementación debe reflejarla exactamente en `navigationModules` y en cualquier link extra del shell.

## 110. No dupliques navegación entre top nav y tabs internos cuando ambas superficies resuelven exactamente la misma decisión

- **Si un módulo ya tiene tabs internos claros para cambiar de vista, la barra superior no debe repetir esas mismas opciones como submenú.** Eso genera ruido visual, compite por jerarquía y hace parecer que existen dos patrones de navegación para la misma acción.

## 111. Si una estructura o artefacto quedó sin consumidores reales, se elimina; no se conserva “por si acaso”

- **Cuando un módulo sale del sistema, sus flags auxiliares, iconos dedicados y ramas especiales del shell deben salir con él.** Dejar `adminOnly`, `flask` o chequeos equivalentes sin consumidores reales solo ensucia la lectura y falsea la complejidad del sistema.
- **Los builds tipados no deben dejar espejos ejecutables redundantes en la raíz.** Si `tsc -b` se usa solo para validar `vite.config.ts`, la configuración de Node debe emitir como máximo declaraciones; regenerar `vite.config.js` introduce ruido, diffs innecesarios y dobles fuentes de verdad.

## 112. Un módulo documental nuevo no puede arrancar desde su tabla hija si necesita bootstrapear trabajadores reales

- **Si la operación parte sobre personas activas sincronizadas desde BUK, la búsqueda primaria debe salir de `employees_active_current` y luego enlazar el estado transaccional del módulo.** Arrancar desde `worker_accreditations` deja invisible a cualquier trabajador que todavía no tenga registro propio y obliga al usuario a sembrar filas manualmente.
- **El bootstrap correcto es generar o completar la huella transaccional recién cuando el usuario entra al caso o registra el primer documento.** Así se reutiliza la fuente canónica de personas sin poblar basura preventiva ni duplicar catálogos.
- **Cuando la regla de negocio exige “sin segunda bodega de archivos”, el binario no se persiste por comodidad en Storage.** Se sube directo al sistema destino (BUK) y la base local conserva solo referencias auditables (`buk_document_id`, nombre, URL y payload de sincronización).

## 113. Si un submódulo cambia de dominio visual, la ruta canónica también debe moverse; no basta con recolgar el link

- **Mover un acceso en navegación sin mover su pathname deja el sistema conceptualmente partido.** Si Acreditaciones vive dentro de Recursos Humanos, la ruta canónica debe reflejarlo (`/recursos-humanos/acreditacion/...`) y los paths legacy deben quedar solo como redirect de compatibilidad.
- **En analítica filtrable, el contrato debe cambiar de punta a punta o el filtro queda decorativo.** No sirve agregar selects en la UI si `biApi`, React Query y SQL siguen leyendo vistas globales sin parámetros; el refactor correcto conecta estado de filtro, `queryKey` reactiva y RPC backend sobre el mismo objeto `filters`.

## 114. Si un input se presenta como buscador BUK, no puede quedar encadenado a un filtro maestro que lo desactive

- **Un buscador de trabajadores alimentado por `employees_active_current` debe responder por nombre o RUT aunque todavía no haya selección secundaria, salvo que el dominio exija explícitamente esa dependencia.** En Acreditación, bloquear el query hasta elegir faena convertía un search BUK en un selector muerto.
- **La semántica de matching de nombres BUK debe reutilizar la misma helper estable (`build_buk_employee_name_search_key`) en todos los módulos.** Volver a un `LIKE` crudo sobre `full_name` reintroduce las mismas fallas ya corregidas en Incentivos y Movilidad Interna.

## 115. Si una función `RETURNS TABLE` cambia columnas de salida, en Postgres no basta `create or replace`

- **Cambiar el row type de una función pública exige `drop function` explícito antes del `create`.** Si se agregan columnas de salida a una RPC como `get_internal_mobility_requests()`, PostgreSQL responde `cannot change return type of existing function` aunque el cuerpo sea correcto.
- **La auditoría de migración debe contemplar también contratos de salida, no solo nombres y permisos.** En producción, el cierre seguro es: ajustar la migración, reaplicarla, validar la firma viva en la base remota y luego recién confiar en el frontend que consume ese payload.

## 116. En flujos secuenciales de aprobación, el solicitante no debe reencontrarse como aprobador del mismo paso

- **Si el aprobador del CECO coincide con `auth.uid()` al crear la solicitud, ese paso debe resolverse en backend dentro de la misma transacción.** Dejar que el folio vuelva a la misma persona para “aprobarse a sí misma” agrega ruido operacional y debilita la segregación de funciones.
- **La forma correcta no es borrar el paso sino auto-registrarlo con trazabilidad explícita.** El historial debe mostrar que `area_manager` existía, que quedó autoaprobado por coincidencia de roles y que el folio avanzó de inmediato a `control_contratos`.
- **La regla debe vivir en la RPC de creación, no en la UI ni en filtros posteriores.** Si el estado inicial nace mal en `hiring_requests` y `hiring_request_approvals`, cualquier parche de frontend solo oculta la redundancia sin corregir la causa raíz.

## 117. Si un widget ejecutivo muestra montos operativos, el total debe venir del backend ya filtrado y con la misma semántica visible del resto del módulo

- **No recalcules montos agregados en React cuando la visibilidad depende de roles, CECO y contratos derivados.** El card debe consumir un total ya consolidado en la RPC para no abrir drift entre lo que el usuario puede listar y lo que ve resumido.
- **Cuando un rol administrativo debe tener alcance amplio, eso se resuelve en la helper o CTE de alcance, no duplicando excepciones por tarjeta.** El widget operativo debe heredar el mismo motor de visibilidad para reclutamiento, dotación e incentivos.

## 118. En widgets densos de inicio, no agregues leyendas explicativas si la métrica ya es autoevidente y el negocio no la pidió

- **La tarjeta operativa del home debe privilegiar señal sobre explicación.** Si el usuario ya entiende el KPI por su label, una leyenda inferior solo consume espacio crítico y compite con el dato.
- **Cuando se elimina una capa visual, también se elimina su contrato y su CSS.** Ocultarla dejando props o clases muertas solo traslada la deuda en vez de resolverla.

## 119. En el dashboard home, la lógica de datos puede vivir en el contenedor, pero la presentación densa debe salir a subcomponentes

- **Si una tarjeta mezcla fetch state, navegación, iconografía, forecast y fallback visual en el mismo archivo, el componente ya superó su densidad razonable.** La salida correcta es separar la UI en subcomponentes puros y dejar el estado asincrónico en el contenedor.
- **Cuando una prop o parte del estado ya no gobierna ninguna vista, se elimina en la misma pasada.** Mantener contadores o campos huérfanos “por si vuelven” degrada legibilidad y vuelve más frágil el tipado.

## 120. En pantallas de configuración ERP, solo se vuelve desplegable lo que tenga catálogo canónico vivo; lo demás sigue siendo dato maestro

- **No conviertas inputs a selects por intuición visual.** Solo deben pasar a lista los campos respaldados por una fuente única y operativa del repositorio, como contratos, CECOs, cargos o catálogos equivalentes; de lo contrario solo se reemplaza un error humano por deuda de mantenimiento manual.
- **Si un formulario ya guarda valores legacy fuera del catálogo vigente, el hardening no puede volverlos invisibles.** El control debe mantener una opción compatible para editar o revisar el dato histórico mientras se empuja el uso del catálogo actual.
- **Cuando dos campos tienen dependencia natural de negocio, la UI debe reflejarla.** Si un contrato determina un CECO/área conocido, seleccionar el contrato debe sugerir o completar el área para reducir captura manual y evitar combinaciones incoherentes.

## 121. En syncs server-to-server con Supabase JS, el control de permisos y los retries deben modelar el contrato real del cliente REST

- **Una RPC `SECURITY DEFINER` usada por automation no puede asumir que `request.jwt.claim.role` siempre viene poblado.** Con `service_role` o secretos server-to-server, el contexto puede llegar solo con `request.jwt.claims` o incluso vacío; la validación correcta debe aceptar explícitamente ese patrón interno, no solo el happy path de JWT interactivo.
- **Supabase JS no siempre falla lanzando excepciones; muchas veces devuelve `{ error }`.** Si el retry wrapper solo captura `throw`, los `statement timeout` (`57014`) quedan sin reintento aunque el código parezca “protegido”.
- **Los contadores finales de una sync no deben poder botar una carga ya exitosa.** Si el dato es solo informativo, conviene usar `count: "planned"` o degradar elegantemente; el hard-fail debe reservarse para la mutación core y para snapshots o auditorías que sí forman parte del contrato operacional.

## 122. Si una sync ya procesa datos por lotes, no cierres con una segunda mutación masiva que rehace el mismo universo

- **Cuando el workflow ya recorre páginas de 100 registros, el snapshot derivado debe construirse en ese mismo loop si el timeout del backend es sensible.** Hacer al final una RPC que vuelve a upsertear los mismos miles de filas concentra todo el costo en un solo statement y expone la sync a timeouts evitables.
- **Las proyecciones analíticas derivadas no tienen por qué nacer en una sola función SQL.** Si el proceso transaccional ya posee los registros normalizados en memoria y la escritura por lotes mantiene el mismo contrato, persistir el snapshot incrementalmente puede ser más robusto y igual de auditable.

## 123. En flujos asíncronos iniciados desde la UI, encolar no equivale a ejecutar; el feedback de éxito debe cubrir ambas fases

- **Si el usuario dispara una integración desde un botón y el frontend solo llama a una RPC de cola, el flujo queda incompleto aunque la tabla de jobs exista.** La UI debe invocar explícitamente al worker o Edge Function responsable, o existir una automatización confirmada aguas abajo; de lo contrario, el mensaje “generado” es un falso positivo.
- **Los mensajes operacionales deben distinguir entre “encolado”, “en procesamiento”, “procesado con éxito” y “encolado pero no ejecutado”.** Mezclar esas fases en una sola confirmación impide auditoría real y hace parecer estable un proceso que todavía no salió de la cola.

## 124. La limpieza de frontend debe atacar primero duplicación estructural y estilos inline repetidos, no solo conteo bruto de líneas

- **Reducir líneas no significa colapsar lógica crítica en bloques más opacos.** La limpieza útil sale de extraer columnas, helpers y estados visuales repetidos a constantes o CSS compartido, dejando más corto el diff mental sin deformar contratos de negocio.
- **Cuando una tabla operativa repite sorting manual por columna, el siguiente paso no es otro parche local sino una fuente de verdad única para headers y valores ordenables.** Eso evita que futuras columnas queden desalineadas entre label, icono y comparador.
- **Los `catch (err: any)` y estilos inline con comportamiento ya estabilizado son deuda barata de resolver y alto retorno auditivo.** Quitarlos temprano reduce ruido, mejora tipado y baja la superficie de regressions visuales antes de tocar archivos gigantes de mayor riesgo.

## 125. Si BI mezcla universos de personal y reclutamiento, el filtro contractual debe normalizarse una sola vez y reutilizarse en todas las RPCs del dominio

- **No basta corregir el dropdown visible o el tooltip del gráfico.** Si `dotación` filtra por `area_name` y `reclutamiento` sigue leyendo `contract_name` o `contract_code` con semánticas distintas, el usuario termina viendo datos cruzados aunque la UI parezca coherente.
- **La forma robusta es alinear todo el dominio analítico al mismo matcher operacional.** En este repo, eso significa usar `normalize_buk_area_name(...)` tanto para workforce como para reclutamiento y movilidad, manteniendo compatibilidad defensiva con códigos legacy cuando todavía existan selecciones viejas.
- **Las métricas ejecutivas deben heredar el mismo scope operativo que la bandeja transaccional.** Si un gerente o `Operaciones_L1` ve procesos por `user_can_view_hiring_request_process_summary(...)`, la BI de reclutamiento no puede abrir un universo más amplio “por ser dashboard”.

## 126. Si una migración compila pero la RPC falla al ejecutarse, el fix debe salir en una migración incremental y con validación remota explícita

- **Pasar `db push` no demuestra que la función sirva en runtime.** Errores como `FILTER specified, but round is not an aggregate function` aparecen recién al invocar la RPC sobre la base viva, no en el parser superficial de la migración.
- **Una vez aplicada una migración defectuosa, la corrección auditable no es reescribirla sino agregar una nueva.** Así queda rastro completo del problema, de la causa raíz y del ajuste real desplegado.
- **Las agregaciones temporales con varios universos no deben resolverse con joins cartesianos “porque después hay `distinct`”.** En dashboards ejecutivos, la solución correcta es subconsulta correlacionada o CTE por bucket para preservar exactitud y evitar deuda de performance silenciosa.

## 127. Un KPI no puede derivarse de una bandeja paginada o limitada

- **Las listas operacionales y los indicadores ejecutivos tienen contratos distintos.** Una bandeja puede limitar filas para proteger la UI; un KPI debe agregarse sobre el universo completo autorizado en la base.
- **No agregues PII en el navegador para construir BI.** La base debe devolver métricas y series ya agrupadas, con el mismo helper de visibilidad del proceso transaccional.
- **Realtime no justifica polling agresivo.** Cuando existe suscripción de cambios, el polling debe ser solo un respaldo espaciado y las expansiones deben reutilizar el caché por identificador.

## 128. En movilidad interna, la exclusividad del trabajador no puede depender solo de la UI ni resolverse con validación tardía

- **Si un trabajador ya está en una movilidad activa, el bloqueo debe existir tanto en el catálogo de búsqueda como en la mutación transaccional.** Filtrar solo en frontend o solo en `search_internal_mobility_workers(...)` deja ventanas para duplicidades por carrera o por datos cacheados.
- **Cuando el cierre operativo depende de RRHH, debe existir una salida explícita de liberación.** `Pendiente` y `Ejecutado` no alcanzan; si el trabajador se retracta, el flujo necesita `Rechazado RRHH` para cerrar el caso, marcar la solicitud como rechazada y liberar al trabajador sin SQL manual.
- **Las correcciones sobre exclusividad no deben tocar datos productivos históricos automáticamente.** Primero se blinda el flujo futuro y se expone una vía auditable de cierre; recién después, si negocio lo decide, se sanean duplicidades legadas con intervención controlada.

## 129. En bandejas y analíticas de RRHH, los nombres visibles no son claves de consistencia ni deben resolverse en el hot path del filtro

- **Si una lista paginada busca también por un dato operativo derivado como el aprobador pendiente actual, no lo resuelvas con `LEFT JOIN LATERAL` dentro del filtro principal.** Ese patrón encarece cada página, complica el conteo total y vuelve frágil la búsqueda; la salida robusta es denormalizar el dato operativo y mantenerlo sincronizado por trigger o por la misma transacción de dominio.
- **`COUNT(*) OVER()` no es gratis en bandejas grandes solo porque simplifique el SQL.** Cuando la página ya nace de un universo filtrado costoso, conviene separar `filtered_count` de `paged_requests` para no arrastrar el costo del window function por cada fila devuelta.
- **En analíticas de personas, el nombre completo es metadato de presentación, no clave de agrupación.** Si el dominio puede tener homónimos, la agregación debe usar el identificador estable (`employee_buk_employee_id`) y derivar el nombre solo al proyectar el resultado final.

## 130. En rediseños visuales de un ERP, primero se crean primitives compartidos y solo después se retocan las pantallas ejecutivas

- **No apliques un lenguaje visual nuevo duplicando sombras, radios y fondos pantalla por pantalla.** Si el objetivo es modernizar un ERP sin romperlo, la primera pasada debe vivir en tokens y contenedores reutilizables (`surface`, `metric card`, `panel`) que luego las vistas consumen.
- **El neumorfismo útil en software operativo es selectivo.** Cards KPI, navegación, headers ejecutivos y paneles resumen sí ganan con superficies soft; tablas densas, formularios críticos y grillas de decisión deben mantener bordes claros, contraste fuerte y comportamiento táctico por encima del efecto visual.
- **La compactación correcta sale de extraer helpers y configuraciones repetidas, no de colapsar JSX complejo a cualquier costo.** Si varios widgets repiten formatters, headers de tabla o bloques KPI equivalentes, se comparte esa pieza; el detalle operativo específico de cada módulo se conserva local para no degradar legibilidad ni trazabilidad.

## 131. El Inicio no puede contar reclutamiento con un motor paralelo al de Control de Contrataciones

- **Si dos superficies del ERP hablan del mismo universo de procesos abiertos, deben derivar del mismo resumen operativo o de una helper común.** Mantener una lista manual de estados en `Inicio` y otra regla distinta en `Control de Contrataciones` reabre drift silencioso apenas aparece un estado nuevo o cambia la visibilidad.
- **Los helpers de visibilidad por CECO deben normalizar ambos lados antes de comparar.** En este repo, diferencias como `10116` vs `10116.0` bastan para esconder casos reales a perfiles gerenciales aunque el resto del SQL sea correcto.
- **Un bundle home puede seguir siendo liviano, pero sus KPIs no pueden inventar semántica propia.** Si el widget necesita `open_processes`, `ready_to_hire_cases` o `filled_cases`, esos números deben heredar el contrato operativo ya aprobado por el dominio.

## 132. Un lookup de trabajadores no debe disparar scans sobre la view deduplicada ni arrastrar consultas secundarias por cada tecla

- **Cuando el buscador necesita responder en sub-segundo, no construyas el `LIKE '%...%'` sobre helpers calculados fila a fila dentro de `employees_active_current`.** El patrón robusto es indexar una clave de búsqueda reusable sobre `employees`, filtrar primero sobre el universo activo y recién después deduplicar identidad si hace falta.
- **Si el mismo input alimenta otra RPC pesada de resumen o dashboard, al menos una de las dos debe desacoplarse o esperar al debounce estabilizado.** De lo contrario, el usuario percibe que “la búsqueda demora” aunque el cuello real sea el segundo query colateral.
- **Las optimizaciones de search deben tocar también el contrato de bloqueo operacional adyacente.** En movilidad interna, acelerar el lookup sin un índice específico para trabajadores ya bloqueados deja viva una parte del costo justo en la ruta que negocio usa para excluir duplicidades.

## 139. Si la auditoría pide “compactar”, primero consume primitives compartidas reales antes de crear otra capa de abstracción

- **Reducir líneas no justifica abrir una primitive paralela si el repo ya tiene una utilitaria canónica.** En este ERP, el hallazgo correcto no era “crear neumorfismo compartido”, porque `SoftSurface` y `soft-surface` ya existían; la corrección elegante fue reconectar los módulos a esa base y borrar CSS duplicado.
- **La compactación buena separa infraestructura común de semántica de módulo.** Un `WorkerLookupField` compartido debe absorber debounce, overlay y estados de carga, mientras incentivos, movilidad y roster solo inyectan hook, labels y filtrado específico.
- **La regla operativa es shared-first y de impacto mínimo.** Antes de abstraer, se busca si la pieza ya existe; si existe, se reutiliza y se limpia el vestigio duplicado. Solo se crea una primitive nueva cuando el contrato compartido realmente no está en el sistema.

## 140. La limpieza profunda debe empezar por residuos generados y cerrar también los vestigios versionados que ya no están integrados

- **No borres “documentación que parece vieja” ni scripts por intuición.** Primero demuestra desuso real contra `package.json`, workflows, referencias `rg` y trazas operativas antes de tocar algo versionado.
- **Los artefactos locales regenerables deben salir del árbol final aunque hayan servido para validar.** Si `build`, `tsc` o herramientas móviles recrean `dist/`, `*.tsbuildinfo`, `.expo/` o `node_modules` auxiliares, se valida y luego se limpian otra vez.
- **Si una auditoría interna sigue apuntando a archivos one-off ya obsoletos, la limpieza queda incompleta.** Hay que borrar el residuo y ajustar la herramienta para que siga cubriendo solo la superficie viva del repositorio.

## 141. Si un Excel sigue aportando contexto, la salida enterprise no es conservar el binario sino mover su contrato a texto versionable

- **Primero separa binario operativo de fuente de verdad.** Si el valor real del workbook ya vive en JSON, CSV, código o documentación del módulo, el Excel no debe seguir siendo el artefacto canónico.
- **Cuando una plantilla legacy aún explica el proceso, conviértela a Markdown antes de borrarla.** El objetivo no es solo ahorrar peso; es dejar trazabilidad legible, diffable y auditable en git.
- **No confundas “spreadsheet usado por runtime” con “spreadsheet guardado en el repo”.** Los CSV consumidos por la app pueden seguir vivos; los `.xls/.xlsx` estáticos sin ejecución directa deben justificarse o salir.

## 142. Si un incentivo consume un descanso, ese descanso queda reservado por fecha para todo el dominio de incentivos

- **La regla no puede depender del incentivo que estoy creando, sino también de los ya activos ese día.** Si el trabajador ya tiene un incentivo activo cuyo tipo exige descanso, cualquier segundo incentivo sobre la misma fecha debe bloquearse aunque venga para otro contrato o aunque el segundo tipo no exija descanso.
- **El preview y la mutación deben compartir exactamente la misma detección de conflicto.** La UI puede anticipar la alerta roja, pero `create_hr_incentive_request(...)` tiene que volver a rechazarla usando el mismo payload de `build_hr_incentive_preview_from_worker_data(...)`.
- **Cuando el bloqueo cruza contratos, el mensaje debe nombrar el contrato ya ocupado.** No basta con “ya existe un incentivo”; para operación real hay que indicar en qué contrato quedó consumido ese descanso para evitar dobles imputaciones silenciosas.

## 143. Operaciones no debe inferir conductores ni turno desde un preload local; debe vivir sobre lookup BUK indexado y roster canónico

- **Precargar `employees_active_current` completo para filtrar en cliente rompe el estándar enterprise del ERP.** Pierdes ranking indexado, vuelves a duplicar lógica de búsqueda y arriesgas que el lookup use una foto distinta de la que ya consumen Jornadas, Incentivos o Movilidad.
- **El estado `turno/descanso` no es un campo de formulario; es una derivación operacional.** Si el backend ya resuelve la pauta diaria, Operaciones solo debe mostrar ese resultado y persistir la fuente (`roster`) junto a los snapshots necesarios para auditoría.
- **Cuando el lookup remoto es efímero, el seleccionado debe preservarse aparte de los resultados.** Si el componente borra la lista al cerrar el buscador pero usa esa misma lista como source of truth del seleccionado, introduce una regresión silenciosa justo después de elegir al conductor.

## 144. En este ERP no se cierra una pantalla productiva apoyándose en fallback local de catálogo

- **Un fallback local puede servir para maqueta o resiliencia controlada, pero no como fuente efectiva de operación.** Si contratos, servicios o catálogos maestros vienen de Supabase/ERP, la corrección buena es endurecer la consulta backend o su resolución por IDs, no reinyectar una copia local silenciosa.
- **Cuando una relación embebida falla, la salida correcta es seguir resolviendo desde otra señal backend del mismo contrato.** Por ejemplo: `contract_id` más catálogo SQL vigente, no una tabla estática del frontend.
- **Si el usuario explicita “no uso vista local”, trátalo como regla de arquitectura, no como preferencia visual.** Cualquier arreglo que todavía dependa de datos locales para llenar selects o reconstruir dominio sigue estando mal cerrado.

## 145. Si Operaciones necesita registrar una excepción obligatoria, la excepción debe vivir en el mismo contrato y en la misma exportación del servicio

- **No resuelvas “servicio no realizado” escondiendo campos o dejando nulos mudos.** Si el usuario necesita declarar una excepción operativa sobre un servicio obligatorio, el backend debe persistir un estado explícito y una observación legible dentro del mismo registro `service_entries`.
- **La UI puede disparar la excepción, pero no puede inventar un canal paralelo.** El mismo batch RPC que guarda servicios planificados debe aceptar también el estado excepcional, limpiar asignaciones incompatibles y seguir aplicando seguridad y unicidad sobre el mismo servicio.
- **Toda excepción operativa debe salir visible en exportación.** Si el reporte histórico solo muestra conductor/equipo vacíos, obligas a interpretar silencios; la salida enterprise es exportar el estado y la observación para que la trazabilidad sea directa y auditable.

## 146. Si una vista ya fue aprobada para un rol en la matriz enterprise, no confíes solo en el feature flag del cliente para dejarla visible

- **Cuando el usuario reporta que un rol como `control_contratos` no ve una pestaña que la matriz sí le concede, el arreglo debe revisar dos contratos a la vez:** `role_feature_access`/`role_module_access` en backend y el gating de vistas en React. Corregir solo uno deja el síntoma latente.
- **Los refuerzos de permisos deben ser idempotentes y explícitos.** Si una grant crítica puede haberse perdido por drift o despliegue parcial, la salida senior es una migración corta que reasegure el acceso exacto en vez de asumir que “ya estaba en la migración grande”.
- **En tarjetas operativas colapsables, los CTA de excepción no deben vivir en el resumen comprimido.** El resumen muestra estado; la acción sensible se ejecuta dentro de la expansión para mantener jerarquía visual y reducir errores de operación.

## 147. Si un formulario administrativo usa un catálogo maestro vivo, no dejes un campo libre para capturar esa misma dimensión

## 148. En reclutamiento, `ready_for_hire` y `hired` no son sinónimos: la frontera real la define el éxito en BUK

- **Mover manualmente un candidato a `Contratado` antes de que BUK confirme el alta mezcla preparación con ejecución.** Eso deja la cola `Personal a Contratar` contaminada, impide distinguir pendientes reales de casos ya cargados y vuelve opaco el estado del caso para operaciones y RRHH.
- **La regla correcta es reservar `ready_for_hire` para el candidato listo documentalmente y usar `hired` solo como cierre sistémico posterior al éxito real en BUK.** La UI no debe ofrecer la transición manual a `Contratado`; el worker o la RPC de cierre deben mover la etapa, registrar historial y resincronizar el estado del caso.
- **Las restricciones de acciones sensibles no pueden vivir solo en la vista.** Si `Generar en BUK` o `Exportar nómina` son exclusivos de RRHH administrativo, la pantalla puede ocultar botones para reclutamiento, pero el backend también debe validar rol antes de encolar o autorizar jobs.
- **Cuando la previsión depende del prestador de salud, la derivación debe vivir en frontend y backend a la vez.** Fonasa debe forzar 7% automáticamente, mientras Isapre debe exigir `Plan Isapre UF`; si solo una capa conoce la regla, reaparece drift entre formulario, checklist, exportación y payload API.

- **Cuando el ERP ya carga `contractOptions` desde backend, `Contrato (opcional)` no puede seguir como `TextField`.** Ese input abre códigos inválidos, diferencias de spelling y reglas que luego no matchean con el resto del sistema.
- **La regla correcta es reutilizar el mismo catálogo compartido del módulo.** Si la pantalla ya tiene `setupCatalogsQuery.data.contractOptions`, el selector debe salir de ahí y no de una segunda fuente ni de escritura manual.
- **En configuraciones enterprise, “opcional” no significa “texto libre”.** Significa permitir vacío para aplicar a todos, pero cuando el usuario sí selecciona un contrato debe ser uno de los contratos reales y activos del ERP.

## 149. Un helper de permisos que recibe un UUID objetivo no puede ser ejecutable como oráculo de otros usuarios

- **La autorización por dominio debe atarse al actor autenticado antes de consultar roles, módulos o features del UUID recibido.** Si `target_user_id` no coincide con `auth.uid()` y el actor no es admin, el helper debe devolver `false` sin mirar permisos del tercero.
- **Un gate reusable no debe confiar en que la UI siempre pasa el usuario correcto.** Aunque los consumidores normales usen `auth.uid()`, un cliente alternativo puede invocar RPCs expuestas con IDs arbitrarios y convertir booleanos de acceso en un mapa de perfiles.
- **El admin cross-user debe ser explícito y backend-authoritative.** Permitir inspección admin es válido, pero debe depender de `user_is_admin(auth.uid())`, no de que el UUID consultado sea admin.

## 150. El padrón BUK no debe quedar abierto por PostgREST para sostener invalidaciones realtime

- **Si el frontend ya consume trabajadores por RPCs autorizadas, no mantengas `SELECT` directo sobre `employees` o `employees_active_current`.** Aunque ocultes `raw_payload`, documento, email, contrato, cargo y área siguen siendo datos operativos sensibles que pueden cruzar contratos o áreas.
- **Una suscripción realtime no justifica abrir lectura de una tabla sensible.** Si la tabla solo se usaba para invalidar un dashboard, se elimina esa dependencia o se reemplaza por una señal menos sensible; no se conserva el grant global.
- **Las vistas deduplicadas de personal también son frontera de datos.** `employees_active_current` parece una vista operacional, pero sigue proyectando datos personales y laborales; debe consumirse desde RPCs con filtros de dominio, no como catálogo universal del cliente.

## 151. Si un módulo ya tiene RPCs autorizadas, las tablas base no deben quedar abiertas por compatibilidad histórica

- **No mantengas grants directos para que una RPC no `SECURITY DEFINER` pueda mutar tablas sensibles.** La frontera correcta es hacer la RPC `SECURITY DEFINER`, validar `auth.uid()` y permisos dentro, y revocar acceso directo a la tabla.
- **Las tablas legacy sin consumidores vivos deben cerrarse junto con las tablas nuevas.** Si quedaron `onboarding_*` antiguas con grants amplios y el frontend ya no las usa, mantenerlas abiertas aumenta superficie sin aportar operación.
- **Un helper de módulo con UUID objetivo debe seguir la misma regla actor-bound que los helpers de permisos generales.** El admin puede inspeccionar a terceros; un usuario normal no puede usar booleanos de acceso para perfilar otros usuarios.

## 152. Un bucket sin flujo vivo no debe quedar abierto por anticipación

- **No dejes policies de storage amplias esperando una UI futura.** Si no existe consumidor vivo, el bucket debe quedar cerrado hasta que el flujo real defina path, ownership y validación backend.
- **La policy de storage debe validar más que `bucket_id` y módulo.** Para evidencias o documentos operacionales, el path debe estar atado a caso/tarea/candidato y la mutación debe replicar el permiso de escritura de la tabla asociada.
- **Cerrar ahora es más seguro que prometer disciplina futura.** Cuando se implemente la carga, se agrega una RPC o Edge Function específica; mientras tanto, no hay razón para exponer `insert/update/delete/select` directo.

## 153. Las tablas de asignación de roles no deben tener mutaciones directas desde `authenticated`

- **RLS admin-only no reemplaza revocar privilegios SQL innecesarios.** Si el frontend no muta `user_roles`, el grant correcto para `authenticated` es lectura acotada, no `insert/update/delete`.
- **La administración de roles debe pasar por migraciones, scripts con service role o RPCs administrativas auditables.** Dejar mutaciones directas aumenta el impacto de cualquier drift de policy.
- **En matrices de autorización, los permisos de escritura deben ser más estrechos que los de lectura.** Ver el propio rol no implica poder enviar cambios directos a la tabla de asignación.

## 154. Un trigger protector no reemplaza grants de columna mínimos en perfiles

- **Si el cliente solo necesita actualizar una bandera, concede esa columna y nada más.** `profiles.update(...)` para limpiar `must_reset_password` no justifica `UPDATE` general sobre identidad, estado o privilegios.
- **Las columnas de gobierno deben quedar bloqueadas por privilegio SQL antes que por lógica de trigger.** El trigger sigue siendo defensa en profundidad, pero el grant debe impedir que el cliente siquiera intente cambiar `is_super_admin`, `status` o datos administrativos.
- **Cada update directo desde React debe mapearse a un grant de columna explícito o migrarse a RPC.** No aceptes permisos amplios porque el payload actual “se porta bien”.

## 155. Los logs de seguridad no se exponen como tabla PostgREST directa

- **Un log de auditoría puede revelar actores, eventos, horarios e IPs aunque solo lo lea admin.** Si no existe visor vivo, se revoca la lectura directa y se mantiene la escritura interna.
- **El visor de logs debe ser una RPC administrativa paginada y filtrada.** Así se controla alcance, formato, retención y se evita que la tabla cruda sea una API accidental.
- **RLS admin-only no es excusa para dejar datos forenses como catálogo directo.** La frontera de consulta debe ser intencional y trazable.

## 156. Los módulos con RPCs de perfil no deben exponer sus tablas base en paralelo

- **Si la pantalla ya consume una RPC `SECURITY DEFINER`, no mantengas `SELECT` directo sobre las tablas que alimentan esa RPC.** Eso evita que un cliente alternativo salte el shape, paginación y filtros del contrato backend.
- **Los audit logs de módulo deben salir solo dentro de respuestas autorizadas y acotadas.** Un perfil de acreditación puede incluir su bitácora relevante; la tabla completa no debe quedar como API separada.
- **Las Edge Functions con service role no necesitan grants a `authenticated` sobre tablas base.** Validan JWT y permisos en su entrada; el acceso interno privilegiado no debe confundirse con permisos de cliente.

## 157. Un alta efectiva en BUK debe cerrar también la retención documental en Supabase

- **Subir documentos a BUK no basta si las filas del ERP quedan vivas.** Cuando `sync-buk-candidates` termina exitosamente y el snapshot contiene los documentos transferidos, el backend debe encolar una purga auditada de `candidate_documents` para no retener datos sensibles sin necesidad operacional.
- **La purga debe depender de evidencia backend, no del frontend.** Antes de borrar, `finalize_buk_sync_job_success` debe verificar que todos los documentos con archivo del candidato están representados en `result_snapshot.documents`; si falta alguno, no se encola limpieza.
- **No mezcles terminalidad de proceso con causa de retención.** `rejected`, `withdrawn` y `hired` requieren la misma infraestructura de borrado, pero con causas auditables distintas para que privacidad, operación y trazabilidad sigan siendo claras.

## 158. BUK no debe ser el primer validador de emails de candidatos

- **Un typo simple como `gmail,com` no debe llegar al proveedor.** El payload BUK debe normalizar email en backend antes de encolar y el worker debe repetir esa normalización antes de llamar la API externa.
- **Si el email personal queda no normalizable, el backend debe bloquear la generación con error operacional claro.** Es mejor dejar la ficha en ERP como incompleta que crear jobs BUK que fallan tarde y contaminan la cola.
- **Al reabrir jobs fallidos, reabre solo el último intento activo del candidato.** Mantener varios jobs `pending` para el mismo candidato viola el índice de unicidad y borra trazabilidad de intentos previos.

## 159. La UI que captura datos BUK debe validar el formato antes de guardar la ficha

- **No esperes al sync para detectar errores de tipeo en datos de contacto.** Si una ficha permite editar email, debe normalizar y validar antes de persistir; BUK queda como defensa externa, no como primer control.
- **La normalización debe ser compartida entre alta inicial y ficha BUK.** Si cada formulario inventa su regex, reaparece drift entre `Alta de candidato`, `Ficha personal BUK` y el worker.
- **Autocorrige solo errores obvios y reversibles.** Cambiar `gmail,com` a `gmail.com` es razonable; cualquier formato ambiguo debe bloquearse con mensaje visible y no guardarse silenciosamente.
- **Un bloqueo de formulario debe explicar la causa concreta.** Marcar el campo en rojo no basta; el mensaje debe decir qué regla falló y cómo corregirlo para que operación no tenga que adivinar.

## 160. Un documento aprobado sin archivo físico no puede llegar al proveedor externo

- **La fila documental no es suficiente evidencia si el objeto de Storage desapareció.** Antes de resolver, crear o actualizar una ficha BUK, el worker debe validar que cada documento aprobado con `file_path` existe realmente en el bucket esperado.
- **Si falta un archivo, el error debe volver a operación como una acción concreta.** El candidato debe quedar bloqueado con mensaje de recarga/aprobación del documento, no con `Object not found` ni con una ficha parcialmente avanzada en BUK.
- **La reparación puntual debe resetear el estado documental con audit log.** Cuando se detecta una aprobación inválida por archivo ausente, el documento vuelve a `pending`, se limpia `file_path` y se registra la causa para trazabilidad.

## 161. Resetear documentación aprobada debe degradar la etapa del candidato

- **`ready_for_hire` representa una condición completa, no una etiqueta histórica.** Si la documentación vuelve a `pending`, el candidato debe salir automáticamente de Listo para contratar y volver a `document_review`.
- **La reparación de documentos incorrectos debe separar SQL de Storage API.** Supabase protege `storage.objects` contra borrado directo; elimina la fila documental en SQL y retira el archivo físico con la API de Storage usando service role.
- **La auditoría debe mostrar ambos eventos.** La baja de etapa y la eliminación del documento incorrecto son acciones distintas y deben quedar con `old_values`, `new_values` y causa explícita.

## 162. Las acciones manuales sobre documentos deben vivir detrás de una frontera backend

- **El frontend puede iniciar la acción, pero no debe ser la autoridad de borrado.** Eliminar documentos sensibles debe validar JWT, permisos de caso/candidato y estado operacional antes de tocar Storage.
- **Storage se limpia con API, no con SQL directo.** Las funciones SQL validan y auditan; una Edge Function con service role elimina el objeto físico para evitar archivos huérfanos y respetar la protección nativa de Supabase.
- **Contratado cambia la semántica documental.** Si el candidato está `hired`, el ERP debe mostrar que los documentos están resguardados en BUK y no presentar el checklist como un repositorio disponible.

## 163. Los checklists operativos deben materializar una vez su scope crítico

- **No recalcules el mismo conjunto documental para JSON y métricas por separado.** En pantallas interactivas, duplicar joins sobre documentos puede terminar en timeouts cuando se combina con funciones de autorización.
- **El índice debe calzar con la frontera de consulta real.** Para documentos de candidato, el acceso operativo se hace por `recruitment_case_id`, `candidate_profile_id` y `document_type_id`; ese orden necesita índice compuesto.
- **La prueba de cierre debe medir el caso real.** Si el error viene de una pestaña concreta, valida la RPC con el candidato visible en pantalla y reporta tiempo de respuesta remoto.

## 164. Una vista documental no debe calcular sugerencias BUK en caliente

- **El checklist debe responder con estado documental, no con reconciliaciones externas.** Si una vista interactiva solo necesita saber si `Código de ficha` está persistido, no debe invocar helpers que buscan códigos sugeridos en empleados BUK o payloads históricos.
- **Las sugerencias costosas deben quedarse en la ficha BUK o en el worker de generación.** Ahí aportan valor operativo; en una pestaña de control documental solo agregan latencia y riesgo de timeout.
- **Los estados terminales deben cortar antes de llamar RPCs pesadas.** Si un candidato ya está `hired` y los documentos fueron transferidos a BUK, la UI debe mostrar el mensaje de resguardo sin intentar reconstruir el checklist local.

## 165. Un campo derivado que alimenta BUK no se protege solo con `readOnly`

- **Si un dato debe ser visible pero no editable, el backend debe ignorar el valor libre del cliente.** La UI puede mostrar `readOnly`, pero el RPC debe reconstruir el valor desde sus campos fuente para evitar bypass.
- **La fuente estructurada manda sobre el texto compuesto.** Para direcciones, `Calle`, `Número de calle` y `Ciudad` son el contrato operativo; `Dirección base` es una presentación derivada.
- **Los backfills deben acompañar el cambio de regla.** Si el payload BUK consume un campo persistido, la migración debe corregir registros existentes con datos estructurados para que la próxima generación no dependa de abrir y guardar la ficha.

## 166. La auditoría de índices FK debe verificar el catálogo con la forma correcta

- **No basta con leer un advisor y asumir que todos los faltantes quedaron cubiertos.** Después de crear índices, valida en `pg_indexes` y cruza contra `pg_constraint`/`pg_index` hasta que el conteo de FK sin cobertura sea 0.
- **`pg_index.indkey` necesita normalización explícita antes de comparar contra `pg_constraint.conkey`.** Una comparación mal casteada puede marcar falsos negativos aunque los índices existan.
- **Si una migración aplicada deja un faltante, no reescribas el historial ya aplicado.** Crea una migración corta adicional con el cierre puntual para mantener trazabilidad limpia entre repo y Supabase remoto.

## 167. Un catálogo crítico no debe esperar una sincronización live externa para pintar la UI

- **El selector operativo debe abrir con el catálogo local autoritativo.** En solicitudes de contratación, `job_positions` es la frontera transaccional; refrescar BUK antes de mostrarlo convierte una mejora de frescura en bloqueo de operación.
- **El refresh live debe correr en segundo plano y revalidar al terminar.** Si `/api/v1/roles` está lento o BUK demora, el usuario igual puede avanzar con los cargos ya sincronizados; cuando el refresh termina bien, React Query invalida y trae opciones nuevas.
- **Los widgets de inicio no deben depender de un único proveedor externo sin fallback.** Para indicadores financieros, usa timeout corto, proveedor alternativo y último dato bueno en cache para evitar tarjetas rotas por caídas temporales de terceros.

## 168. Una ausencia multiperiodo no debe renderizarse como tarjetas diarias repetidas

- **Si BUK o Incentivos envían días consecutivos con la misma causa, la UI debe resumirlos como un período.** Repetir una licencia médica día por día aumenta ruido visual y hace parecer que son eventos distintos.
- **La duración visible debe ser la del grupo, no los días transcurridos desde cada fecha.** Para jornadas, `10/07 - 14/07 · 5 días` es más claro que mostrar `10/07 · 4 días`, `11/07 · 3 días`, etc.
- **La compactación debe preservar la autoridad de origen.** Aunque el bloque se agrupe, debe seguir indicando si está gobernado por BUK/Incentivos y mantener bloqueada la acción manual correspondiente.
