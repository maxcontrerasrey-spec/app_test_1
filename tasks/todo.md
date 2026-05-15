# Plan de trabajo

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
  - Netlify debe tener `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` configuradas en variables de entorno; de lo contrario, `Continuar` no podrá autenticar contra Supabase

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
