-- UATF enrollments sent from Home's form through api/enroll.ts.
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  phone text not null check (phone ~ '^[0-9]{8}$'),
  language text not null check (language in ('es', 'en')),
  created_at timestamptz not null default now()
);

-- No policies: browsers can neither read nor write. Only the server's secret key, which bypasses RLS, inserts rows.
alter table public.enrollments enable row level security;
revoke all on table public.enrollments from anon, authenticated;
