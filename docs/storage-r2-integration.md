# Integración aislada con Cloudflare R2

## Alcance inicial

Esta integración agrega únicamente comunicación de diagnóstico para un módulo nuevo.
No modifica los buckets, archivos, tablas ni funciones existentes de Supabase Storage.

## Flujo

1. El frontend obtiene el `access_token` de la sesión Supabase.
2. Solicita `GET /api/storage/health` en el mismo dominio del ERP.
3. Cloudflare Pages Function valida el token contra Supabase Auth.
4. La Function confirma si existe la vinculación `R2_BUCKET`.
5. La respuesta informa estado de conexión, pero mantiene escritura deshabilitada.

## Variables de runtime en Cloudflare Pages

Configurar como variables/secrets de Functions, no como variables `VITE_*`:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Configurar como binding R2:

- `R2_BUCKET`

El nombre real del binding puede mantenerse como `R2_BUCKET` aunque el nombre visible del bucket sea distinto.

## Próxima etapa

Después de probar autenticación y binding en producción, agregar el contrato de enlaces temporales para el nuevo módulo. Esa etapa seguirá sin migrar archivos existentes.
