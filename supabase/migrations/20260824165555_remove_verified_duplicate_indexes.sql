begin;

-- Ambas parejas tienen definiciones idénticas en producción. Se conserva el
-- nombre más explícito para auditoría y el HNSW con mayor uso acumulado.
drop index if exists public.idx_internal_mobility_request_audit_log_actor_id;
drop index if exists public.orion_knowledge_base_embedding_idx;

commit;
