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
