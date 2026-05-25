# Supabase Migrations

Este directorio contiene el historial completo de la base de datos de la plataforma, incluyendo estructura de tablas, Row Level Security (RLS) policies, Funciones (RPC) y Triggers.

## 📌 Convención de Nomenclatura

Todas las migraciones deben mantener un prefijo de timestamp para garantizar el orden estricto de ejecución. 

Formato: `YYYYMMDD_HHMMSS_descripcion_corta.sql`

Ejemplo: `20260523_000025_harden_profiles_and_cleanup_rpc.sql`

## 🔒 Arquitectura Zero Trust

La plataforma opera bajo el principio de Confianza Cero en la capa de datos:

1. **Mutaciones Restringidas**: Los clientes web (frontend) tienen prohibido modificar estados operacionales (ej. cambiar un caso de reclutamiento de `open` a `screening`) de forma directa mediante un `UPDATE` tradicional.
2. **SECURITY DEFINER**: Todas las acciones sensibles deben ejecutarse llamando a Funciones RPC (`supabase.rpc()`). Estas funciones se ejecutan con privilegios de administrador temporalmente (`SECURITY DEFINER`) pero validan internamente (`request.jwt.claims`) si el usuario tiene permiso para esa acción.
3. **Triggers Defensivos**: Tablas críticas como `profiles` poseen triggers en PostgreSQL (`BEFORE UPDATE`) que abortan cualquier transacción que intente modificar columnas sensibles (como `is_super_admin`) a menos que el usuario emisor sea legítimamente un superadmin.

## 🚀 Ejecutar Migraciones Localmente

Si utilizas la CLI oficial de Supabase para desarrollo local:

```bash
# Iniciar contenedor de base de datos
supabase start

# Aplicar las nuevas migraciones generadas
supabase migration up
```

*(Si no usas la CLI, las migraciones se aplican pegando el SQL directamente en el SQL Editor del dashboard web de Supabase en el proyecto de Staging/Producción).*
