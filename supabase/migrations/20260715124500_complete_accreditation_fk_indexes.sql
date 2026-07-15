-- Completes FK index coverage for the accreditation operational module.

create index if not exists idx_accreditation_audit_log_site_id
  on public.accreditation_audit_log(site_id);

create index if not exists idx_accreditation_matrix_requirement_id
  on public.accreditation_matrix(requirement_id);
