begin;

-- El flujo vigente decide el estado de hiring_requests dentro de RPCs secuenciales.
-- Este trigger legacy reintroduce estados del workflow antiguo ('pendiente'/'aprobada')
-- y rompe la constraint moderna al aprobar o rechazar folios.
drop trigger if exists trg_hiring_request_approvals_refresh_status on public.hiring_request_approvals;

drop function if exists public.handle_hiring_request_approval_change();
drop function if exists public.refresh_hiring_request_status(uuid);

notify pgrst, 'reload schema';

commit;
