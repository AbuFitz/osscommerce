-- Detect an applied migration whose source file was later changed.
-- Existing rows are adopted by the migration runner, which calculates and stores their SHA-256 checksums.
alter table cp.schema_migrations add column checksum text;
alter table cp.schema_migrations add constraint schema_migrations_checksum_shape check (checksum is null or checksum ~ '^[0-9a-f]{64}$');

insert into cp.schema_migrations(version) values ('0010_migration_checksums') on conflict do nothing;
