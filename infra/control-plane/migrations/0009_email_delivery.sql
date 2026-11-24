-- Tenant-scoped sender identity and verified Resend delivery events.
-- API and webhook secrets remain environment credentials; they are never stored in this database.
create type cp.email_domain_status as enum ('not_started','pending','verified','failed');

create table cp.email_profiles (
  store_id text primary key references cp.stores on delete cascade,
  from_name text not null check (char_length(from_name) between 1 and 120),
  from_local_part text not null default 'orders' check (from_local_part ~ '^[a-z0-9][a-z0-9._+-]{0,62}$'),
  sending_domain text not null check (sending_domain = lower(sending_domain) and sending_domain ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:[.][a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$'),
  resend_domain_id text unique,
  domain_status cp.email_domain_status not null default 'not_started',
  verified_at timestamptz,
  shop_name text not null check (char_length(shop_name) between 1 and 120),
  accent text not null default '#0e1311' check (accent ~ '^#[0-9a-fA-F]{6}$'),
  logo_url text check (logo_url is null or logo_url ~ '^https://'),
  support_email text not null check (support_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
  reply_to text check (reply_to is null or reply_to ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
  postal_address text,
  footer text check (footer is null or char_length(footer) <= 1000),
  template_edits jsonb not null default '{}' check (jsonb_typeof(template_edits) = 'object'),
  updated_at timestamptz not null default now(),
  check ((domain_status = 'verified') = (verified_at is not null))
);

-- The provider event id is the replay guard. message_id ties the event to a run and therefore a store.
create unique index automation_runs_message_id on cp.automation_runs (message_id) where message_id is not null;
create table cp.email_webhook_events (
  provider_event_id text primary key,
  store_id text not null references cp.stores on delete cascade,
  message_id text not null,
  type text not null,
  received_at timestamptz not null default now()
);
create index on cp.email_webhook_events (store_id, received_at desc);

grant select, insert, update on cp.email_profiles to oss_runtime;
grant select, insert on cp.email_webhook_events to oss_runtime;
alter table cp.email_profiles enable row level security;
alter table cp.email_webhook_events enable row level security;
create policy store_scope on cp.email_profiles to oss_runtime using (store_id = nullif(current_setting('app.store_id', true), '')) with check (store_id = nullif(current_setting('app.store_id', true), ''));
create policy store_scope on cp.email_webhook_events to oss_runtime using (store_id = nullif(current_setting('app.store_id', true), '')) with check (store_id = nullif(current_setting('app.store_id', true), ''));

-- Webhooks identify a provider message, never a tenant supplied by the request. This narrow lookup is the only cross-tenant step.
create function cp.resolve_email_message(p_message_id text) returns text
language sql security definer set search_path = cp, pg_temp stable as $$
  select store_id from cp.automation_runs where message_id = p_message_id limit 1
$$;
revoke all on function cp.resolve_email_message(text) from public;
grant execute on function cp.resolve_email_message(text) to oss_runtime;

insert into cp.schema_migrations(version) values ('0009_email_delivery') on conflict do nothing;
