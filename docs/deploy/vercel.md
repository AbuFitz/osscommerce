# Deploying the site and the portal demo to Vercel

Two Vercel projects from the same GitHub repo (`AbuFitz/osscommerce`, branch `claude/oss-commerce-research-w31rzj` until merged). Both are npm workspaces, so leave **"Include source files outside of the Root Directory"** on (the default).

| | Marketing site | Portal (demo) |
|---|---|---|
| Project name | `osscommerce-site` | `osscommerce-portal` |
| Root Directory | `apps/site` | `apps/portal` |
| Framework | Next.js | Next.js |
| Environment variables | none | `NEXT_PUBLIC_OSS_DEMO=1` (Production and Preview) |
| Protection | public once DNS and the enquiry destination are verified | keep **Vercel Authentication** on while it is demo data, not a live store |

Notes
- The portal refuses to run on live data with the demo flag off; the demo flag is what enables fixtures, the `?state=` payment-state previews and phone photo upload (in-memory storage, resets on each deploy or cold start, so treat it as a preview only).
- Phone photo upload needs a URL the phone can reach, which a Vercel preview URL is. Note that with Vercel Authentication on, a phone must be signed in to Vercel to open the link, or add a protection-bypass for the demo.
- The site's legal pages stay marked as drafts until `NEXT_PUBLIC_LEGAL_REVIEWED=1` is set, after a solicitor has reviewed them.
- Plan: the account is on Vercel **Hobby**, which Vercel restricts to non-commercial use. A site that advertises a paid commercial product should move to Pro before launch. Hobby allows up to 200 projects and one concurrent build.
