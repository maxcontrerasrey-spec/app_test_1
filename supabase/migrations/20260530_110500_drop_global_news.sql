-- ==============================================================================
-- MIGRATION: Drop global_news module
-- PURPOSE: Remove news feature entirely — the ERP will focus on internal data only
-- ==============================================================================

BEGIN;

-- 1. Drop RPC functions (exact signatures from original migrations)
DROP FUNCTION IF EXISTS public.get_home_news();

-- 2. Drop RLS policies before dropping the table
DROP POLICY IF EXISTS "Allow read access to all authenticated users for global_news"
  ON public.global_news;

-- 3. Drop indexes explicitly (CASCADE would handle them, but explicit is cleaner)
DROP INDEX IF EXISTS public.global_news_categoria_idx;
DROP INDEX IF EXISTS public.global_news_fecha_publicacion_idx;

-- 4. Drop the table
DROP TABLE IF EXISTS public.global_news;

-- 5. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;
