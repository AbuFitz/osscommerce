-- Payment account state, integration connections, provider job log and the merchant financial ledger.
create table cp.payment_accounts (
  store_id text primary key references cp.stores on delete cascade,
  stripe_account_id text not null unique check (stripe_account_id ~ '^acct_'),
  status text not null check (status in ('not_started','onboarding','pending_verification','action_required','restricted','enabled','payouts_paused','disconnected')),
  charges_enabled boolean not null default false, payouts_enabled boolean not null default false,
  requirements jsonb not null default '{}', model_version integer not null default 1,
  checked_at timestamptz, disconnected_at timestamptz, created_at timestamptz not null default now()
);

create table cp.integration_connections (
  id text primary key, store_id text not null references cp.stores on delete cascade, provider_id text not null, env text not null check (env in ('test','live')),
  state text not null check (state in ('available','configuring','pending','connected','degraded','revoked','disabled')),
  external_account_id text, credential_blob text,                       -- AES-256-GCM, bound to store and connection (packages/integrations/vault)
  failures integer not null default 0, last_health_at timestamptz, last_sync_at timestamptz, last_error jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (store_id, provider_id, env),
  check (state in ('available','configuring') or credential_blob is not null or state in ('revoked','disabled'))
);

create table cp.integration_job_log (
  id bigserial primary key, store_id text not null references cp.stores on delete cascade, connection_id text references cp.integration_connections on delete set null,
  kind text not null, status text not null check (status in ('queued','running','succeeded','failed','dead')), attempts integer not null default 0,
  error text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on cp.integration_job_log (store_id, status, updated_at desc);

-- Financial ledger entries are facts imported from the provider. They can be added, never changed.
create table cp.ledger_entries (
  store_id text not null references cp.stores on delete cascade, source_id text not null, kind text not null check (kind in ('sale','refund','dispute','dispute_reversal','payout','adjustment')),
  order_code text, gross bigint not null, processing_fee bigint not null, application_fee bigint not null, net bigint not null, currency char(3) not null,
  occurred_at timestamptz not null, charge_id text, imported_at timestamptz not null default now(), primary key (store_id, source_id)
);
create index on cp.ledger_entries (store_id, occurred_at desc);
create index on cp.ledger_entries (store_id, order_code);
create function cp.ledger_immutable() returns trigger language plpgsql as $$ begin raise exception 'cp.ledger_entries is append-only'; end $$;
create trigger ledger_no_change before update or delete on cp.ledger_entries for each row execute function cp.ledger_immutable();
create trigger ledger_no_truncate before truncate on cp.ledger_entries for each statement execute function cp.ledger_immutable();

grant select, insert, update on cp.payment_accounts, cp.integration_connections, cp.integration_job_log to oss_runtime;
grant select, insert on cp.ledger_entries to oss_runtime;
grant usage on all sequences in schema cp to oss_runtime;
do $$ declare t text; begin
  foreach t in array array['payment_accounts','integration_connections','integration_job_log','ledger_entries'] loop
    execute format('alter table cp.%I enable row level security', t);
    execute format($p$create policy store_scope on cp.%I to oss_runtime using (store_id = nullif(current_setting('app.store_id', true), '')) with check (store_id = nullif(current_setting('app.store_id', true), ''))$p$, t);
  end loop;
end $$;
insert into cp.schema_migrations(version) values ('0006_payments_integrations') on conflict do nothing;
