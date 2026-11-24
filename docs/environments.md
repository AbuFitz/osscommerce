# Environments

Three environments, fully separate: **dev**, **staging**, **production**. Nothing is shared between them except code. Production data never leaves production; everything else uses synthetic data.

| | dev | staging | production |
|---|---|---|---|
| Purpose | Daily work, PR previews | Release rehearsal, test payments, restore drills | Real merchants |
| Git | any branch, PR previews | `staging` branch | `main`, protected, approval required |
| Database | Neon `oss-commerce-dev` (`polished-art-58971441`) | Neon `oss-commerce-staging` (`plain-waterfall-47874269`) | Neon `oss-commerce-prod` (**not created**) |
| Stripe | test mode, platform test account | test mode, separate webhook endpoint and secret | live mode only |
| Email | sink (Resend test domain or Mailpit), never real recipients | sink | authenticated sending domain |
| Object storage | separate R2 bucket | separate R2 bucket | separate R2 bucket |
| Domains | `*.dev.<domain>` | `*.staging.<domain>` | real domains |
| Search engines | blocked | blocked | allowed (`APP_ENV=production`) |
| Demo data | allowed (`NEXT_PUBLIC_OSS_DEMO=1`) | allowed for rehearsal | **never**; the portal throws if set |
| Data | synthetic only | synthetic only | real |

## Safeguards already in code
- Portal fails closed without a gateway; demo fixtures need an explicit flag, and the flag is refused when `APP_ENV=production`.
- Marketing site `robots.txt` disallows everything unless `APP_ENV=production`.
- Legal pages show a draft notice until `NEXT_PUBLIC_LEGAL_REVIEWED=1`.
- CI: typecheck, unit tests, portal and site builds, secret scan, and the Vendure tenancy proof.

## Still to do before real data
1. Create `oss-commerce-prod` on a paid Neon plan with point-in-time restore. The two existing projects are on the free plan (6 hours of history) and are not durable.
2. Create Vercel projects (portal, site, storefronts) and the Railway engine service per environment, with production deploys behind approval. Not created yet because they are outward-facing and cost money; say the word and I will.
3. Stripe: separate test and live webhook endpoints; reject `sk_live_` keys outside production at startup.
4. Secrets only in each platform's vault. Never in Git, never in `NEXT_PUBLIC_*`.
5. Run the checked-in control-plane migrator per environment (canary first): `CONTROL_PLANE_DATABASE_URL=... npm run migrate:control-plane`. Use `-- --check` as the deploy gate; it detects pending, unknown and changed migrations.
6. Restore drill in staging, a load test of checkout and concurrent last-unit purchases, and an independent security review before real payments.
