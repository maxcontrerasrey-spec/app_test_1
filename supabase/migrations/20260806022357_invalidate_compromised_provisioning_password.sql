begin;

create temporary table compromised_provisioning_accounts (
  user_id uuid primary key
) on commit drop;

insert into compromised_provisioning_accounts (user_id)
select id
  from auth.users
 where encrypted_password = crypt(
   chr(66)||chr(106)||chr(109)||chr(50)||chr(48)||chr(50)||chr(54)||chr(42),
   encrypted_password
 );

-- Replace the public shared password with a unique, unrecoverable random value.
-- Affected users must use the normal password-recovery flow.
update auth.users u
   set encrypted_password = crypt(encode(gen_random_bytes(32), 'hex'), gen_salt('bf', 10)),
       updated_at = timezone('utc', now())
  from compromised_provisioning_accounts compromised
 where u.id = compromised.user_id;

-- Revoke active and refresh sessions immediately. Refresh tokens cascade from
-- auth.sessions, preventing an already-issued session from surviving rotation.
delete from auth.sessions s
using compromised_provisioning_accounts compromised
where s.user_id = compromised.user_id;

update public.profiles p
   set must_reset_password = true,
       updated_at = timezone('utc', now())
  from compromised_provisioning_accounts compromised
 where p.id = compromised.user_id;

commit;
