# Despliegue en Cloudflare Pages

## Objetivo

Publicar la app como sitio estático en Cloudflare Pages.

Esta app:

- compila con `Vite`
- genera salida en `dist/`
- usa `Supabase` como backend
- no necesita `Cloudflare Worker` para operar

## Regla operativa

No configurar este proyecto con `npx wrangler deploy`.

Ese flujo intenta tratar el repo como Worker o framework server-side y hoy falla con el mensaje:

- `The version of Vite used in the project ("5.4.21") cannot be automatically configured`

Para este proyecto el despliegue correcto es `Pages` puro, publicando `dist/`.

## Configuración correcta en Cloudflare

### Tipo de proyecto

- `Pages`
- conexión al repositorio Git

### Comandos

- `Build command`: `npm run build`
- `Build output directory`: `dist`

### No usar

- `Deploy command`
- `npx wrangler deploy`
- modo `Worker`

## Variables de entorno requeridas

Definir en Cloudflare Pages:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_PUBLIC_APP_URL`

Sin esas variables, la app puede cargar visualmente pero login, catálogos y permisos no funcionarán.
Sin `VITE_PUBLIC_APP_URL`, los correos de recuperación dependen del `window.location.origin` desde donde se dispare la solicitud, lo que puede inducir redirecciones erróneas entre ambientes.

## Routing SPA

El proyecto ya incluye:

- [`public/_redirects`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/public/_redirects)
- [`public/_headers`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/public/_headers)

Contenido:

```text
/* /index.html 200
```

Eso permite que rutas como:

- `/login`
- `/certificados`
- `/solicitud-contrataciones`

resuelvan correctamente en un despliegue estático.

Además, la política de caché queda intencionalmente separada:

- `/*` se sirve con `Cache-Control: no-cache, must-revalidate`
- `/assets/*` se sirve con `Cache-Control: public, max-age=31536000, immutable`

Esto reduce el riesgo de que una pestaña vieja conserve `index.html` apuntando a chunks hasheados que ya cambiaron después de un deploy automático.

## Checklist de publicación

1. Crear proyecto en Cloudflare Pages.
2. Conectar el repositorio correcto.
3. Configurar:
   - `Build command`: `npm run build`
   - `Build output directory`: `dist`
4. Cargar variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_PUBLIC_APP_URL`
5. Guardar y lanzar deploy.
6. Validar:
   - carga de `/login`
   - login real contra Supabase
   - navegación a rutas internas
   - lectura de módulos autorizados
   - recuperación de contraseña aterrizando en `https://app-test-1-2ao.pages.dev/reset-password`

## Qué revisar si vuelve a fallar

### Si falla antes de publicar

Revisar que Cloudflare no esté ejecutando:

- `npx wrangler deploy`

Si aparece ese comando en logs, el proyecto quedó configurado con el flujo incorrecto.

### Si publica pero la app no funciona

Revisar primero:

- variables `VITE_SUPABASE_URL`
- variables `VITE_SUPABASE_ANON_KEY`
- variable `VITE_PUBLIC_APP_URL`
- configuración de `Authentication > URL Configuration` en Supabase
- template de correo de recuperación usando `{{ .ConfirmationURL }}` sin hardcodes a `localhost`
- que `public/_headers` siga presente en el repo y que el build lo copie a `dist/`

### Si las rutas internas dan 404

Revisar que `public/_redirects` siga presente en el repo y que el build lo copie a `dist/`.
