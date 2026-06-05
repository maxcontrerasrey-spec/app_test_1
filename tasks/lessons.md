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

## 31. Limpiar datos no es inventarlos

- **Una migración de saneamiento solo puede completar valores cuando existe una fuente confiable dentro del sistema**. Si un histórico carece de `travel_methodology`, solo se backfillea desde auditoría real; no se asume un default para cerrar visualmente el dato.
- **Los campos derivados de identidad deben converger al registro canónico**. Si `requester_name` y `requester_email` ya existen en `profiles`, mantener variantes como `maximiliano.contreras` solo agrega ruido operacional.

## 32. El dashboard no debe consultar lo que no renderiza

- **Cada llamada remota del inicio debe justificar su presencia en pantalla**. Si hoy no existe un widget de notificaciones, alertas o KPIs en el layout activo, no se consultan en la carga principal.
- **La limpieza de performance simple suele estar en la poda, no en la complejidad**. Antes de optimizar cachés o paralelismo, hay que eliminar fetches que no tienen consumidor.

## 33. Un widget descartado operativamente también debe apagarse en la base

- **Si una sección ya no forma parte del dashboard real, no basta con sacarla del layout**. También hay que desactivarla en `dashboard_widgets` y limpiar preferencias huérfanas para que el catálogo no siga prometiendo piezas que el frontend ya no usa.
- **Primero se podan consumidores y luego se apaga el catálogo**. Ese orden evita romper usuarios activos mientras se limpia deuda histórica del ERP.

## 34. Un workflow nuevo no debe autorizarse preguntando por roles en React

- **Si una decisión de negocio sensible depende de una autorización específica, esa autorización debe llegar resuelta desde backend como capability efectiva**. El frontend solo consume `hasCapability(...)`; no decide si un rol “equivale” o no a permiso operativo.
- **Primero se crea la fuente de verdad (`app_capabilities`, `role_capabilities`, RPC de permisos efectivos) y recién después se monta la UI del flujo**. Saltarse ese orden termina mezclando diseño de pantalla con gobierno de seguridad.

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

## 41. Un subflujo sensible dentro de un módulo compartido necesita capability propia

- **No basta con proteger el módulo padre cuando una subsección expone datos sensibles o mutaciones operativas adicionales**. Si `Control de candidatos` vive dentro de `Control de Contrataciones`, debe tener capability explícita y no heredar visibilidad por defecto de todos los roles del módulo.
- **La restricción debe aplicarse tanto al render del frontend como al payload del backend**. Ocultar una pestaña sin recortar la respuesta RPC deja la data expuesta en la red; el backend debe devolver `[]` o bloquear el detalle cuando el usuario no tenga la capability específica.

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
