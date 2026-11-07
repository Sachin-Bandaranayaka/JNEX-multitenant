// src/lib/cron-auth.ts
//
// Shared bearer-token check for /api/cron/* routes.
//
// Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. External schedulers
// (cron-job.org, EventBridge) were set up with CRON_SECRET_KEY. Accept either,
// so the same build works on both while the hosting move is in progress.
// An unset secret never matches: "Bearer undefined" must not authorize.

import { timingSafeEqual } from 'crypto';

function configuredSecrets(): string[] {
  return [process.env.CRON_SECRET, process.env.CRON_SECRET_KEY].filter(
    (secret): secret is string => typeof secret === 'string' && secret.length > 0,
  );
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function isAuthorizedCronRequest(request: Request): boolean {
  const header = request.headers.get('authorization');
  if (!header) return false;
  return configuredSecrets().some((secret) => safeEqual(header, `Bearer ${secret}`));
}
