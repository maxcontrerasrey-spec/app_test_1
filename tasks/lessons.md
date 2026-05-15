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
