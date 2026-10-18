# Neon setup and RDS migration

## Production cutover — 18 October 2026

The migration is complete. The live application at `https://jnex.lk` is connected
to the fresh `neondb` database on Neon's `production` branch. The final deployment
succeeded, maintenance mode is off, and the live service tests passed again
after reopening normal requests.

The final RDS snapshot contains **33 tables and 10,664 rows**, including Prisma
migration history. Every table's row count and sorted content hash matched the
restored Neon copy, both before and after live test cleanup. All five
auto-increment sequences are safe for new inserts. A separate verification
confirmed that frozen RDS still matches the final backup.

Live checks used the real `https://jnex.lk` application: password login, the
authenticated store page, product create/read/update/delete, signed image
uploads, browser CORS preflight, anonymous image downloads, and rendering the
new image on the store page. Temporary accounts, products, and images were
removed afterward. The protected diagnostic confirmed the application uses
Neon `neondb`, with database writes enabled.

| Amplify job | Purpose | Result |
| --- | --- | --- |
| 88 | Deploy maintenance mode while still on RDS | Succeeded |
| 89 | Deploy Neon settings while maintenance remains enabled | Succeeded |
| 90 | Reopen normal requests on Neon | Succeeded |

All three releases built application commit
`37de0b2d83dd4a43dba9963f2fc77aeec28a515a`. Job 90 reported `SUCCEED` for
`BUILD`, `DEPLOY`, and `VERIFY`. Automatic builds were temporarily disabled for
these controlled releases; the original setting is restored after publishing
this verification report.

Final production verification output:

```text
PASS: live open checks: {"provider":"neon","database":"neondb","readOnly":false,"maintenance":false}

$ NEON_E2E_BASE_URL=https://jnex.lk NEON_E2E_ALLOW_PRODUCTION=1 NEON_E2E_MIGRATION_TOKEN_FILE=<private-token-file> npm run test:neon
PASS: live app connects to the exact Neon migration target.
PASS: running app is healthy; anonymous uploads are denied.
PASS: real credentials login and authenticated store page use Neon Postgres.
PASS: image upload API, browser CORS, signed PUT and anonymous image GET work end to end.
PASS: the newly uploaded Neon image renders on the store page.
PASS: authenticated product create/read/update/delete persists correctly in Neon.
PASS: temporary database records and uploaded object cleaned up.
[exit code 0]
```

The final public probe also verified the normal unauthenticated page redirect,
HTTP 200 health check, and HTTP 401 rejection of an unauthenticated cron request.
The initial post-interruption diagnostic returned HTTP 404 because its temporary
operator token had expired. Refreshing that token resolved it; the public checks
and full live tests then passed. No deployment or data restore was needed.

Recovery copies retained:

- Original RDS instance `jnex-app-db`, with database and application-role
  read-only defaults enabled. Old application connections were terminated and
  a fresh write probe confirmed writes are rejected.
- Manual RDS snapshot `jnex-pre-neon-20261018`.
- Fresh dump, manifest, source settings, deployment records, and recovery
  helpers in `~/.local/share/jnex-migration/live-cutover/`, outside Git.
- Earlier Neon copy preserved as `neondb_rehearsal_20261018` on the production
  branch. The fresh restore was promoted to the canonical `neondb` name.

Neon's default `env pull` was verified to select the promoted `neondb`.
For `neon connection-string`, specify `--database-name neondb` explicitly
because multiple retained databases make that CLI command require a choice.

Existing S3 image URLs remain intact. New images use Neon's `assets` bucket.
Amplify's database and storage settings were changed while preserving the
existing authentication secret, site URL, mail settings, courier settings,
and cron secret. Normal Neon traffic is open; recover by fixing forward
or transferring new writes back; switching directly to stale RDS would lose
those new writes. The private recovery helper refuses that unsafe rollback.

## Initial rehearsal — 18 October 2026

Neon's `production` branch contains the verified RDS snapshot: 33 application
and migration-history tables, 10,664 rows total. All per-table row counts and
content hashes match the saved snapshot. All five auto-increment sequences
were checked for safe new inserts. Prisma reports no pending local migrations.

The final build and real HTTP service tests passed against the production Neon
branch using the standalone Next.js runtime. Temporary test records and the
uploaded image were removed, and the local test server was stopped afterward.
The full table-count and content-hash comparison was repeated after cleanup
and passed again.
At this earlier rehearsal stage, the live Amplify application still used RDS.
The fresh, frozen-source copy and live cutover are recorded above.

Selected command output:

```text
$ NEXTAUTH_URL=http://localhost:3011 npm run build
✓ Compiled successfully in 7.0s
✓ Generating static pages (46/46)
[exit code 0]

$ PORT=3011 HOSTNAME=127.0.0.1 NEXTAUTH_URL=http://localhost:3011 node .next/standalone/server.js
✓ Ready in 89ms

$ npm run test:neon
PASS: running app is healthy; anonymous uploads are denied.
PASS: real credentials login and authenticated store page use Neon Postgres.
PASS: image upload API, browser CORS, signed PUT and anonymous image GET work end to end.
PASS: authenticated product create/read/update/delete persists correctly in Neon.
PASS: temporary database records and uploaded object cleaned up.
[exit code 0]

PASS: all 33 table counts and content hashes match the RDS backup (10664 rows).
PASS: all 5 auto-increment sequences are safe for new inserts.
Database schema is up to date!
Live Amplify app still uses RDS: True
```

Setup failures and recovery:

- Global `npm i -g neon@latest` failed with `EACCES`; used `npx neon@latest`.
- The skills installer rejected the terminal's Node 22.16.0. Retried with the
  already-installed Codex runtime, Node 24.19.0; no system Node upgrade was needed.
- `init` selected Yarn because the repo has a Yarn lockfile, but Yarn was absent.
  Installed `@neon/config` and `@neon/env` with npm, then explicitly linked the
  supplied project and deployed its services. The npm lockfile is updated.
- Type checking could not resolve `@neon/config/v1` under the existing TypeScript
  resolver. Using the package's root export fixed it without changing the app's
  module-resolution settings.
- CORS writes on the inherited rehearsal bucket returned `NoSuchBucket`.
  Production-bucket CORS configuration succeeded; actual upload preflights and
  transfers passed on both branches. See the storage notes below.
- One diagnostic connection attempt during production restore could not reach
  the database. The subsequent full restore verification, sequence checks,
  Prisma status check, and application service tests all succeeded.
- npm reported 88 dependency audit findings during installation. No unrelated
  dependency upgrades or audit fixes were applied.

The app keeps Prisma 5 and its existing Node.js PostgreSQL connection path. It
does not require a new database driver or a replacement authentication system.
`neon deploy` provisions backend services; Amplify continues to host the Next.js
application.

## Project and services

- Organization: `org-lively-hill-13639928`
- Project: `fancy-pond-82104933` (`jnex`), AWS Ohio (`aws-us-east-2`)
- Target PostgreSQL major version: 18; RDS source: 17.9
- Production branch: `production`
- Rehearsal branch: `migration-rehearsal` (expires after seven days)
- Storage: `assets`, public reads with authenticated writes, for store images

`neon.ts` declares the bucket. Existing S3 image URLs in database rows remain
valid and are not rewritten. Keep the old S3 bucket while those images are used.
New uploads use Neon when its storage endpoint is configured.

## CLI and environment

Use Node.js 22.20 or newer for the complete Neon setup (including its skill
installer). The app itself retains its existing runtime requirements. If a
global Neon install is unavailable, use `npx neon@latest`.

```sh
npx neon@latest login
npx neon@latest link --org-id org-lively-hill-13639928 \
  --project-id fancy-pond-82104933 --branch production -y --no-env-pull
npx neon@latest deploy
```

`deploy` creates declared services and pulls their variables into `.env` when
that file already exists, otherwise `.env.local`. These files and `.neon` are
git-ignored. Keep other local dotenv files from overriding these connection
values with an older RDS URL or credentials from a different Neon branch.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Pooled application connection |
| `DATABASE_URL_UNPOOLED` | Direct connection for Prisma migrations and PostgreSQL backup/restore |
| `AWS_ENDPOINT_URL_S3` | Branch-specific Neon S3 endpoint |
| `AWS_REGION` | Neon storage region |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Branch storage credentials, kept server-side |
| `NEON_STORAGE_BUCKET` | Optional bucket override; defaults to `assets` for Neon |

For browser uploads, configure the bucket's allowed origins after deployment:

```sh
npm run neon:storage:cors -- https://YOUR_APP_DOMAIN
```

The script includes `NEXTAUTH_URL` and the local test origins. The upload API
returns `uploadHeaders`; clients must send those headers with the signed PUT.
New image keys are unique and receive a long-lived public cache header.

During setup, writing CORS on an inherited rehearsal bucket returned
`NoSuchBucket` even though listing, reading, and `HeadBucket` succeeded. Writing
the rules directly on the production bucket succeeded. The rehearsal copy kept
its inherited/default rules. Test the browser preflight after each branch is
provisioned rather than assuming a successful control-plane bucket listing
proves every S3 operation works.

## Build and service verification

Build and start with the same local NextAuth URL:

```sh
NEXTAUTH_URL=http://localhost:3011 npm run build
cp -R public .next/standalone/
cp -R .next/static .next/standalone/.next/
PORT=3011 HOSTNAME=127.0.0.1 NEXTAUTH_URL=http://localhost:3011 \
  node .next/standalone/server.js
```

In another terminal:

```sh
npm run test:neon
```

This uses the app's existing `output: 'standalone'` packaging. The original
`npm run start -- --port 3011` also served the rehearsal smoke test, but Next.js
emitted its standalone-mode warning; the packaged runtime avoids that warning.

The smoke test refuses RDS connections. It defaults to a local app; live
testing accepts only `https://jnex.lk`, requires
`NEON_E2E_ALLOW_PRODUCTION=1` and a short-lived operator-token file, and checks
the running app's target database before creating fixtures. It creates a
temporary tenant and super admin, signs in through the real credentials flow,
loads the store page, requests a signed upload, verifies browser CORS, uploads
and downloads an image, and checks product create/read/update/delete through
the authenticated API. A `finally` block removes its database fixtures and
uploaded object. Test credentials and signed URLs are never printed.

`MAINTENANCE_MODE=1` blocks pages, auth actions, cron calls, API mutations, and
server actions before ordinary public-route exemptions. The health endpoint
stays available. An encrypted, expiring operator token signed with the existing
NextAuth secret enables migration verification; ordinary route permissions
remain enforced. `MAINTENANCE_MODE=0` is compiled into the final normal release.

## Preserving data and final cutover

The initial rehearsal uses a consistent RDS snapshot: `pg_export_snapshot`
ties the `pg_dump` backup to per-table counts and sorted row-content hashes
from the same read-only transaction. The backup includes `_prisma_migrations`,
constraints, indexes, enums, and sequence state. Roles and provider-specific
ownership/ACLs are not copied.

Private backups and source environment settings are stored outside the repo
under `~/.local/share/jnex-migration/`. Do not commit or share that directory.
This run's private backup directory is
`~/.local/share/jnex-migration/20261018T051226Z/` (`rds.dump` and `manifest.json`).
Restore helpers refuse a target containing application tables. Verify every
table against its manifest before running any pending Prisma migrations.

A validated copy is a point-in-time copy. The live Amplify app can continue
writing to RDS, so final cutover requires a new copy or replication:

1. Put the app into maintenance and pause cron jobs, inbound integrations,
   and any other writers. Drain in-flight writes. A browser banner alone does
   not stop database writes.
2. Take a fresh RDS backup and manifest after writes stop. Restore into a new,
   empty Neon destination; do not overwrite an existing populated database
   without a recovery copy and an explicit plan.
3. Verify counts and hashes, check sequence state, and run any pending Prisma
   migrations only against the Neon direct connection.
4. Set Amplify's `DATABASE_URL` and `DATABASE_URL_UNPOOLED` to the same Neon
   branch/database. Rebuild and deploy the app while writes remain paused.
5. Verify the deployed app, reopen writes, and resume background jobs. Keep
   RDS and its backup through the agreed retention period.

Amplify reserves `AWS_*` environment variable names. Copy the Neon storage
values into the following application aliases in Amplify; `amplify.yml` writes
them into the server's production environment:

| Amplify variable | Neon value |
| --- | --- |
| `NEON_STORAGE_ENDPOINT` | `AWS_ENDPOINT_URL_S3` |
| `NEON_STORAGE_REGION` | `AWS_REGION` |
| `NEON_STORAGE_ACCESS_KEY_ID` | `AWS_ACCESS_KEY_ID` |
| `NEON_STORAGE_SECRET_ACCESS_KEY` | `AWS_SECRET_ACCESS_KEY` |
| `NEON_STORAGE_BUCKET` | `assets` |

The Amplify build also accepts legacy `DIRECT_URL` as a fallback when writing
`DATABASE_URL_UNPOOLED`, so existing RDS deployments can build before cutover.
Once Neon accepts production writes, reverting to the old RDS copy requires
reconciling those writes first.

## References

- [Neon Prisma connections](https://neon.com/docs/guides/prisma)
- [PostgreSQL dump and restore](https://neon.com/docs/import/migrate-from-postgres)
- [Neon infrastructure configuration](https://neon.com/docs/reference/neon-ts)
- [Object storage compatibility](https://neon.com/docs/storage/s3-compatibility)
- [Amplify environment variable constraints](https://docs.aws.amazon.com/amplify/latest/userguide/environment-variables.html)
