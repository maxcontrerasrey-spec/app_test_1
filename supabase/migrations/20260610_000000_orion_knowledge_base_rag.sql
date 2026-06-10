-- Habilitar pgvector para almacenar y buscar vectores matemáticos
create extension if not exists vector schema extensions;

-- Crear la tabla principal de conocimiento
create table if not exists public.orion_knowledge_base (
    id bigint primary key generated always as identity,
    document_name text not null,
    content text not null,
    embedding extensions.vector(384), -- Supabase.ai (gte-small) genera vectores de 384 dimensiones
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Crear un índice HNSW para búsqueda súper rápida
create index if not exists orion_knowledge_base_embedding_hnsw_idx
  on public.orion_knowledge_base using hnsw (embedding extensions.vector_cosine_ops);

create index if not exists orion_knowledge_base_document_name_idx
  on public.orion_knowledge_base (document_name);

-- Habilitar RLS
alter table public.orion_knowledge_base enable row level security;

revoke all on table public.orion_knowledge_base from public;
revoke all on table public.orion_knowledge_base from anon;
grant select, delete on public.orion_knowledge_base to authenticated;

drop policy if exists "Authenticated users can read knowledge base" on public.orion_knowledge_base;
drop policy if exists "Authenticated users can delete knowledge base" on public.orion_knowledge_base;
drop policy if exists "orion_knowledge_base_select_ai_assistant" on public.orion_knowledge_base;
drop policy if exists "orion_knowledge_base_delete_ai_assistant" on public.orion_knowledge_base;

create policy "orion_knowledge_base_select_ai_assistant"
    on public.orion_knowledge_base
    for select
    to authenticated
    using (
      public.user_is_admin((select auth.uid()))
      or public.user_can_access_module((select auth.uid()), 'ai_assistant')
    );

create policy "orion_knowledge_base_delete_ai_assistant"
    on public.orion_knowledge_base
    for delete
    to authenticated
    using (
      public.user_is_admin((select auth.uid()))
      or public.user_can_access_module((select auth.uid()), 'ai_assistant')
    );

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
language sql
stable
set search_path = public, extensions
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

revoke all on function public.match_knowledge_documents(extensions.vector, float, int) from public;
revoke all on function public.match_knowledge_documents(extensions.vector, float, int) from anon;
revoke all on function public.match_knowledge_documents(extensions.vector, float, int) from authenticated;
grant execute on function public.match_knowledge_documents(extensions.vector, float, int) to service_role;
