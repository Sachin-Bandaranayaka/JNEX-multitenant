# Moving production from AWS Amplify to Vercel

Both hosts talk to the same Neon database and storage, so there is no data to
move. The move is environment variables, crons and DNS.

The repo is already linked to a Vercel project (`.vercel/project.json`), and
Vercel builds with `npm run vercel-build`, which runs `prisma migrate deploy`
before `next build`.

## 1. Before anything else: check the existing Vercel project

- In the Vercel dashboard, open the linked project → Settings → Git. If it is
  still connected to GitHub, every push to `main` builds there **and runs
  migrations against whatever `DATABASE_URL` it holds**. Confirm what that is.
- There are two Vercel projects, both named `jnex` and both on the
  production database: `janith-bhs-projects` (https://jnex-phi.vercel.app)
  and `mjelectricals` (https://jnex-two.vercel.app). **Crons run from the
  J-nex project only**; they are disabled on `mjelectricals` (Settings →
  Cron Jobs), and cron-job.org should call `jnex-phi` only. Both are on Hobby. Hobby is for non-commercial use and only allows daily
  crons; see section 3 for how the hourly job runs.

## 2. Environment variables

Copy these from Amplify (App settings → Environment variables) into Vercel
(Settings → Environment Variables). These are the ones `amplify.yml` writes at
build time; also copy anything else set in the Amplify console (for example
`NEXT_PUBLIC_*`, Royal Express, S3).

| Variable | Production | Preview |
| --- | --- | --- |
| `DATABASE_URL`, `DIRECT_URL`, `DATABASE_URL_UNPOOLED` | prod Neon | **a Neon branch, never prod** |
| `NEXTAUTH_SECRET` | same as Amplify | any |
| `NEXTAUTH_URL` | final domain (`https://…`) | leave unset or preview URL |
| `CRON_SECRET` | new: same value as `CRON_SECRET_KEY` | any |
| `CRON_SECRET_KEY` | same as Amplify | any |
| `NEON_STORAGE_ENDPOINT`, `_REGION`, `_BUCKET`, `_ACCESS_KEY_ID`, `_SECRET_ACCESS_KEY` | same as Amplify | same or a test bucket |
| `RESEND_API_KEY`, `MAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | same as Amplify | same |
| `MAINTENANCE_MODE` | `0` | `0` |

Preview builds run `prisma migrate deploy` too, which is why Preview must not
point at the production database.

`CRON_SECRET` is the name Vercel Cron sends as `Authorization: Bearer …`.
The cron routes accept either `CRON_SECRET` or `CRON_SECRET_KEY`
(`src/lib/cron-auth.ts`).

## 3. Crons

The project is on the Vercel Hobby plan, which only allows daily crons, so
the jobs are split (times are UTC):

| Route | Runs from | Schedule |
| --- | --- | --- |
| `/api/cron/close-billing` | `vercel.json` | 02:00 on the 1st |
| `/api/cron/credit-maintenance` | `vercel.json` | 03:00 daily |
| `/api/cron/tracking-updates` | cron-job.org | hourly |

Vercel only runs crons on **production** deployments.

Once the Vercel production deployment is live, in cron-job.org:

- Point the tracking job at `https://<vercel-domain>/api/cron/tracking-updates`
  (header `Authorization: Bearer <CRON_SECRET_KEY>`). See `CRON_SETUP.md`.
- **Disable** any job calling `close-billing` or `credit-maintenance`, since
  Vercel now runs those. They are idempotent, but there is no reason to run
  them twice.

On the Pro plan, `tracking-updates` can move into `vercel.json` with
`"schedule": "0 * * * *"` and the cron-job.org job can be retired.

## 4. Cutover

1. Deploy to Vercel production and test on the `*.vercel.app` URL: sign in,
   load orders, upload an image, and call one cron by hand:
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" https://<project>.vercel.app/api/cron/credit-maintenance
   ```
2. Add the custom domain in Vercel and set `NEXTAUTH_URL` to it, then redeploy.
3. Point DNS at Vercel. Sessions and data carry over (same secret, same DB).
4. Disable the external cron jobs.
5. Turn off auto-build on Amplify, but keep the app for a few days as a
   rollback (switch DNS back).
6. Once settled, delete the Amplify app, `amplify.yml` and
   `docs/AWS_CRON_SETUP.md`.
