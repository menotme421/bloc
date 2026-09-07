-- Note version history for multi-device conflict review + restore.
-- Agreed policy: cap 100 versions per note + 30 days retention.
-- Pruning is enforced in application code after each insert (see
-- pruneNoteVersions in app actions) so no pg_cron dependency is needed.

create table if not exists public.note_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  note_id uuid not null,
  title text not null default '',
  content text not null default '',
  tag text,
  op text not null default 'update' check (op in ('create', 'update', 'delete', 'restore')),
  created_at timestamptz not null default now()
);

create index if not exists note_versions_user_note_created_idx
  on public.note_versions (user_id, note_id, created_at desc);

create index if not exists note_versions_created_idx
  on public.note_versions (created_at desc);

alter table public.note_versions enable row level security;

drop policy if exists "note_versions_select_own" on public.note_versions;
create policy "note_versions_select_own" on public.note_versions
  for select
  using (auth.uid() = user_id);

drop policy if exists "note_versions_insert_own" on public.note_versions;
create policy "note_versions_insert_own" on public.note_versions
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "note_versions_delete_own" on public.note_versions;
create policy "note_versions_delete_own" on public.note_versions
  for delete
  using (auth.uid() = user_id);
