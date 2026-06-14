# Lecciones Técnicas Aprendidas (Lessons)

Este archivo consolida las decisiones de arquitectura, los patrones de diseño y las trampas comunes descubiertas durante el desarrollo de la plataforma, sirviendo como guía de conocimiento.

---

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

## 64. En Supabase, “aplicado” y “registrado en historial” no son la misma cosa

- **Si una migración se ejecuta manualmente en SQL Editor o mediante un conector que genera otro timestamp, el esquema puede quedar correcto pero `supabase_migrations.schema_migrations` desalineado respecto del repo**. Eso rompe auditoría, trazabilidad y cualquier intento serio de comparar local vs remoto.
- **La corrección segura no es reejecutar DDL histórico a ciegas sobre producción**. Primero se verifica que el efecto exista o haya sido absorbido por migraciones posteriores; recién después se hace backfill del historial. Si el bloque legacy mezcla timestamps duplicados o más de un esquema de versionado, se aísla como saneamiento histórico aparte.

## 65. La deuda legacy de migraciones no se arregla renombrando primero; se arregla congelando una baseline y poniendo guardias

- **Cuando producción está sana pero el árbol histórico está desordenado, la prioridad no es “dejar lindo `supabase/migrations`”**. La prioridad es impedir que el problema siga creciendo mientras se conserva capacidad de auditoría.
- **El primer paso seguro es una baseline explícita más un auditor automatizable**. Eso permite tolerar la deuda heredada conocida, detectar de inmediato cualquier migración nueva fuera del estándar y postergar la cirugía histórica real para una fase separada y controlada.

## 21. Para separación vertical uniforme, `row-gap` es más confiable que márgenes acumulados

- **Si la distancia entre siblings no se percibe igual, conviene mover la responsabilidad al layout principal**. Un `row-gap` único en el contenedor evita diferencias entre secciones grid/flex.
- **Cuando el usuario pide misma distancia para todo, la solución debe ser estructural**. No se resuelve afinando una sección; se resuelve con una regla única para todas.

## 22. Evolución ERP: el estado remoto debe salir de `useState` manual

- **Cuando un módulo ya combina carga inicial, caché implícita, refresh manual y mutaciones con recarga, es señal de migrarlo a TanStack Query**.
- **El primer paso no es rehacer todo el dominio**. Conviene empezar por el dashboard, dejar `QueryClientProvider` en la raíz y luego extender el patrón a los módulos operativos.

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
