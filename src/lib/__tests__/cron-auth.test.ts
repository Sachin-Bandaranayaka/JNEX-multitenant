import { afterEach, describe, expect, it } from 'vitest';
import { isAuthorizedCronRequest } from '@/lib/cron-auth';

const original = { CRON_SECRET: process.env.CRON_SECRET, CRON_SECRET_KEY: process.env.CRON_SECRET_KEY };

function req(authorization?: string) {
  return new Request('https://example.test/api/cron/x', {
    headers: authorization ? { authorization } : {},
  });
}

afterEach(() => {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('isAuthorizedCronRequest', () => {
  it('accepts the Vercel CRON_SECRET', () => {
    process.env.CRON_SECRET = 'vercel-secret';
    delete process.env.CRON_SECRET_KEY;
    expect(isAuthorizedCronRequest(req('Bearer vercel-secret'))).toBe(true);
  });

  it('accepts the legacy CRON_SECRET_KEY', () => {
    delete process.env.CRON_SECRET;
    process.env.CRON_SECRET_KEY = 'legacy-secret';
    expect(isAuthorizedCronRequest(req('Bearer legacy-secret'))).toBe(true);
  });

  it('rejects a wrong or missing header', () => {
    process.env.CRON_SECRET = 'vercel-secret';
    expect(isAuthorizedCronRequest(req('Bearer nope'))).toBe(false);
    expect(isAuthorizedCronRequest(req())).toBe(false);
  });

  it('rejects "Bearer undefined" when no secret is configured', () => {
    delete process.env.CRON_SECRET;
    delete process.env.CRON_SECRET_KEY;
    expect(isAuthorizedCronRequest(req('Bearer undefined'))).toBe(false);
    expect(isAuthorizedCronRequest(req('Bearer '))).toBe(false);
  });
});
