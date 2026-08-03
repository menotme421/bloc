-- Backfill profiles for users created before the on_auth_user_created trigger existed.
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- Report which auth providers an email is linked to (case-insensitive).
-- Used by the sign-in flow to detect Google-only accounts and
-- to distinguish "account not found" from "wrong password".
create or replace function public.get_auth_providers(p_email text)
returns text[]
language sql
security definer
set search_path = auth, public
as $$
  select coalesce(array_agg(distinct provider order by provider), '{}'::text[])
  from auth.identities
  where lower(email) = lower(p_email);
$$;

grant execute on function public.get_auth_providers(text) to anon, authenticated;
