-- Storefront registry. A store (merchant) can have many storefront connections: production, staging, previews, a replacement build.
-- A storefront is identified by a server credential and a verified host; the gateway resolves BOTH to exactly one (store, environment).
-- Nothing here is a secret: credentials are stored only as SHA-256 hashes of 256-bit random values.
create type cp.storefront_env  as enum ('development','preview','staging','production');
create type cp.storefront_state as enum ('draft','connected','approved','live','disabled','retired');

create table cp.storefronts (
  storefront_id text primary key,
  store_id text not null references cp.stores on delete cascade,
  name text not null,
  env cp.storefront_env not null,
  state cp.storefront_state not null default 'draft',
  api_version text not null default 'v1',
  sdk_version text, content_schema_version integer, config_version integer not null default 1,
  live_orders boolean not null generated always as (env = 'production') stored,   -- non-production can never take real payment or send real email
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on cp.storefronts (store_id);
-- At most one live production storefront per store: the one customers actually reach.
create unique index one_live_production on cp.storefronts (store_id) where env = 'production' and state = 'live';

create table cp.storefront_hosts (
  host text primary key check (host = lower(host)),
  storefront_id text not null references cp.storefronts on delete cascade,
  store_id text not null references cp.stores on delete cascade,
  verified boolean not null default false, verified_at timestamptz
);
create index on cp.storefront_hosts (storefront_id);

create table cp.storefront_credentials (
  credential_id text primary key,
  storefront_id text not null references cp.storefronts on delete cascade,
  purpose text not null check (purpose in ('server','revalidation')),
  secret_hash bytea not null unique check (octet_length(secret_hash) = 32),
  prefix text not null,                                   -- first characters of the secret, so an operator can identify it without storing it
  created_at timestamptz not null default now(), expires_at timestamptz not null, revoked_at timestamptz, last_used_at timestamptz,
  check (expires_at > created_at)
);
create index on cp.storefront_credentials (storefront_id, purpose);

create table cp.storefront_deployments (
  deployment_id text primary key,
  storefront_id text not null references cp.storefronts on delete cascade,
  store_id text not null references cp.stores on delete cascade,
  vercel_project_id text, vercel_deployment_id text, url text,
  state text not null check (state in ('building','ready','error','canceled','promoted','superseded')),
  git_sha text, sdk_version text, created_at timestamptz not null default now()
);
create index on cp.storefront_deployments (storefront_id, created_at desc);

-- Repeatable, auditable provisioning. One row per (run, step). A retry re-enters at the first step that is not 'done'
-- and re-uses external_id, so a step that half-succeeded at Vercel/Stripe/DNS is adopted rather than duplicated.
create table cp.provisioning_runs (
  run_id text primary key, store_id text not null references cp.stores on delete cascade, storefront_id text references cp.storefronts,
  status text not null check (status in ('running','done','failed')), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table cp.provisioning_steps (
  run_id text not null references cp.provisioning_runs on delete cascade, step text not null,
  status text not null check (status in ('pending','running','done','failed')), attempts integer not null default 0,
  external_id text, error text, updated_at timestamptz not null default now(),
  primary key (run_id, step)
);

-- Merchant-managed content, validated against the storefront's own manifest. Revisions are immutable; publishing points at one.
create table cp.content_schemas (
  storefront_id text not null references cp.storefronts on delete cascade, version integer not null, manifest jsonb not null, created_at timestamptz not null default now(),
  primary key (storefront_id, version)
);
create table cp.content_revisions (
  storefront_id text not null references cp.storefronts on delete cascade, store_id text not null references cp.stores on delete cascade,
  entry text not null, revision integer not null, schema_version integer not null, body jsonb not null, author text not null,
  created_at timestamptz not null default now(), published_at timestamp with time zone,
  primary key (storefront_id, entry, revision)
);
create index on cp.content_revisions (storefront_id, entry, published_at desc nulls last);

-- Single entry point for the gateway: given the hash of a presented credential, return who it is. Fails closed:
-- expired, revoked, disabled/retired storefronts and non-ready stores return nothing.
create function cp.resolve_storefront(p_hash bytea, p_purpose text) returns table (storefront_id text, store_id text, env cp.storefront_env, live_orders boolean, cell_id text, config_version integer)
language sql security definer set search_path = cp, pg_temp stable as $$
  select s.storefront_id, s.store_id, s.env, s.live_orders, st.cell_id, s.config_version
  from cp.storefront_credentials c join cp.storefronts s using (storefront_id) join cp.stores st on st.store_id = s.store_id
  where c.secret_hash = p_hash and c.purpose = p_purpose and c.revoked_at is null and c.expires_at > now()
    and s.state in ('connected','approved','live') and st.lifecycle in ('configuring','ready','live')
$$;
revoke all on function cp.resolve_storefront(bytea, text) from public;
grant execute on function cp.resolve_storefront(bytea, text) to oss_runtime;

grant select, insert, update on cp.storefronts, cp.storefront_hosts, cp.storefront_deployments, cp.provisioning_runs, cp.provisioning_steps, cp.content_revisions to oss_runtime;
grant select, insert on cp.content_schemas to oss_runtime;
-- storefront_credentials is deliberately not granted: only the console's owner role writes it, and the gateway reads it through resolve_storefront.

do $$ declare t text; begin
  foreach t in array array['storefronts','storefront_hosts','storefront_deployments','provisioning_runs','content_revisions'] loop
    execute format('alter table cp.%I enable row level security', t);
    execute format($p$create policy store_scope on cp.%I to oss_runtime using (store_id = nullif(current_setting('app.store_id', true), '')) with check (store_id = nullif(current_setting('app.store_id', true), ''))$p$, t);
  end loop;
end $$;
alter table cp.provisioning_steps enable row level security;
create policy store_scope on cp.provisioning_steps to oss_runtime using (exists (select 1 from cp.provisioning_runs r where r.run_id = provisioning_steps.run_id and r.store_id = nullif(current_setting('app.store_id', true), '')));
alter table cp.content_schemas enable row level security;
create policy store_scope on cp.content_schemas to oss_runtime using (exists (select 1 from cp.storefronts f where f.storefront_id = content_schemas.storefront_id and f.store_id = nullif(current_setting('app.store_id', true), '')));
insert into cp.schema_migrations(version) values ('0004_storefronts') on conflict do nothing;
