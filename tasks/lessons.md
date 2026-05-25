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
