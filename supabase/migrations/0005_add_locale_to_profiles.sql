-- Language preference for i18n. Managed via app settings hybrid (localStorage + profiles.locale).
-- Values: en (default), ms, zh-CN (简体中文), zh-TW (繁體中文)

alter table public.profiles
  add column if not exists locale text not null default 'en'
    check (locale in ('en','ms','zh-CN','zh-TW'));

-- Ensure handle_new_user keeps default 'en' (column default)
-- Existing rows default to 'en' via default above, but backfill explicitly for clarity
update public.profiles set locale = 'en' where locale is null;

-- Allow authenticated users to read/update own locale only (keep existing public read for backwards compat, add own update)
-- Existing policy profiles_public_read (select true) remains.

drop policy if exists "profiles_owner_update_locale" on public.profiles;
create policy "profiles_owner_update_locale" on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
