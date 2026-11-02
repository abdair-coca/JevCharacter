-- Jev's notes for visitors signed in with Google. The browser writes with the publishable key; RLS keeps each
-- visitor to their own notes: read, add and forget, never edit.
create table public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Same rule as the browser: 1–160 characters and no seven digits in a row, even with spaces, dots or dashes.
  text text not null check (char_length(text) between 1 and 160 and btrim(text) <> '' and text !~ '\d([\s.-]?\d){6,}'),
  created_at timestamptz not null default now()
);

create index memories_user_created on public.memories (user_id, created_at);

-- Keeps the 40 newest notes per visitor; an insert beyond that forgets the oldest.
create function public.memories_keep_latest() returns trigger
language plpgsql set search_path = '' as $$
begin
  delete from public.memories
  where id in (
    select id from public.memories where user_id = new.user_id order by created_at desc, id desc offset 40
  );
  return null;
end;
$$;

create trigger memories_keep_latest after insert on public.memories
for each row execute function public.memories_keep_latest();

alter table public.memories enable row level security;
revoke all on table public.memories from anon, authenticated;
grant select, insert, delete on table public.memories to authenticated;

create policy "Visitors read their own notes" on public.memories
for select to authenticated using ((select auth.uid()) = user_id);

create policy "Visitors add their own notes" on public.memories
for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "Visitors forget their own notes" on public.memories
for delete to authenticated using ((select auth.uid()) = user_id);
