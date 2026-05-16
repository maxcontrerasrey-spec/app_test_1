# Lecciones del proyecto

## 2026-05-14

- Cuando se integre un proveedor real de autenticación, la tarea no se considera terminada hasta validar compilación, build y comportamiento base de rutas protegidas.
- En Supabase, el `Project URL` para el cliente frontend es la raíz del proyecto (`https://<project-ref>.supabase.co`), no el endpoint REST `/rest/v1/`.
- Las variables `VITE_*` deben quedar fuera de Git y documentadas temprano para evitar mezclar configuración local con despliegue.
- Si el login se despliega en Netlify sin `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`, el frontend queda visualmente listo pero funcionalmente inerte; la configuración del entorno forma parte del criterio de terminado.
- La autorización no se resuelve solo con sesión iniciada: navegación y rutas deben operar con política por defecto restrictiva hasta que exista una capa formal de roles en base de datos.
- La recuperación de contraseña debe ser real o no existir; un enlace decorativo en login genera una falsa sensación de funcionalidad.
- No usar hover como mecanismo principal para acciones críticas en menús de usuario; si hay acciones como `Cerrar sesión`, el menú debe mantenerse estable por clic y cerrarse por click afuera o acción explícita.
- Cada vez que se agregue un módulo nuevo a la app, debe revisarse explícitamente si corresponde extender la base de datos de autorización (`app_modules`, `role_module_access`, y eventualmente `app_roles` o `profiles`). No dar por terminado un módulo nuevo sin esa verificación.
- Los controles de inactividad deben implementarse en la capa central de auth/sesión, no dentro de pantallas aisladas. Si la sesión caduca por inactividad, el comportamiento debe ser consistente para toda la app.
- Si un catálogo depende de datos cargados de forma asíncrona, no usar `useMemo` con dependencias vacías para derivar sus opciones. Eso congela el estado inicial y deja selects aparentemente vacíos aunque la consulta haya respondido bien.
- Si el esquema real diverge del esperado en frontend, no asumir nombres de columnas como `role_code`; la integración debe tolerar transiciones controladas como `role` vs `role_code` cuando la base todavía está en consolidación.
- Cuando se agreguen acciones nuevas al dashboard, no resolver la composición con estilos inline. Integrar clases en `global.css` y asegurar que el detalle muestre todos los datos relevantes para decidir, no solo un subconjunto mínimo.
- En esta app, la regla visual para navegación lateral y datos compactos es una sola línea. Si un texto largo no cabe, debe truncarse con elipsis; no permitir saltos de línea en sidebar ni en tarjetas compactas salvo que el usuario pida lo contrario.
- No apilar la barra lateral arriba del contenido demasiado pronto. En pantallas medianas debe seguir lateral con un ancho más estrecho, y recién pasar a modo vertical en un breakpoint menor; si se apila antes, rompe la jerarquía y degrada la percepción de calidad.
- En la navegación lateral, no basta con `white-space: nowrap`; los toggles de sección y subitems deben usar una columna flexible explícita (`minmax(0, 1fr)`) y `overflow: hidden` en el contenedor. Si no, al expandir módulos el texto vuelve a partirse y distorsiona la barra.
- En Cloudflare, esta app debe desplegarse como `Pages` estática y no con `npx wrangler deploy`. Si Cloudflare intenta tratar el repo como Worker/Framework, el error de Vite es un síntoma de configuración incorrecta, no de la app.
- En esta app no usar submódulos flotantes en la barra lateral. Si los nombres crecen, la barra roja debe expandirse y ceder ancho al contenido principal; el submenú debe seguir siendo parte de la barra, no un flyout.
- En tarjetas compactas con datos heterogéneos, no usar columnas uniformes por defecto. Campos como `Solicitante`, `Cargo solicitado` y `Número contrato` necesitan más ancho estructural que `Folio` o `Vacantes`; la solución correcta es una grilla proporcional, no truncar indiscriminadamente.
- Regla operativa de raíz del proyecto: no dejar cambios funcionales solo en local. Si un cambio ya fue implementado y validado, debe cerrarse con `git add`, `git commit` y `git push` para que el deploy refleje el estado real del trabajo.
- Regla visual central de la app: la navegación principal debe aprovechar el ancho horizontal con barra superior, la paleta base debe mantenerse en Opaline (`#F4F4F6`, `#E7E7E7`, `#D2D2D4`) y los submenús de módulos superiores pueden ser flotantes solo en ese shell. Mantener una sola línea en labels y nombres visibles; si falta espacio, resolverlo con layout y prioridad de ancho antes que con saltos de línea.
- En navegación superior con flyouts, no poner el menú dentro de un contenedor con `overflow-x: auto` o scroll horizontal. Eso corta visualmente el submenú aunque la lógica React funcione. Separar el stage centrado del contenedor real del flyout y dejar `overflow: visible`.
