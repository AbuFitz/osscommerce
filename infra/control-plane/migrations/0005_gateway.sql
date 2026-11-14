-- Gateway support: where cells live, replay protection for idempotent mutations, credential usage.
create type cp.cell_mode as enum ('live','test');
create table cp.cells (
  cell_id text primary key, url text not null check (url ~ '^https://'), channel_token text not null check (length(channel_token) >= 16),
  mode cp.cell_mode not null, healthy boolean not null default true, checked_at timestamptz
);
-- The runtime role reads a cell only through this function, one cell at a time. The channel token is a store selector, not a credential, but it still never leaves the platform.
create function cp.get_cell(p_cell text) returns table (url text, channel_token text, mode cp.cell_mode, healthy boolean)
language sql security definer set search_path = cp, pg_temp stable as $$ select c.url, c.channel_token, c.mode, c.healthy from cp.cells c where c.cell_id = p_cell $$;
revoke all on function cp.get_cell(text) from public; grant execute on function cp.get_cell(text) to oss_runtime;

create table cp.gateway_idempotency (
  storefront_id text not null references cp.storefronts on delete cascade, key text not null, status integer not null, body text not null, created_at timestamptz not null default now(),
  primary key (storefront_id, key)
);
create index on cp.gateway_idempotency (created_at);
grant select, insert on cp.gateway_idempotency to oss_runtime;
-- Stored responses can contain order details, so they expire.
create function cp.purge_gateway_idempotency(keep_hours integer) returns integer language sql security definer set search_path = cp, pg_temp as $$
  with d as (delete from cp.gateway_idempotency where created_at < now() - make_interval(hours => keep_hours) returning 1) select count(*)::int from d $$;
revoke all on function cp.purge_gateway_idempotency(integer) from public;

create function cp.touch_storefront_credential(p_hash bytea) returns void language sql security definer set search_path = cp, pg_temp as $$
  update cp.storefront_credentials set last_used_at = now() where secret_hash = p_hash and (last_used_at is null or last_used_at < now() - interval '1 minute') $$;
revoke all on function cp.touch_storefront_credential(bytea) from public; grant execute on function cp.touch_storefront_credential(bytea) to oss_runtime;
insert into cp.schema_migrations(version) values ('0005_gateway') on conflict do nothing;
