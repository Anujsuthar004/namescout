-- NameScout price store. Run in the Supabase SQL editor.
-- The sync job upserts on (tld, registrar); the app reads the whole table.

create table if not exists prices (
  tld             text        not null,
  registrar       text        not null,
  register_price  numeric(10,2) not null,
  renew_price     numeric(10,2) not null,
  transfer_price  numeric(10,2),
  currency        text        not null default 'USD',
  promo           boolean     not null default false,
  fetched_at      timestamptz not null default now(),
  primary key (tld, registrar)
);

create index if not exists prices_tld_idx on prices (tld);

-- Read-only public access for the app's anon key; writes happen via the
-- service-role key used by the sync job (which bypasses RLS).
alter table prices enable row level security;

create policy "public read prices"
  on prices for select
  using (true);
