# Switching on email with Resend: a ten-step runbook

Everything below is built and tested. These are the account steps only you can do. Never paste a key into chat: use the secure credential form when I ask for one, or set it directly in the host's variables.

1. **Create the Resend account** and add your sending domain (for example `mail.onesimplecommerce.com`). A subdomain keeps marketing reputation away from your main mail.
2. **Add the DNS records Resend shows** (SPF, DKIM, and optionally DMARC) at your DNS host, then press Verify in Resend. Wait until it says Verified.
3. **Create an API key** with *Sending access* only, restricted to that domain. Name it `osc-automation-worker`.
4. **Create a webhook** in Resend pointing at `https://<worker host>/webhooks/resend`, with events: delivered, bounced, complained, delivery_delayed. Copy its signing secret.
5. **Deploy the automation worker** (`apps/automation-worker/Dockerfile`, one always-on process) with: `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `ACCOUNT_EMAIL_FROM` (an address on the verified domain, for example `accounts@mail.onesimplecommerce.com`), optional `ACCOUNT_EMAIL_REPLY_TO`, `CONTROL_PLANE_DATABASE_URL`, `QUEUE_DATABASE_URL`, `UNSUBSCRIBE_SECRET`, `PUBLIC_BASE_URL`, `CELL_CREDENTIALS_JSON`, `APP_ENV`. Details: `automation-worker.md`.
6. **Apply control-plane migrations through `0019_account_email_rules`** (adds the staff invitation and reset rules for every store).
7. **Point each engine at the worker**: the cell's outbox needs the worker's ingest URL and its cell secret (`CELL_CREDENTIALS_JSON` holds the matching secret on the worker side).
8. **Set `PORTAL_URL`** on each engine to the merchant portal's public address, so emailed links point somewhere real.
9. **Send yourself a test**: in the portal, Team and access, invite a personal address. You should receive "…invited you to OneSimpleCommerce" within a minute; the link should open "Welcome. Choose a password"; setting it should let you sign in. Then try "Forgot your password?".
10. **Check the delivery record**: the worker's runs table should show `sent`, and Resend's dashboard should show the message delivered. A bounce or complaint adds the address to the suppression list automatically.

## What to tell me afterwards

Say "Resend is set up" and I will: verify the worker's `/healthz` and `/readyz`, trigger a real invitation and reset against staging, confirm the run reaches `sent`, and then build campaigns to a segment on top of the consent ledger.

## Before any marketing email

Campaigns need recorded consent. Confirm your checkout asks for marketing consent (Settings, Preferences), that the privacy policy is published, and that each campaign carries an unsubscribe link (the worker adds the header and link for marketing rules). Have your adviser confirm PECR/GDPR wording for the consent text.
