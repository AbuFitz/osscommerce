# Launch status

Last verified: 24 November 2026. This is an evidence record, not a claim that the service is live.

## Verified

- Repository branch `claude/oss-commerce-research-w31rzj` builds and passes the full verification suite. Commit `ef224e7` adds Stripe-hosted platform billing management on top of the tenant-scoped invoice feed in `438a0da`.
- Vercel production deployments for `osscommerce-site` and `osscommerce-portal` are `READY` at commit `ef224e7`.
- The Vercel marketing URL renders correctly at desktop and mobile widths: one H1, no horizontal overflow, complete image alternative text, useful metadata, working internal navigation, and no browser-console warnings observed.
- Vercel has verified `commerce.onesimplesite.co.uk` for the marketing project.
- The engine, storefront gateway and automation worker have deployable runtimes. They are not proof of a hosted live service.

## Blocking launch

| Area | Verified state | Required action |
|---|---|---|
| Commerce DNS | Vercel reports the domain as `misconfigured`; no CNAME or A record resolves. The authoritative nameservers returned by Vercel are `ns33.domaincontrol.com` and `ns34.domaincontrol.com`. | At the DNS provider for `onesimplesite.co.uk`, add `commerce` as a CNAME to `cname.vercel-dns.com`. Recheck Vercel and public DNS before publishing the URL. If IONOS is meant to host DNS, first confirm why the authoritative nameservers still point elsewhere. |
| Marketing enquiries | The Vercel site project has no environment variables, so `/api/enquiry` intentionally returns `not_configured` and the form offers WhatsApp/email instead. | Create a production control-plane database, apply migrations, create an insert-only `oss_site` login and set its TLS `CONTROL_PLANE_DATABASE_URL` on `osscommerce-site`. |
| Portal | The Vercel portal project has only `NEXT_PUBLIC_OSS_DEMO`; no engine, gateway or control-plane variables are installed. | Keep it a protected demo until the production engine, gateway, database and scoped credentials exist. Then install the variables in `docs/deploy/portal-live.md`, remove the demo flag and exercise sign-in end to end. |
| Control plane | Dev and staging were last externally verified only through migration 0002; repository migrations now run through 0018. No production project is recorded. | Create paid production Postgres with PITR, apply 0001–0018 with the owner credential, create narrow runtime/site roles and run the RLS/isolation proofs. Do not point production services at the free dev/staging databases. |
| Railway | The repository-access change was reported complete for the `abukar@abufitz` account, but the engine and gateway have not been observed running at public HTTPS URLs. | Recheck the GitHub connection, deploy the engine and gateway runtimes, install non-placeholder secrets, run migrations/setup and prove `/ready`, `/launch-ready` and gateway `/readyz`. |
| Cloudflare R2 | The last API check returned “Please enable R2 through the Cloudflare Dashboard.” | Enable R2, create the production bucket, issue a bucket-scoped token through the secure credential flow and run the real upload/read proof. |
| Stripe | Sandbox secret and webhook credentials have not been supplied. Platform Billing and merchant Connect are separate code paths and separate credentials. | Use the secure credential form after public callback URLs exist. Complete a sandbox payment, signed webhook, refund, Connect onboarding and Billing Portal proof before live keys. |
| Resend | Worker and webhook code are built; no production API/webhook credentials or verified sending domain are installed. | Verify the sending domain, supply scoped credentials through the secure form, deploy the worker and prove delivery, bounce/complaint suppression and unsubscribe. |
| Legal and hosting | Legal pages are still labelled draft; the recorded Vercel plan is Hobby. | Obtain legal review before setting `NEXT_PUBLIC_LEGAL_REVIEWED=1`; move commercial production projects to a suitable paid Vercel plan before launch. |

## Do not call live until

The custom domain resolves publicly, enquiries persist, portal demo mode is removed, engine/gateway/worker health checks pass, migrations and tenant isolation are proven on production, R2/Stripe/Resend end-to-end proofs pass, legal review is recorded, and a paid production hosting/backup posture is in place.

## Switch-on checklist (updated 25 November 2026)

Everything below is built and tested; each item is a setting or an account, not more code. Staging engine: migrations through `StaffTokens1795400000000` are applied there; control-plane migrations now run through `0019_account_email_rules`.

| Item | Where | Needed |
|---|---|---|
| Staff invitation and reset links | Engine (`PORTAL_URL`) | The portal's public address. Without it the engine refuses invitations rather than creating an account nobody can enter. |
| Account emails sender | Automation worker (`ACCOUNT_EMAIL_FROM`, optional `ACCOUNT_EMAIL_REPLY_TO`) | An address on the Resend-verified domain. |
| Account email rules | Control plane | Apply `0019_account_email_rules` (adds `staff_invite` and `staff_password_reset` for every store, existing and new). |
| Resend | Worker | Verified sending domain, API key and webhook secret (via the secure credential form). Until then invitations are queued in the engine outbox and sent once delivery is on. |
| Stripe | Engine and billing | Sandbox then live keys; webhook routing per store follows. |
| Sentry | Engine, portal, site | DSN (error reporting only). |
| Control plane for the portal | Portal | `CONTROL_PLANE_DATABASE_URL`. Preferences, payment setup and enquiries fail closed without it. |

Proven on a real Postgres 16 with the real engine and portal in live mode (see the capability audit): sign-in, role-limited staff, invitation and reset by emailed link, sign-in lockout, orders by hand, bulk fulfil, customer export and erase, rich-text descriptions, activity log, phone and tablet layouts.
