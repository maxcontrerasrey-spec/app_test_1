-- ==============================================================================
-- MIGRATION: Create global_news table and API RPC
-- PURPOSE: Store GNews items (Minería, Economía) to avoid frontend direct calls
-- ==============================================================================

-- 1. Create the table
CREATE TABLE public.global_news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria text NOT NULL CHECK (categoria IN ('mineria', 'economia')),
  titulo text NOT NULL,
  resumen text,
  fuente text NOT NULL,
  url text NOT NULL,
  imagen_url text,
  fecha_publicacion timestamptz NOT NULL,
  fecha_actualizacion timestamptz NOT NULL DEFAULT now(),
  hash_unico text NOT NULL UNIQUE
);

-- 2. Indexes for efficient querying by category and date
CREATE INDEX global_news_categoria_idx ON public.global_news(categoria);
CREATE INDEX global_news_fecha_publicacion_idx ON public.global_news(fecha_publicacion DESC);

-- 3. Enable RLS
ALTER TABLE public.global_news ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Service Role can do everything (insert/update/delete)
-- Authenticated users can only read
CREATE POLICY "Allow read access to all authenticated users for global_news"
  ON public.global_news
  FOR SELECT
  TO authenticated
  USING (true);

-- 5. RPC function to get the latest news grouped by category
CREATE OR REPLACE FUNCTION public.get_home_news()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mineria_news jsonb;
  economia_news jsonb;
  last_updated timestamptz;
BEGIN
  -- Get top 2 mineria
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO mineria_news
  FROM (
    SELECT titulo, resumen, fuente, url, imagen_url, fecha_publicacion
    FROM public.global_news
    WHERE categoria = 'mineria'
    ORDER BY fecha_publicacion DESC
    LIMIT 2
  ) t;

  -- Get top 2 economia
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO economia_news
  FROM (
    SELECT titulo, resumen, fuente, url, imagen_url, fecha_publicacion
    FROM public.global_news
    WHERE categoria = 'economia'
    ORDER BY fecha_publicacion DESC
    LIMIT 2
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
