-- Live consent and per-store automation policy. Consent is an immutable ledger, never a mutable flag.
create table cp.marketing_consent (
  id bigserial primary key, store_id text not null references cp.stores on delete cascade,
  email text not null check (email = lower(email)), granted boolean not null, source text not null,
  occurred_at timestamptz not null default now()
);
create index on cp.marketing_consent (store_id, email, occurred_at desc, id desc);
create function cp.marketing_consent_immutable() returns trigger language plpgsql as $$ begin raise exception 'cp.marketing_consent is append-only'; end $$;
create trigger marketing_consent_no_change before update or delete on cp.marketing_consent for each row execute function cp.marketing_consent_immutable();
create trigger marketing_consent_no_truncate before truncate on cp.marketing_consent for each statement execute function cp.marketing_consent_immutable();

create table cp.automation_settings (
  store_id text primary key references cp.stores on delete cascade,
  automation_runs_per_month integer not null default 1000 check (automation_runs_per_month >= 0),
  timezone text not null default 'Europe/London', quiet_from smallint, quiet_to smallint,
  updated_at timestamptz not null default now(),
  check ((quiet_from is null) = (quiet_to is null)), check (quiet_from between 0 and 23), check (quiet_to between 0 and 23)
);
insert into cp.automation_settings (store_id) select store_id from cp.stores on conflict do nothing;
create function cp.seed_automation_settings() returns trigger language plpgsql security definer set search_path = cp, pg_temp as $$
begin insert into cp.automation_settings(store_id) values (new.store_id) on conflict do nothing; return new; end $$;
create trigger stores_seed_automation_settings after insert on cp.stores for each row execute function cp.seed_automation_settings();

grant select, insert on cp.marketing_consent to oss_runtime;
grant select, update on cp.automation_settings to oss_runtime;
grant usage on sequence cp.marketing_consent_id_seq to oss_runtime;
alter table cp.marketing_consent enable row level security; alter table cp.automation_settings enable row level security;
create policy store_scope on cp.marketing_consent to oss_runtime using (store_id = nullif(current_setting('app.store_id', true), '')) with check (store_id = nullif(current_setting('app.store_id', true), ''));
create policy store_scope on cp.automation_settings to oss_runtime using (store_id = nullif(current_setting('app.store_id', true), '')) with check (store_id = nullif(current_setting('app.store_id', true), ''));

insert into cp.schema_migrations(version) values ('0012_automation_policy') on conflict do nothing;
