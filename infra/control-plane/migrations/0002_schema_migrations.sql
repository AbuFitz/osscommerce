-- Tracks applied migrations per environment. Applied to dev and staging on 2026-11-14.
create table if not exists cp.schema_migrations (version text primary key, applied_at timestamptz not null default now());
insert into cp.schema_migrations(version) values ('0001_control_plane'),('0002_schema_migrations') on conflict do nothing;
