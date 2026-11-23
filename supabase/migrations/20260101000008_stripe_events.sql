-- Michat 000008: stripe idempotency

create table if not exists public.stripe_events(
id text primary key,
type text,
created_at timestamptz default now()
);

alter table public.stripe_events enable row level security;