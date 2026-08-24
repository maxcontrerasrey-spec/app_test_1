-- Forward-only follow-up for 20260824151707_block_invalid_buk_pension_payload.
-- The original migration is already applied in production and remains immutable.
notify pgrst, 'reload schema';
