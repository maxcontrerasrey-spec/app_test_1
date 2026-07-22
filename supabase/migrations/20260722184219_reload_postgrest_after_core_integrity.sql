begin;

-- Forward-only schema-cache reload for 20260722183930_core_data_integrity_hardening.
notify pgrst, 'reload schema';

commit;
