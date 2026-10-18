# Neon setup and RDS migration

## Verified status — 18 October 2026

Neon's `production` branch contains the verified RDS snapshot: 33 application
and migration-history tables, 10,664 rows total. All per-table row counts and
content hashes match the saved snapshot. All five auto-increment sequences
were checked for safe new inserts. Prisma reports no pending local migrations.

The final build and real HTTP service tests passed against the production Neon
branch using the standalone Next.js runtime. Temporary test records and the
uploaded image were removed, and the local test server was stopped afterward.
The full table-count and content-hash comparison was repeated after cleanup
and passed again.
The live Amplify application at `https://jnex.lk` still uses RDS. This is a
validated point-in-time copy, not a completed live cutover; writes made on RDS
after the snapshot still need to be transferred during final cutover.

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

The smoke test refuses RDS connections and non-local app URLs. It creates a
temporary tenant and super admin, signs in through the real credentials flow,
loads the store page, requests a signed upload, verifies browser CORS, uploads
and downloads an image, and checks product create/read/update/delete through
the authenticated API. A `finally` block removes its database fixtures and
uploaded object. Test credentials and signed URLs are never printed.

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
