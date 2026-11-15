-- 0008: enquiries from the public marketing site (prospective merchants). Personal data: name, email, optional phone.
-- Retention is a policy decision still to be made; rows carry created_at so a purge job can be added.
create table if not exists cp.enquiries (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  name          text not null check (char_length(name) between 2 and 120),
  email         text not null check (char_length(email) between 5 and 254),
  phone         text check (phone is null or char_length(phone) <= 40),
  business      text not null check (char_length(business) between 1 and 160),
  website       text check (website is null or char_length(website) <= 300),
  selling_now   text not null check (selling_now in ('not_yet','own_site','marketplace','in_person','other')),
  product_range text not null check (product_range in ('1-10','11-50','51-250','250+','unsure')),
  message       text check (message is null or char_length(message) <= 4000),
  source_path   text,
  status        text not null default 'new' check (status in ('new','contacted','qualified','closed')),
  handled_at    timestamptz
);
create index if not exists enquiries_created_idx on cp.enquiries (created_at desc);
create index if not exists enquiries_status_idx on cp.enquiries (status) where status = 'new';
-- The marketing site may only add rows. It cannot read, change or delete enquiries, so a leaked site credential exposes nobody's details.
do $$ begin if not exists (select 1 from pg_roles where rolname = 'oss_site') then create role oss_site nologin; end if; end $$;
grant usage on schema cp to oss_site;
grant insert on cp.enquiries to oss_site;
alter table cp.enquiries enable row level security;
drop policy if exists site_insert on cp.enquiries;
create policy site_insert on cp.enquiries for insert to oss_site with check (status = 'new' and handled_at is null);
insert into cp.schema_migrations(version) values ('0008_enquiries') on conflict do nothing;
