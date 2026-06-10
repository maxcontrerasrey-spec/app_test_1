-- Habilitar pgvector para almacenar y buscar vectores matemáticos
create extension if not exists vector schema extensions;

-- Crear la tabla principal de conocimiento
create table public.orion_knowledge_base (
    id bigint primary key generated always as identity,
    document_name text not null,
    content text not null,
    embedding extensions.vector(384), -- Supabase.ai (gte-small) genera vectores de 384 dimensiones
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Crear un índice HNSW para búsqueda súper rápida
create index on public.orion_knowledge_base using hnsw (embedding extensions.vector_cosine_ops);

-- Habilitar RLS
alter table public.orion_knowledge_base enable row level security;

-- Política de lectura: Cualquier usuario autenticado (empleado/admin) puede consultar la base de conocimiento
create policy "Authenticated users can read knowledge base"
    on public.orion_knowledge_base
    for select
    to authenticated
    using (true);

-- Solo el sistema (Edge Functions / Service Role) puede insertar, modificar o borrar.
-- No se requiere política para Service Role, ya que este bypasses RLS por defecto.

-- Función para buscar documentos relevantes (RAG)
create or replace function public.match_knowledge_documents(
    query_embedding extensions.vector(384),
    match_threshold float,
    match_count int
)
returns table (
    id bigint,
    document_name text,
    content text,
    similarity float
)
language sql stable
as $$
    select
        orion_knowledge_base.id,
        orion_knowledge_base.document_name,
        orion_knowledge_base.content,
        1 - (orion_knowledge_base.embedding <=> query_embedding) as similarity
    from public.orion_knowledge_base
    where 1 - (orion_knowledge_base.embedding <=> query_embedding) > match_threshold
    order by orion_knowledge_base.embedding <=> query_embedding
    limit match_count;
$$;
