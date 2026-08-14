set check_function_bodies = on;

update private.psych_prompt_versions
set is_active = false
where prompt_code = 'psych-ai-interpretation'
  and is_active = true;

insert into private.psych_prompt_versions(
  prompt_code,
  prompt_version,
  schema_version,
  provider,
  model,
  system_prompt,
  response_schema,
  content_sha256,
  is_active
)
select
  prompt_code,
  'psych-ai-prompt-v4',
  'psych-ai-schema-v3',
  'openai',
  'gpt-5-mini',
  system_prompt,
  response_schema,
  encode(extensions.digest(
    'psych-ai-prompt-v4|psych-ai-schema-v3|openai|gpt-5-mini|semantic guardrails v3',
    'sha256'
  ), 'hex'),
  true
from private.psych_prompt_versions
where prompt_code = 'psych-ai-interpretation'
  and prompt_version = 'psych-ai-prompt-v3'
  and schema_version = 'psych-ai-schema-v3'
order by created_at desc
limit 1
on conflict (prompt_code, prompt_version, schema_version) do update
set provider = excluded.provider,
    model = excluded.model,
    system_prompt = excluded.system_prompt,
    response_schema = excluded.response_schema,
    content_sha256 = excluded.content_sha256,
    is_active = true;

notify pgrst, 'reload schema';
