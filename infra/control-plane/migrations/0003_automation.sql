-- Automation service: rules, events, runs, suppressions. Lives in the control plane (always-on), NOT in merchant cells,
-- so the queue never keeps a merchant database awake (see docs/adr/0003). Row-level security by store.
create type cp.rule_kind as enum ('transactional','operational','marketing');

create table cp.automation_rules (
  id text primary key, store_id text not null references cp.stores, name text not null, version integer not null default 1,
  trigger text not null, kind cp.rule_kind not null, enabled boolean not null, delay_seconds integer not null default 0 check (delay_seconds >= 0),
  conditions jsonb not null default '[]', guard text check (guard in ('checkout_not_completed','order_not_cancelled')), throttle jsonb,
  action jsonb not null, updated_at timestamptz not null default now(),
  check (kind <> 'transactional' or enabled),          -- essential email cannot be switched off
  check (kind <> 'marketing' or throttle is not null)  -- every marketing rule must be rate-limited
);
create index on cp.automation_rules (store_id, trigger);

create table cp.automation_events (store_id text not null references cp.stores, id text not null, type text not null, payload jsonb not null, received_at timestamptz not null default now(), primary key (store_id, id));

create table cp.automation_runs (
  id text primary key, store_id text not null references cp.stores, rule_id text not null references cp.automation_rules, rule_version integer not null,
  event_id text not null, event_type text not null, kind cp.rule_kind not null,
  idempotency_key text not null unique,                 -- one run per (store, rule, event, recipient): the duplicate guard
  recipient text, recipient_hash text, run_at timestamptz not null,
  status text not null check (status in ('scheduled','sent','skipped','failed_retrying','failed','cancelled')),
  skip_reason text, attempts jsonb not null default '[]', message_id text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on cp.automation_runs (store_id, kind, status, updated_at);
create index on cp.automation_runs (store_id, rule_id, recipient, status, updated_at);

create table cp.email_suppressions (store_id text not null references cp.stores, email text not null, reason text not null check (reason in ('bounce','complaint','unsubscribe','manual')), created_at timestamptz not null default now(), primary key (store_id, email));

-- Recipient addresses are personal data. Keep them only as long as the audit trail needs them, then keep just a hash.
create function cp.automation_purge_pii(keep_days integer) returns integer language sql security definer set search_path = cp, pg_temp as $$
  with u as (update cp.automation_runs set recipient = null where recipient is not null and created_at < now() - make_interval(days => keep_days) returning 1) select count(*)::int from u
$$;
revoke all on function cp.automation_purge_pii(integer) from public;

grant select, insert, update on cp.automation_rules, cp.automation_events, cp.automation_runs to oss_runtime;
grant select, insert, delete on cp.email_suppressions to oss_runtime;
alter table cp.automation_rules enable row level security; alter table cp.automation_events enable row level security;
alter table cp.automation_runs enable row level security; alter table cp.email_suppressions enable row level security;
create policy store_scope on cp.automation_rules to oss_runtime using (store_id = nullif(current_setting('app.store_id', true), '')) with check (store_id = nullif(current_setting('app.store_id', true), ''));
create policy store_scope on cp.automation_events to oss_runtime using (store_id = nullif(current_setting('app.store_id', true), '')) with check (store_id = nullif(current_setting('app.store_id', true), ''));
create policy store_scope on cp.automation_runs to oss_runtime using (store_id = nullif(current_setting('app.store_id', true), '')) with check (store_id = nullif(current_setting('app.store_id', true), ''));
create policy store_scope on cp.email_suppressions to oss_runtime using (store_id = nullif(current_setting('app.store_id', true), '')) with check (store_id = nullif(current_setting('app.store_id', true), ''));
insert into cp.schema_migrations(version) values ('0003_automation') on conflict do nothing;
