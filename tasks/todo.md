# Plan de trabajo

## Endurecimiento seguro de hiring_requests

- [x] Revisar y cerrar la migración `20260520_000006_secure_hiring_requests_workflow.sql` para que la cadena quede secuencial, auditable y sin `UPDATE` directo desde frontend
- [x] Adaptar `Solicitud de Contrataciones` para usar `submit_hiring_request(...)` enviando solo IDs y campos libres del solicitante
- [x] Adaptar `Inicio` para usar `decide_hiring_request_approval_v2(...)`, mostrar comentario opcional y reflejar los nuevos estados del flujo
- [x] Revalidar compilación y build, documentar el cierre y dejar el cambio publicado

## Resultado de endurecimiento seguro de hiring_requests

- Se formalizó la migración [20260520_000006_secure_hiring_requests_workflow.sql](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260520_000006_secure_hiring_requests_workflow.sql:1) con:
  - `cost_center_approvers`
  - `workflow_approvers`
  - `hiring_request_snapshots`
  - `hiring_request_audit_log`
  - nuevos estados secuenciales en `hiring_requests`
  - bloqueo de `UPDATE` directo desde `authenticated`
  - RPC `submit_hiring_request(...)`
  - RPC `decide_hiring_request_approval_v2(...)`
- La visibilidad de solicitudes y snapshots quedó restringida al solicitante, admin y aprobador de la etapa pendiente actual.
- `Solicitud de Contrataciones` ya no envía nombres derivados del frontend; solo IDs y campos libres del solicitante mediante [hiringRequests.ts](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/services/hiringRequests.ts:1).
- `Inicio` ahora decide por `decide_hiring_request_approval_v2(...)`, siempre filtra pendientes por `approver_user_id = auth.uid()` y permite comentario opcional en el detalle de aprobación.
- `Mis solicitudes` usa `submitted_at` cuando existe para calcular `Días desde solicitud`.
- Validación:
  - `npx tsc -b`: correcto
  - `npx vite build`: correcto

## Navegación superior Opaline

- [x] Reemplazar la barra lateral por una navegación superior que aproveche el ancho horizontal
- [x] Renombrar `Reclutamiento & Entrenamiento` a `Reclutamiento`
- [x] Implementar submenú flotante para `Reclutamiento` con apertura por hover y fijación por clic
- [x] Agregar módulos vacíos `Operaciones` y `Recursos Humanos`
- [x] Migrar la paleta visual principal a contrastes Opaline
- [x] Verificar si el cambio de módulos exige extensión en `app_modules` y `role_module_access`
- [x] Revalidar compilación y comportamiento base del shell superior

## Resultado de navegación superior Opaline

- La app dejó de usar la barra lateral y ahora concentra la navegación principal en una barra superior que aprovecha el ancho horizontal.
- `Reclutamiento & Entrenamiento` fue renombrado a `Reclutamiento`.
- El submenú de `Reclutamiento` quedó con apertura por hover y fijación por clic dentro del shell superior.
- Se agregaron los módulos placeholder `Operaciones` y `Recursos Humanos`.
- Se migró la paleta principal del shell y de los componentes base a contrastes Opaline, eliminando la dependencia visual del rojo anterior como lenguaje dominante.
- Se agregó la migración [20260516_000004_add_topnav_modules.sql](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260516_000004_add_topnav_modules.sql:1) para extender:
  - `app_modules`
  - `role_module_access`
  con acceso inicial de `admin` para los dos módulos nuevos.
- `npm run build`: correcto

## Reordenamiento de Inicio y compactación de Solicitud de Contrataciones

- [x] Priorizar la bandeja de aprobaciones pendientes en la parte superior de `Inicio`
- [x] Eliminar `Estado operativo` y `Ultimas solicitudes realizadas`
- [x] Enriquecer `Mis solicitudes` con folio, cargo solicitado, contrato y vacantes
- [x] Separar visualmente acciones de aprobación con colores fijos gris/verde/rojo
- [x] Compactar la cabecera del formulario de `Solicitud de Contrataciones` usando más columnas
- [x] Revalidar compilación después del ajuste

## Resultado de reordenamiento de Inicio y compactación

- `Inicio` ahora muestra primero la bandeja de aprobaciones pendientes.
- `Ver detalle` quedó gris, `Aprobar` verde y `Rechazar` rojo en la sección de aprobaciones.
- Se eliminó la tarjeta `Estado operativo`.
- Se eliminó la sección `Ultimas solicitudes realizadas`.
- `Mis solicitudes` bajó a una sección propia y ahora muestra:
  - folio
  - cargo solicitado
  - contrato
  - vacantes
- `Solicitud de Contrataciones` redistribuyó `Nombre solicitante`, `Cargo solicitante` y `Correo solicitante` en una grilla superior más compacta, y dejó `Cargo solicitado`, `Vacantes` y `Fecha solicitada ingreso` compartiendo la siguiente franja horizontal.
- `npm run build`: correcto

## Integración inicial de login con Supabase

- [x] Definir variables de entorno locales para `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
- [x] Instalar `@supabase/supabase-js`
- [x] Crear cliente Supabase reusable para el frontend
- [x] Crear contexto de autenticación con sesión persistente
- [x] Proteger rutas privadas y aislar `/login` como ruta pública
- [x] Conectar la pantalla de login al flujo real de `signInWithPassword`
- [x] Validar compilación TypeScript
- [x] Validar build de Vite
- [x] Documentar resultado de verificación y siguiente paso del módulo

## Revisión final

- [x] Confirmar que el proyecto compila sin errores
- [x] Confirmar que el build finaliza correctamente
- [x] Dejar siguiente paso explícito: modelado SQL de auth/perfiles/catálogos para `Solicitud de Contrataciones`

## Resultado de verificación

- `npx tsc --noEmit`: correcto
- `npm run build`: correcto
- Se implementó carga diferida por rutas para reducir el bundle principal de `541.52 kB` a `382.05 kB`
- El siguiente paso técnico es crear el esquema SQL inicial de Supabase para:
  - `profiles`
  - `job_positions`
  - `contracts`
  - `shifts`
  - `hiring_requests`

## Endurecimiento de acceso y recuperación

- [x] Eliminar cualquier vía alternativa de ingreso distinta al flujo real de `Continuar`
- [x] Agregar flujo útil de recuperación/reinicio de contraseña con Supabase
- [x] Restringir visibilidad de módulos por rol con política por defecto restrictiva
- [x] Restringir acceso por ruta a módulos no autorizados
- [x] Revalidar compilación y build después del endurecimiento

## Resultado de verificación 2

- `npx tsc --noEmit`: correcto
- `npm run build`: correcto
- Se agregó:
  - `/reset-password`
  - `/sin-acceso`
  - gating por rol en navegación y rutas
- Recordatorio operativo:
  - Cloudflare Pages debe tener `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` configuradas en variables de entorno; de lo contrario, `Continuar` no podrá autenticar contra Supabase

## Base robusta de usuarios y permisos

- [x] Definir un esquema formal de perfiles, roles y acceso a módulos en Supabase
- [x] Materializar ese esquema en una migración SQL dentro del proyecto
- [x] Documentar qué datos debe tener cada usuario futuro
- [x] Documentar cómo poblar los dos primeros usuarios de prueba
- [ ] Ejecutar la migración en Supabase
- [ ] Cambiar el frontend para que lea roles desde tablas reales en vez de metadata temporal

## Revisión profunda y limpieza

- [x] Revisar residuos funcionales de la etapa SharePoint/Microsoft 365 dentro del frontend activo
- [x] Migrar autorización del frontend desde metadata/allowlist a tablas reales de Supabase
- [x] Optimizar carga de autorización reduciendo round-trips evitables
- [x] Revalidar compilación y build después de la limpieza

## Resultado de revisión profunda

- Se eliminaron dependencias temporales de autorización por correo y metadata.
- La app ya toma visibilidad de módulos y acceso por ruta desde:
  - `profiles`
  - `user_roles`
  - `role_module_access`
  - `app_modules`
- Se limpiaron textos activos del frontend que seguían apuntando a SharePoint/Microsoft 365.
- Se optimizó la carga inicial de autorización leyendo perfil y roles en paralelo.
- Quedan fuera del build, pero siguen presentes en el repo como archivos no versionados:
  - `GeneradordeCertificados_20260417034937/`
  - `certificado_tipo_rev02.docx`
  - `generador_de_certificados_rev02.xlsx`

## Solicitud de Contrataciones con datos reales

- [x] Regenerar catálogos locales de `cargo solicitado` y `contratos` desde `cargos.xlsx` y `bbdd-cecos.xlsx`
- [x] Ajustar el formulario para tomar `nombre`, `correo` y `cargo` del usuario autenticado
- [x] Eliminar `Gerente del área` del modelo, formulario y resumen de la solicitud
- [x] Mantener campos `Sí/No` como selección controlada
- [x] Verificar si este cambio requiere extensión de autorización en Supabase
- [x] Revalidar compilación y build después del ajuste

## Resultado de Solicitud de Contrataciones con datos reales

- `Nombre solicitante`, `Cargo solicitante` y `Correo solicitante` ahora salen del usuario autenticado mediante `useAuth()`.
- `Cargo solicitado` quedó regenerado desde `cargos.xlsx`.
- `Nombre de contrato` y los datos autocompletables quedaron regenerados desde `bbdd-cecos.xlsx` usando:
  - `Proyecto`
  - `Descripcion Proyecto`
  - `Unidad de Costo`
  - `Descripción Unidad de Costo`
  - `Centro de Costo`
  - `Descripción Centro de Costo`
- `Gerente del área` fue eliminado del tipo, formulario, resumen y catálogo local.
- Los campos `Sí/No` se mantienen como selección controlada.
- Revisión de autorización:
  - no fue necesario extender `app_modules`, `role_module_access`, `app_roles` ni `profiles`, porque no se agregó un módulo nuevo ni un nuevo perfil operativo.
- `npx tsc --noEmit`: correcto
- `npm run build`: correcto

## Solicitud de Contrataciones sobre Supabase

- [x] Definir tablas y seeds de Supabase para `cargo solicitado`, `contratos`, `turnos` y base de solicitudes
- [x] Cambiar el frontend para leer catálogos del módulo directamente desde Supabase
- [x] Eliminar dependencia funcional de CSV locales en este módulo
- [x] Verificar si el ajuste exige cambios en autorización del módulo
- [x] Revalidar compilación y build después de la migración

## Resultado de Solicitud de Contrataciones sobre Supabase

- Se agregó la migración [20260515_000002_hiring_module_foundation.sql](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260515_000002_hiring_module_foundation.sql:1) con:
  - `job_positions`
  - `contracts`
  - `shifts`
  - `hiring_requests`
  - seeds iniciales para cargos, contratos y turnos
  - políticas RLS para lectura de catálogos y operación base de solicitudes
- `HiringRequestPage` ahora lee cargos, contratos y turnos desde Supabase usando [hiringCatalogs.ts](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/services/hiringCatalogs.ts:1).
- El módulo ya no depende funcionalmente de los CSV locales de contratación, aunque los archivos siguen presentes en el repo y se pueden eliminar en una pasada de limpieza posterior.
- Revisión de autorización:
  - no fue necesario extender `app_modules`, `role_module_access`, `app_roles` ni `profiles`, porque el módulo y los perfiles operativos ya existían.
- `npx tsc --noEmit`: correcto
- `npm run build`: correcto

## Persistencia y aprobaciones de contrataciones

- [x] Extender el esquema de Supabase para soportar aprobaciones de solicitudes de contratación
- [x] Agregar mecanismo de creación real de solicitudes en base de datos
- [x] Dejar la solicitud en estado `pendiente` mientras falten aprobaciones requeridas
- [x] Preparar estructura para que `Control de Contrataciones` lea el requerimiento base desde la misma fuente
- [x] Verificar si este ajuste exige cambios en autorización o roles
- [x] Revalidar compilación y build después del ajuste

## Resultado de persistencia y aprobaciones de contrataciones

- Se agregó la migración [20260515_000003_hiring_request_approvals.sql](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260515_000003_hiring_request_approvals.sql:1) con:
  - `hiring_approval_configs`
  - `hiring_request_approvals`
  - función `refresh_hiring_request_status(...)`
  - RPC `create_hiring_request(...)`
  - RPC `decide_hiring_request_approval(...)`
- `Solicitud de Contrataciones` ya no solo arma un resumen local: ahora quedó preparada para guardar el requerimiento completo en Supabase usando [hiringRequests.ts](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/services/hiringRequests.ts:1).
- La lógica de estado quedó definida así:
  - `pendiente` mientras falte la aprobación operativa o de control de contratos
  - `rechazada` si cualquier aprobación requerida rechaza
  - `aprobada` si las tres etapas requeridas quedan aprobadas
- La misma tabla `hiring_requests` queda como fuente maestra para que `Control de Contrataciones` lea el requerimiento base.
- Revisión de autorización:
  - no fue necesario extender `app_modules`, `role_module_access`, `app_roles` ni `profiles`, porque se reutilizan los perfiles y módulos ya existentes
  - las aprobaciones quedan controladas por asignación de usuario en `hiring_approval_configs`
- `npx tsc --noEmit`: correcto
- `npm run build`: correcto

## Refinamiento de Inicio para aprobaciones

- [x] Corregir lectura de roles desde el esquema real de `user_roles`
- [x] Hacer visible la bandeja de aprobaciones para `admin` y `aprobador_folios`
- [x] Agregar vista de detalle del requerimiento desde `Inicio`
- [x] Ajustar composición visual y jerarquía de botones para la aprobación
- [x] Completar detalle con renta, campamento, pasajes y beneficios
- [x] Revalidar compilación y publicar el ajuste visual

## Responsividad de Inicio

- [x] Reducir presión visual del shell lateral en laptops pequeñas

## Corrección estructural de shell superior y módulos Operativos

- [x] Corregir la interacción del mega menú superior para que los submódulos de `Reclutamiento` y `Operaciones` sean clickeables
- [x] Eliminar la barra lateral interna del módulo `Operaciones` y reestructurarlo bajo el shell superior común
- [x] Renombrar `Inicio` a `Resumen` en `Operaciones` y alinear sus submódulos al patrón de navegación superior
- [x] Corregir el calendario de `Operaciones` para que tenga fondo opaco y contraste legible
- [x] Reequilibrar `Solicitud de Contrataciones` para que el resumen lateral no empuje visualmente el formulario
- [x] Documentar la revisión de concordancia del módulo `Operaciones` con la arquitectura general
- [x] Revalidar compilación y preparar deploy verificado

## Resultado de corrección estructural de shell superior y módulos Operativos

- El mega menú superior ahora usa un contenedor de referencia que incluye tanto la barra como el panel flotante, evitando que el detector de click externo cierre el menú antes de navegar.
- `Reclutamiento` y `Operaciones` comparten ahora el mismo patrón de submódulos flotantes en la barra superior.
- `Operaciones` dejó de comportarse como una mini app interna:
  - se eliminó la barra lateral negra
  - los filtros y métricas se movieron a tarjetas contextuales dentro del área principal
  - `Inicio` pasó a `Resumen`
- El selector de fecha de `Operaciones` quedó con fondo opaco y contraste legible.
- `Solicitud de Contrataciones` se reequilibró:
  - el resumen volvió a una columna lateral limpia
  - el `hero` superior se compactó
  - se eliminaron bloques duplicados de unidad/centro de costo que estaban alargando la página
- Revisión de concordancia y autorización:
  - no fue necesario extender `app_modules` ni `role_module_access`
  - todos los submódulos de `Operaciones` siguen agrupados bajo `moduleCode: "operaciones"`
  - `Recursos Humanos` mantiene su propio `moduleCode` separado
- `npm run build`: correcto

## Ajuste de densidad del shell superior y hero de contratación

- [x] Compactar la barra superior al patrón visual de referencia
- [x] Retirar el marcador temporal de build del módulo de contratación
- [x] Reducir altura del hero y densidad del resumen lateral
- [x] Revalidar compilación

## Resultado de ajuste de densidad

- La barra superior redujo altura útil y padding para acercarse al patrón compacto de referencia.
- El mega menú mantiene iconos y estructura flotante, pero con una densidad más controlada.
- `Solicitud de Contrataciones` eliminó el marcador temporal, bajó la altura del hero y compactó el resumen lateral para que el formulario arranque antes.
- `npm run build`: correcto

## Corrección de login, overlays de calendario y shell superior

- [x] Corregir el layout del login para que colapse correctamente en pantallas más estrechas
- [x] Asegurar que los calendarios flotantes queden sobre tarjetas y resúmenes adyacentes
- [x] Convertir el shell superior en una barra plana continua pegada al borde superior
- [x] Revalidar compilación

## Resultado de corrección de login, overlays y shell

- El login ahora tiene un breakpoint real para pasar de dos columnas a una sola antes de que una mitad se degrade visualmente.
- Los calendarios de selección de fecha quedaron por encima de cajas y paneles vecinos tanto en Reclutamiento como en Operaciones.
- La navegación superior dejó de estar encapsulada en una cápsula redondeada y pasó a una barra continua pegada al borde superior del lienzo.
- `npm run build`: correcto
- [x] Hacer que las grillas de `Inicio` colapsen antes para evitar hacinamiento
- [x] Reacomodar cards y acciones de aprobaciones para pantallas medianas y móviles
- [x] Revalidar compilación y publicar el ajuste responsivo

## Estrategia de despliegue en Cloudflare

- [x] Revisar si la app requiere runtime dinámico o si puede desplegarse como sitio estático
- [x] Identificar la causa exacta del fallo de deploy observado en Cloudflare
- [x] Definir la configuración correcta de Cloudflare para este repo
- [x] Documentar el flujo operativo de despliegue y variables requeridas

## Resultado de estrategia de despliegue en Cloudflare

- La app actual no requiere Worker ni runtime Node en producción; el backend ya vive en Supabase y el frontend compila a `dist/`.
- El fallo de deploy no está en la app ni en el build de Vite: proviene de ejecutar `npx wrangler deploy`, que intenta autodetectar un flujo de Worker/Framework y exige `Vite >= 6`.
- Para este repo, el modo correcto es `Cloudflare Pages` con:
  - `Build command`: `npm run build`
  - `Build output directory`: `dist`
  - sin `Deploy command`
- Variables mínimas requeridas en Cloudflare:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- Se documentó el procedimiento operativo en `docs/deploy-cloudflare-pages.md`.

## Estructura de barra lateral adaptable

- [x] Eliminar el patrón de submódulos flotantes del shell lateral
- [x] Volver a integrar submódulos dentro de la barra lateral
- [x] Hacer que el ancho lateral se adapte al contenido abierto en vez de truncar o romper textos
- [x] Revalidar compilación después del cambio estructural

## Resultado de estructura de barra lateral adaptable

- Los submódulos volvieron a renderizarse dentro de la barra lateral; ya no usan panel flotante sobre el contenido principal.
- El ancho del shell lateral ahora se calcula desde el contenido visible de navegación y se expande o contrae según la sección abierta.
- Se mantuvo la regla visual del proyecto:
  - una sola línea
  - sin cortes en dos líneas
  - sin acortar nombres por diseño cuando el shell puede ceder ancho

## Reconfiguración ancha de Solicitud de Contrataciones

- [x] Reestructurar el formulario para usar el ancho libre dejado por la barra superior
- [x] Mover el hero y el resumen a la franja superior útil del workspace
- [x] Reasignar anchos de grilla por prioridad para solicitante, cargo, correo, contrato y número de contrato
- [x] Recompactar labels y campos sin saltos de línea ni filas dobles
- [x] Revalidar compilación después del refactor

## Resultado de reconfiguración ancha

- `Solicitud de Contrataciones` dejó de usar una composición heredada de la época de barra lateral.
- El `hero-panel` ahora vive dentro del `workspace` principal y el resumen lateral ocupa la franja derecha superior en vez de dejar media pantalla vacía.
- La grilla superior fue redistribuida por prioridad real:
  - `Nombre solicitante`, `Cargo solicitante` y `Correo solicitante` reciben más ancho útil
  - `Cargo solicitado`, `Numero de Vacantes` y `Fecha solicitada ingreso` quedaron balanceados para mantener una sola línea
  - `Nombre de contrato` y `Numero contrato` ahora comparten la misma fila
- Se reorganizaron también:
  - `Fecha inicio`, `Fecha termino`, `Turno`
  - `Campamento`, `Pasajes`, `Renta liquida ofrecida`
- `npm run build`: correcto

## Ajuste de separación entre shell superior y contenido

- [x] Corregir la reserva vertical del header sticky para evitar que el contenido quede visualmente debajo de la barra
- [x] Alinear el resumen lateral con la franja superior del formulario sin invadir el shell
- [x] Revalidar compilación después del ajuste

## Resultado de ajuste de separación

- El shell superior ahora reserva altura real coherente con su volumen visual.
- Se eliminó el efecto de solapamiento entre la barra superior y la primera franja de `Solicitud de Contrataciones`.
- El resumen lateral se desplazó levemente para alinearse con el hero sin invadir el header.
- `npm run build`: correcto

## Reposición estructural del resumen lateral

- [x] Separar el hero superior de la fila donde conviven formulario y resumen
- [x] Mantener el resumen lateral usando la banda derecha, pero sin competir con el hero
- [x] Revalidar compilación

## Resultado de reposición estructural

- El hero de `Solicitud de Contrataciones` vuelve a ocupar una franja superior completa.
- El formulario y el resumen ahora conviven recién en la segunda fila del workspace.
- Se elimina la sensación de superposición entre el resumen de la derecha y la cabecera del módulo.
- `npm run build`: correcto

## Compactación del detalle de aprobación

- [x] Reconfigurar la grilla del detalle para dar prioridad de ancho a campos largos
- [x] Reducir altura visual de burbujas y ajustar tipografía para mayor densidad
- [x] Eliminar cortes visibles en `Solicitante` y `Número contrato`
- [x] Revalidar compilación después del ajuste

## Resultado de compactación del detalle de aprobación

- La grilla del detalle dejó de usar celdas uniformes y pasó a una composición proporcional de 12 columnas.
- `Solicitante`, `Cargo solicitado` y `Número contrato` recibieron más ancho estructural que `Folio` y `Vacantes`.
- Las burbujas se adelgazaron aproximadamente un 30% mediante reducción de padding, radio y tipografía.
- Los chips informativos también quedaron más compactos para sostener la limpieza visual del panel.
- `npm run build`: correcto

## Auditoría técnica, seguridad y limpieza base

- [ ] Endurecer navegación protegida según estado real del perfil y obligación de reseteo de clave
- [ ] Eliminar fragilidad entre frontend y RPC de contratación por deriva `v1`/`v2`
- [ ] Limpiar redundancias de tipos/consultas en el dashboard de aprobaciones
- [ ] Ejecutar validaciones técnicas y documentar hallazgos de seguridad/dependencias

## Compactación estructural del formulario de contratación

- [x] Definir una grilla específica para `hero`, `formulario` y `resumen`
- [x] Compactar el resumen lateral para que no empuje visualmente el formulario hacia abajo
- [x] Reducir altura del bloque hero sin perder jerarquía visual
- [x] Revalidar compilación después del ajuste

## Resultado de compactación estructural

- `Solicitud de Contrataciones` dejó de depender de una composición implícita del shell; ahora usa una grilla dedicada para `hero`, `formulario` y `resumen`.
- El panel de resumen lateral fue reducido a un set corto de campos clave y a una malla de dos columnas para no generar una lista vertical innecesariamente larga.
- El hero se compactó para liberar altura útil y hacer que los primeros controles del formulario aparezcan antes.
- `npm run build`: correcto

## Ajuste fino del resumen y campo de renta

- [x] Reubicar correctamente el sufijo `$` del campo `Renta liquida ofrecida`
- [x] Volver el resumen lateral a una sola columna vertical
- [x] Ceder algo de ancho del formulario para mejorar lectura del resumen
- [x] Revalidar compilación

## Resultado de ajuste fino del resumen y renta

- El símbolo `$` quedó anclado al control de renta y ya no al bloque completo del campo.
- El resumen lateral volvió a una sola columna de lectura continua.
- La columna izquierda del formulario cedió ancho suficiente para que el resumen use la altura lateral completa sin compactarse en dos columnas.
- `npm run build`: correcto

## Corrección de desborde del formulario bajo el resumen

- [x] Eliminar mínimos rígidos acumulados en las subgrillas internas del formulario
- [x] Forzar `min-width: 0` en grupos de campo y fecha
- [x] Revalidar compilación

## Resultado de corrección de desborde

- Las grillas internas del formulario dejaron de empujar contenido hacia la columna del resumen.
- `Nombre solicitante`, `Cargo solicitante`, `Correo solicitante`, `Cargo solicitado` y las filas siguientes ahora ceden ancho entre sí en vez de invadir el panel derecho.
- `npm run build`: correcto

## Corrección del layout lateral en Generador de Certificados

- [x] Aislar una grilla propia para `Generador de Certificados`
- [x] Evitar que el formulario reutilice la grilla lateral de contratación
- [x] Revalidar compilación

## Resultado de corrección en certificados

- `Generador de Certificados` ahora usa una grilla específica para su relación `formulario/resumen`.
- Se evita arrastrar la misma tensión de layout que tenía `Solicitud de Contrataciones`.
- `npm run build`: correcto


## Ajuste fino de shell superior y submenús rectos

- [x] Corregir estado activo para que `Inicio` solo aparezca seleccionado en `/`
- [x] Agrandar y reposicionar el logo JM arriba a la izquierda del header
- [x] Reemplazar el globo de submenús por panel rectangular alineado al header y con separadores
- [x] Eliminar sombra del estado activo y dejar solo contorno del menú seleccionado
- [x] Revalidar compilación y empujar a `main`

## Resultado de ajuste fino de shell superior y submenús rectos

- `Inicio` ya no queda falsamente activo fuera de `/`; ahora usa coincidencia exacta.
- El logo JM del header superior ganó tamaño y quedó anclado más arriba y a la izquierda dentro de su bloque.
- Los submenús dejaron de abrirse como cápsulas redondeadas y ahora usan un panel rectangular continuo, sin sombra y con separadores entre opciones.
- Los menús seleccionados mantienen solo el contorno/cápsula de selección, sin sombras activas.
- `npm run build`: correcto


## Ajuste visual Mailgun del header superior

- [x] Eliminar cápsulas por defecto en módulos superiores y dejar solo selección por línea azul inferior
- [x] Convertir submenús en panel limpio sin tarjetas internas ni globos
- [x] Mantener iconos y texto alineados con jerarquía editorial simple
- [x] Revalidar compilación y empujar a `main`

## Resultado de ajuste visual Mailgun del header superior

- Los módulos superiores dejaron de verse como botones/cápsulas por defecto; ahora son texto limpio y solo el seleccionado muestra línea azul inferior.
- Los submenús quedaron como panel limpio, sin cuadros internos ni globos alrededor de cada opción.
- Se mantuvieron iconos y copy, pero con jerarquía visual más plana y editorial.
- `npm run build`: correcto


## Barrido profundo de limpieza, rendimiento y seguridad

- [x] Ejecutar verificación técnica base (`build`, `npm audit`) y capturar hallazgos
- [x] Detectar archivos, assets y catálogos residuales que no tengan referencias reales
- [x] Eliminar residuos seguros y simplificar código/configuración redundante
- [x] Ajustar puntos de rendimiento o mantenibilidad de bajo riesgo encontrados en la pasada
- [ ] Documentar lecciones, revalidar build y empujar a `main`

## Hallazgos iniciales del barrido

- `npm audit --omit=dev` detectó 1 vulnerabilidad alta en `xlsx`; no tiene fix publicado desde upstream.
- Hay duplicidad de assets entre `src/assets` y `public/assets`. Las copias públicas de:
  - `app-logo.png`
  - `certification-icon.png`
  - `recruiting-icon.png`
  - `status-success.png`
  no tienen ya consumidores directos necesarios fuera de runtime legado.
- Los catálogos locales:
  - `src/shared/data/cargosSolicitud.csv`
  - `src/shared/data/contratosSolicitud.csv`
  - `src/shared/data/turnosSolicitud.csv`
  quedaron sin referencias tras migrar Reclutamiento a Supabase.
- El paquete exportado de Power Automate/SharePoint y su script de provisión siguen versionados, pero ya no forman parte del runtime actual de la app.

## Resultado del barrido profundo

- Se eliminaron catálogos locales de Reclutamiento ya reemplazados por Supabase:
  - `src/shared/data/cargosSolicitud.csv`
  - `src/shared/data/contratosSolicitud.csv`
  - `src/shared/data/turnosSolicitud.csv`
- Se eliminaron artefactos heredados de SharePoint/Power Automate:
  - `scripts/sharepoint/provision-certificates-lists.ps1`
  - `GeneradordeCertificados_20260417034937/`
  - documentación operativa SharePoint específica asociada
- Se consolidó el logo de `Operaciones` para usar el asset empaquetado de `src/assets` en vez de la copia pública duplicada.
- Se eliminaron copias públicas no utilizadas de:
  - `app-logo.png`
  - `certification-icon.png`
  - `recruiting-icon.png`
  - `status-success.png`
- `npm run build`: correcto
- No se detectaron secretos hardcodeados en runtime; las referencias encontradas a claves son nombres de variables/documentación o lectura desde entorno.
- Riesgo/vulnerabilidad pendiente:
  - `xlsx` mantiene 1 vulnerabilidad alta reportada por `npm audit --omit=dev`
  - no existe fix publicado desde upstream; el paquete sigue aislado por import dinámico solo en el exportador de `Operaciones`
- Deuda técnica detectada y no tocada en esta pasada por riesgo de regresión:
  - `// @ts-nocheck` sigue presente en:
    - `src/modules/operaciones/pages/OperacionesDashboard.tsx`
    - `src/modules/operaciones/services/operacionesApi.ts`
    - `src/modules/operaciones/lib/service-entry.ts`
    - `src/modules/operaciones/data/services-data.ts`


## Ajuste de contenido e iconografía del login

- [x] Cambiar textos solicitados del panel izquierdo y del pie derecho del login
- [x] Corregir contraste del texto inferior izquierdo para que sea blanco
- [x] Integrar iconos `operacion.png` y `recursos-humanos.png` con tamaño consistente
- [x] Convertir `Maximiliano Contreras` en enlace `mailto:`
- [x] Revalidar compilación y empujar a `main`

## Resultado de ajuste de contenido e iconografía del login

- El texto inferior del panel izquierdo volvió a blanco/alto contraste sobre el fondo rojo.
- Se reemplazaron los dos textos solicitados del bloque de beneficios y se integraron los iconos `operacion.png` y `recursos-humanos.png`.
- El pie derecho ahora dice `Plataforma diseñada por Maximiliano Contreras.` y el nombre abre `mailto:max.contrerasrey@icolud.com`.
- `npm run build`: correcto


## Consolidación versionada de `create_hiring_request_v2`

- [x] Revisar la deriva entre el SQL de producción y las migraciones versionadas del repo
- [x] Formalizar `create_hiring_request_v2` en una migración nueva
- [x] Alinear dependencias directas de la RPC (`area_manager` vs `operational_approval`) para que un entorno nuevo no nazca inconsistente
- [x] Documentar la deriva detectada y la corrección aplicada
- [x] Revalidar compilación y empujar a `main`

## Resultado de consolidación de `create_hiring_request_v2`

- Se agregó la migración [20260519_000005_consolidate_hiring_request_v2.sql](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260519_000005_consolidate_hiring_request_v2.sql:1) para convertir en código versionado lo que hasta ahora solo existía en la base de producción.
- La migración no solo define `public.create_hiring_request_v2(...)`; también corrige la deriva inmediata que la rompía en entornos nuevos:
  - renombra `operational_approval` a `area_manager`
  - ajusta los `check constraints` de `hiring_approval_configs` y `hiring_request_approvals`
  - reemplaza `refresh_hiring_request_status(...)` para usar los códigos reales del flujo actual
  - deja `grant execute` formal para la RPC usada por el frontend
- El frontend sigue usando [hiringRequests.ts](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/services/hiringRequests.ts:1) sin cambios funcionales; la corrección se hizo en la capa correcta: el esquema versionado.
- `npm run build`: correcto


## Rediseño integral premium y consistente

- [x] Auditar shell, tokens globales, patrones de layout y deuda visual transversal
- [x] Redefinir design system global con tipografía, color, spacing y superficies coherentes
- [x] Rehacer navegación superior y submenús al patrón editorial enterprise solicitado
- [x] Unificar `Login`, `Inicio`, `Solicitud de Contrataciones`, `Control de Contrataciones`, `Certificados` y placeholders bajo el mismo lenguaje visual
- [x] Normalizar formularios, tablas, resúmenes laterales y estados
- [x] Revalidar compilación y revisar resultado final

### Revisión final

- Se eliminó la dependencia visual de `Inter` en el arranque y se unificó la app sobre una paleta neutra con acento funcional azul.
- El shell superior pasó a una navegación plana de estilo enterprise con submenús rectos y densidad visual más baja.
- `Login`, `Inicio`, `Solicitud de Contrataciones`, `Control de Contrataciones`, `Certificados` y paneles compartidos quedaron sobre el mismo sistema de superficies, radios, bordes y foco.
- Se detectó y corrigió fuga de estilos en `Operaciones`: el módulo redefinía `:root` y selectores genéricos como `label`, `input`, `select`, `textarea`, `login-shell` y `loading-shell`, contaminando el resto de la app tras navegar.
- Validación técnica ejecutada:
  - `npx tsc -b`
  - `npx vite build`


## Ajuste de resumen operativo en `Inicio`

- [x] Reemplazar la columna `Fecha` por una métrica de antigüedad en `Mis solicitudes`
- [x] Mantener el cálculo en frontend usando `created_at` ya disponible en el resumen
- [x] Revalidar compilación y dejar documentada la preferencia operacional

## Resultado de ajuste de resumen operativo en `Inicio`

- La tabla `Mis solicitudes` ahora muestra `Dias desde solicitud` en vez de una fecha fija.
- El cálculo usa la diferencia entre el inicio del día actual y el inicio del día de creación para evitar variaciones por hora.
- Se documentó la regla en `tasks/lessons.md`: para dashboards operacionales, la antigüedad es más útil que la fecha cruda cuando se busca priorización rápida.


## Provisionamiento definitivo de aprobadores desde Excel

- [x] Revisar la estructura real de `Hoja1` y mapear columnas a `auth.users`, `profiles`, `user_roles`, `cost_center_approvers` y `workflow_approvers`
- [x] Confirmar los roles y relaciones necesarias para `Aprobador Area` y `Aprobador Control de Contratos` en el esquema actual
- [x] Generar un script definitivo de provisión recomendado para Supabase Auth + tablas de aplicación
- [x] Entregar el script en una sola pieza, listo para ejecutar, con validaciones y orden de ejecución claro
- [x] Documentar el cierre y los supuestos operativos

## Resultado de provisionamiento definitivo de aprobadores desde Excel

- Se creó [scripts/provision-hiring-approvers.mjs](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/scripts/provision-hiring-approvers.mjs), un aprovisionador idempotente que:
  - lee `Hoja1` del Excel
  - crea o actualiza usuarios en Supabase Auth mediante `auth.admin`
  - sincroniza `profiles`
  - asigna `user_roles`
  - vincula `cost_center_approvers`
  - vincula `workflow_approvers` para `contracts_control`
- Se agregó el comando `npm run provision:hiring-approvers`.
- El mapeo de roles quedó así:
  - `Aprobador Area` -> `aprobador_folios`
  - `Aprobador Control de Contratos` -> `control_contratos` + `aprobador_folios`
- Si el usuario ya existe en Auth, el script lo actualiza por email y agrega los roles faltantes sin borrar roles previos. Eso cubre tu caso: el usuario administrador existente puede seguir siendo `admin` y además quedar como aprobador de `GERENCIA OPERACIONES ZONA II (NORTE INTERIOR)`.
- El script exige `SUPABASE_SERVICE_ROLE_KEY` para la ejecución real y permite `--dry-run` para validar el archivo antes de escribir.
- Validación ejecutada:
  - lectura real de `Hoja1` con 12 usuarios esperados
  - `node --check scripts/provision-hiring-approvers.mjs`
- Supuestos operativos:
  - las contraseñas del Excel son bootstrap passwords
  - el script deja `must_reset_password = true`
  - la carga de módulos/permisos base ya existe en la base actual


## Corrección de cambio forzado de contraseña para usuarios aprovisionados

- [x] Revisar el flujo actual de `must_reset_password` versus recuperación por correo
- [x] Permitir cambio de contraseña desde sesión autenticada sin exigir `recovery mode`
- [x] Limpiar `must_reset_password` al completar el cambio exitoso
- [x] Validar compilación y documentar la lección

## Resultado de corrección de cambio forzado de contraseña para usuarios aprovisionados

- La causa raíz estaba en [ResetPasswordPage.tsx](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/auth/pages/ResetPasswordPage.tsx): la vista usaba el mismo formulario para recuperación por correo y para cambio forzado por `must_reset_password`, pero bloqueaba el submit si `isRecoveryMode` era `false`.
- Se corrigió el flujo para aceptar también el caso de sesión autenticada normal con `must_reset_password = true`.
- En [AuthContext.tsx](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/auth/context/AuthContext.tsx) el cambio de contraseña ahora además limpia `profiles.must_reset_password = false`, evitando el loop de redirección a `/reset-password`.
- Validación ejecutada:
  - `npx tsc -b`
  - `npm run build`


## Hotfix de columnas faltantes en `hiring_request_approvals`

- [x] Confirmar la deriva real entre la RPC desplegada y el esquema productivo de `hiring_request_approvals`
- [x] Agregar migración idempotente para `approver_name` y `approver_email`
- [x] Empujar el hotfix al repo y dejar SQL exacto para aplicar en Supabase

## Resultado de corrección de carga de aprobaciones en `Inicio`

- La solicitud y su asignación estaban correctas en base:
  - `status = pending_area_manager`
  - `current_step_code = area_manager`
  - `approver_user_id = 0de4ef6f-3e52-4bab-8042-ab04ea7763ae`
- La falla estaba en el frontend de [HomePage.tsx](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/home/pages/HomePage.tsx): la bandeja dependía de un `select` con `hiring_requests!inner(...)`, y ante error de esa relación/embebido vaciaba también `Mis solicitudes`.
- Se reemplazó por una carga en dos pasos:
  - primero `hiring_request_approvals`
  - luego `hiring_requests` por `id`
  - unión en frontend
- Validación ejecutada:
  - `npx tsc -b`
  - `npm run build`


## Corrección de recursión RLS entre `hiring_requests` y `hiring_request_approvals`

- [ ] Confirmar la dependencia circular entre las policies de selección
- [ ] Agregar migración que simplifique `hiring_request_approvals_select_scoped`
- [ ] Empujar el ajuste y dejar SQL exacto para aplicar en Supabase


## Consolidación del resumen de `Inicio` por RPC segura

- [x] Reemplazar las consultas client-side dispersas por una RPC `security definer` para el dashboard de inicio
- [x] Actualizar `HomePage.tsx` para consumir la RPC y dejar de depender de joins/RLS complejos
- [x] Validar build y empujar el ajuste

## Resultado de consolidación del resumen de `Inicio` por RPC segura

- Se agregó [20260520_000009_add_home_dashboard_summary_rpc.sql](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260520_000009_add_home_dashboard_summary_rpc.sql), que crea `public.get_home_dashboard_summary()` como RPC `security definer`.
- [HomePage.tsx](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/home/pages/HomePage.tsx) dejó de depender de múltiples consultas RLS desde cliente y ahora consume una sola RPC con:
  - `my_requests`
  - `pending_approvals`
- Esto elimina la fragilidad del resumen ante recursiones o joins problemáticos de PostgREST/RLS.
- Validación ejecutada:
  - `npx tsc -b`
  - `npm run build`
