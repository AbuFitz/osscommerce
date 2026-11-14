# Control plane database

Neon project `oss-commerce-dev` (`polished-art-58971441`, AWS London `aws-eu-west-2`, PG 18, free plan, **dev only, synthetic data only**), database `control_plane`. Migration `migrations/0001_control_plane.sql` is applied.

Verified against the live database (in a rolled-back transaction, as role `oss_runtime`):
unset store context returns 0 rows · store A cannot read or write store B · write grants over 60 minutes rejected · audit log rejects delete · only verified hostnames resolve.

Not done: login role + password for `oss_runtime` (create when the gateway exists; keep credentials in the platform vault, never in Git), staging/prod projects, PITR retention (free plan keeps 6 hours), per-merchant engine cell databases.
