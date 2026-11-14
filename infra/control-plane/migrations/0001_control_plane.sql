-- OSS Commerce control plane. Owns: store registry, entitlement inbox, outbox, access grants, audit.
-- Does NOT hold catalogue/orders/shoppers (those live in per-merchant engine cells) or secrets.
create schema if not exists cp;

create type cp.store_lifecycle as enum ('draft','provisioning','configuring','ready','live','restricted','suspended','offboarding','archived');
create type cp.payment_readiness as enum ('not_started','onboarding','restricted','enabled');

create table cp.stores (
  store_id        text primary key,
  organisation_id text not null,
  cell_id         text not null,
  region          text not null check (region in ('eu-west-london','eu-west-ireland')),
  lifecycle       cp.store_lifecycle not null default 'draft',
  payment         cp.payment_readiness not null default 'not_started',
  entitlement_version integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on cp.stores (organisation_id);

create table cp.store_hostnames (
  host      text primary key check (host = lower(host)),
  store_id  text not null references cp.stores on delete cascade,
  verified  boolean not null default false,
  verified_at timestamptz
);
create index on cp.store_hostnames (store_id);

-- Inbound Manage events. PK on event_id makes consumers idempotent.
create table cp.inbox (
  event_id    uuid primary key,
  type        text not null,
  organisation_id text not null,
  payload     jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

-- Transactional outbox for events back to Manage.
create table cp.outbox (
  id          bigserial primary key,
  store_id    text not null,
  type        text not null,
  payload     jsonb not null,
  created_at  timestamptz not null default now(),
  published_at timestamptz
);
create index on cp.outbox (published_at) where published_at is null;

-- Partner/support access: pending -> approved|declined|expired -> active -> revoked
create type cp.grant_state as enum ('pending','approved','declined','expired','active','revoked');
create table cp.access_grants (
  id           uuid primary key default gen_random_uuid(),
  store_id     text not null references cp.stores,
  grantee_user_id text not null,
  scopes       text[] not null check (cardinality(scopes) > 0),
  purpose      text not null,
  state        cp.grant_state not null default 'pending',
  write_access boolean not null default false,
  expires_at   timestamptz not null,
  requested_at timestamptz not null default now(),
  decided_by   text,
  decided_at   timestamptz,
  -- write access is time boxed to 60 minutes max (research/02)
  check (not write_access or expires_at <= requested_at + interval '60 minutes')
);
create index on cp.access_grants (store_id, state);

-- Append-only audit.
create table cp.audit_log (
  id         bigserial primary key,
  at         timestamptz not null default now(),
  store_id   text,
  actor      text not null,
  action     text not null,
  before     jsonb,
  after      jsonb,
  correlation_id text
);
create function cp.audit_immutable() returns trigger language plpgsql as $$
begin raise exception 'cp.audit_log is append-only'; end $$;
create trigger audit_no_update before update or delete on cp.audit_log for each row execute function cp.audit_immutable();
create trigger audit_no_truncate before truncate on cp.audit_log for each statement execute function cp.audit_immutable();

-- Defence in depth: runtime role is non-owner; row access is gated by the per-request store.
create role oss_runtime nologin;
grant usage on schema cp to oss_runtime;
grant select, insert, update on cp.stores, cp.store_hostnames, cp.access_grants to oss_runtime;
grant select, insert on cp.inbox, cp.outbox, cp.audit_log to oss_runtime;
grant update (processed_at) on cp.inbox to oss_runtime;
grant update (published_at) on cp.outbox to oss_runtime;
grant usage on all sequences in schema cp to oss_runtime;

alter table cp.stores enable row level security;
alter table cp.access_grants enable row level security;
alter table cp.store_hostnames enable row level security;
-- App must `set local app.store_id = '<verified store>'` per transaction; unset => no rows (fail closed).
create policy store_scope on cp.stores to oss_runtime using (store_id = nullif(current_setting('app.store_id', true), ''));
create policy grant_scope on cp.access_grants to oss_runtime using (store_id = nullif(current_setting('app.store_id', true), '')) with check (store_id = nullif(current_setting('app.store_id', true), ''));
create policy host_scope on cp.store_hostnames to oss_runtime using (store_id = nullif(current_setting('app.store_id', true), '')) with check (store_id = nullif(current_setting('app.store_id', true), ''));
-- Hostname -> store resolution runs through a narrow security-definer function, not a table read.
create function cp.resolve_host(h text) returns table(store_id text, cell_id text, lifecycle cp.store_lifecycle)
language sql security definer set search_path = cp, pg_temp stable as $$
  select s.store_id, s.cell_id, s.lifecycle from cp.store_hostnames n join cp.stores s using (store_id) where n.host = lower(h) and n.verified
$$;
revoke all on function cp.resolve_host(text) from public;
grant execute on function cp.resolve_host(text) to oss_runtime;
