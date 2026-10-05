-- EEES-DB-005: approved
-- owner: Comunicaciones / Engineering
-- rollback: drop the three indexes created below; no stored content is affected.

begin;

create index if not exists idx_communications_acknowledgements_profile
  on public.communications_acknowledgements (profile_id, acknowledged_at desc);
create index if not exists idx_communications_assets_created_by
  on public.communications_assets (created_by, created_at desc);
create index if not exists idx_communications_items_cover_asset
  on public.communications_items (cover_asset_id)
  where cover_asset_id is not null;

notify pgrst, 'reload schema';
commit;
