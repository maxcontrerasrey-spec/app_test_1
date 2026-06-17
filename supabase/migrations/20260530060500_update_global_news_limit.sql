-- ==============================================================================
-- MIGRATION: Update global_news RPC limit
-- PURPOSE: Increase the limit of returned news from 2 to 5 for carousel support
-- ==============================================================================

begin;

CREATE OR REPLACE FUNCTION public.get_home_news()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  mineria_news jsonb;
  economia_news jsonb;
  last_updated timestamptz;
BEGIN
  -- Validate authentication
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  -- Get top 5 mineria
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO mineria_news
  FROM (
    SELECT titulo, resumen, fuente, url, imagen_url, fecha_publicacion
    FROM public.global_news
    WHERE categoria = 'mineria'
    ORDER BY fecha_publicacion DESC
    LIMIT 5
  ) t;

  -- Get top 5 economia
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO economia_news
  FROM (
    SELECT titulo, resumen, fuente, url, imagen_url, fecha_publicacion
    FROM public.global_news
    WHERE categoria = 'economia'
    ORDER BY fecha_publicacion DESC
    LIMIT 5
  ) t;

  -- Get latest overall update
  SELECT max(fecha_actualizacion)
  INTO last_updated
  FROM public.global_news;

  RETURN jsonb_build_object(
    'mineria', mineria_news,
    'economia', economia_news,
    'ultima_actualizacion', last_updated
  );
END;
$$;

-- Security grants
REVOKE ALL ON FUNCTION public.get_home_news() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_home_news() TO authenticated;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

commit;
