-- Organisation -> legal entity -> payment account -> store.
-- A payment account belongs to a legal entity (the verified business that owns the Stripe account), not to a store. Stores are bound to it.
-- Initial release rule: ONE store per payment account. That rule is a single, named constraint (one_store_per_payment_account) so lifting it
-- later is a deliberate, tested migration and not a redesign. Whatever the cardinality, a store can only be bound to a payment account owned
-- by a legal entity of the SAME organisation, and a store only ever sees its own binding (row-level security).
do $$ begin if (select count(*) from cp.payment_accounts) > 0 then raise exception 'cp.payment_accounts has rows; migrate them by hand'; end if; end $$;
drop table cp.payment_accounts;

create table cp.legal_entities (
  entity_id text primary key, organisation_id text not null, legal_name text not null, country char(2) not null default 'GB', company_number text,
  created_at timestamptz not null default now()
);
create unique index legal_entity_company_number on cp.legal_entities (country, company_number) where company_number is not null;
create index on cp.legal_entities (organisation_id);

create table cp.payment_accounts (
  payment_account_id text primary key, entity_id text not null references cp.legal_entities,
  stripe_account_id text not null unique check (stripe_account_id ~ '^acct_'), api_version text not null check (api_version in ('v1','v2')),
  status text not null check (status in ('unknown','not_started','onboarding','pending_verification','action_required','restricted','enabled','payouts_paused','disconnected')),
  charges_enabled boolean not null default false, payouts_enabled boolean not null default false,
  requirements jsonb not null default '{}', model_version integer not null default 1,
  checked_at timestamptz, disconnected_at timestamptz, created_at timestamptz not null default now()
);

create table cp.store_payment_accounts (
  store_id text primary key references cp.stores on delete cascade, payment_account_id text not null references cp.payment_accounts,
  bound_at timestamptz not null default now(),
  constraint one_store_per_payment_account unique (payment_account_id)
);

create function cp.check_binding_same_organisation() returns trigger language plpgsql as $$
begin
  if (select organisation_id from cp.stores where store_id = new.store_id)
     is distinct from (select e.organisation_id from cp.payment_accounts a join cp.legal_entities e using (entity_id) where a.payment_account_id = new.payment_account_id) then
    raise exception 'a store can only use a payment account owned by its own organisation';
  end if; return new;
end $$;
create trigger binding_same_organisation before insert or update on cp.store_payment_accounts for each row execute function cp.check_binding_same_organisation();

alter table cp.ledger_entries add column payment_account_id text references cp.payment_accounts;     -- the account the money moved on; store_id attributes it to a store

grant select, insert, update on cp.payment_accounts, cp.store_payment_accounts to oss_runtime;
grant select on cp.legal_entities to oss_runtime;
alter table cp.store_payment_accounts enable row level security;
create policy store_scope on cp.store_payment_accounts to oss_runtime using (store_id = nullif(current_setting('app.store_id', true), '')) with check (store_id = nullif(current_setting('app.store_id', true), ''));
alter table cp.payment_accounts enable row level security;
create policy bound_to_store on cp.payment_accounts to oss_runtime
  using (exists (select 1 from cp.store_payment_accounts b where b.payment_account_id = payment_accounts.payment_account_id and b.store_id = nullif(current_setting('app.store_id', true), '')))
  with check (true);
alter table cp.legal_entities enable row level security;
create policy bound_to_store on cp.legal_entities to oss_runtime
  using (exists (select 1 from cp.payment_accounts a join cp.store_payment_accounts b using (payment_account_id) where a.entity_id = legal_entities.entity_id and b.store_id = nullif(current_setting('app.store_id', true), '')));
insert into cp.schema_migrations(version) values ('0007_payment_account_model') on conflict do nothing;
