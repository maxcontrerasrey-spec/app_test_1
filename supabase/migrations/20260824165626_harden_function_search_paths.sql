begin;

alter function public.set_updated_at()
  set search_path = public, pg_temp;
alter function public.normalize_bi_text_array(text[])
  set search_path = public, pg_temp;
alter function public.parse_bi_date_text(text)
  set search_path = public, pg_temp;
alter function public.normalize_bi_period_code(text)
  set search_path = public, pg_temp;
alter function public.get_bi_recruitment_contract_filter_candidates(text[])
  set search_path = public, pg_temp;
alter function public.competency_requires_legal_signature(text, text)
  set search_path = public, pg_temp;

commit;
