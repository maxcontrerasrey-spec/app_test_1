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
