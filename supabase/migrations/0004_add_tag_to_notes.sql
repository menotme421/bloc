-- Single tag per note. Nullable; null means no tag assigned.
-- RLS policies on public.notes cover this column automatically.

alter table public.notes
  add column if not exists tag text;

create index if not exists notes_user_tag_idx
  on public.notes (user_id, tag);