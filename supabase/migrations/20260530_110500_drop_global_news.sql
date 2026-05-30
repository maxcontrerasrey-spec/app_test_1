BEGIN;

-- Drop RPCs related to news
DROP FUNCTION IF EXISTS public.get_latest_news(text, integer);

-- Drop the global_news table
DROP TABLE IF EXISTS public.global_news CASCADE;

-- Ensure cache is invalidated
NOTIFY pgrst, 'reload schema';

COMMIT;
