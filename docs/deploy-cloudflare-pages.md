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

Sin esas variables, la app puede cargar visualmente pero login, catálogos y permisos no funcionarán.

## Routing SPA

El proyecto ya incluye:

- [`public/_redirects`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/public/_redirects)

Contenido:

```text
/* /index.html 200
```

Eso permite que rutas como:

- `/login`
- `/certificados`
- `/solicitud-contrataciones`

resuelvan correctamente en un despliegue estático.

## Checklist de publicación

1. Crear proyecto en Cloudflare Pages.
2. Conectar el repositorio correcto.
3. Configurar:
   - `Build command`: `npm run build`
   - `Build output directory`: `dist`
4. Cargar variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Guardar y lanzar deploy.
6. Validar:
   - carga de `/login`
   - login real contra Supabase
   - navegación a rutas internas
   - lectura de módulos autorizados

## Qué revisar si vuelve a fallar

### Si falla antes de publicar

Revisar que Cloudflare no esté ejecutando:

- `npx wrangler deploy`

Si aparece ese comando en logs, el proyecto quedó configurado con el flujo incorrecto.

### Si publica pero la app no funciona

Revisar primero:

- variables `VITE_SUPABASE_URL`
- variables `VITE_SUPABASE_ANON_KEY`

### Si las rutas internas dan 404

Revisar que `public/_redirects` siga presente en el repo y que el build lo copie a `dist/`.
