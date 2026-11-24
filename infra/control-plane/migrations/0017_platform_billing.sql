-- OneSimpleCommerce subscription billing. These IDs belong to the platform Stripe account,
-- never the merchant's connected account used for customer payments.
create table cp.platform_billing_accounts (
  store_id text primary key references cp.stores on delete cascade,
  stripe_customer_id text not null unique check (stripe_customer_id ~ '^cus_'),
  stripe_subscription_id text unique check (stripe_subscription_id is null or stripe_subscription_id ~ '^sub_'),
  plan_id text not null default 'commerce',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table cp.platform_billing_accounts enable row level security;
create policy store_scope on cp.platform_billing_accounts to oss_runtime
  using (store_id = nullif(current_setting('app.store_id', true), ''));
grant select on cp.platform_billing_accounts to oss_runtime;

insert into cp.schema_migrations(version) values ('0017_platform_billing') on conflict do nothing;
