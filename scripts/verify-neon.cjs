// Tests the running app through real HTTP authentication, CRUD and image uploads.
// Only temporary fixtures are created; they are removed in the finally block.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const dotenv = require('dotenv');
const { hash } = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const externalEnv = { ...process.env };
for (const file of ['.env', '.env.local']) {
  if (fs.existsSync(file)) Object.assign(process.env, dotenv.parse(fs.readFileSync(file)));
}
Object.assign(process.env, externalEnv);

const base = new URL(process.env.NEON_E2E_BASE_URL || 'http://localhost:3011');
const local = ['localhost', '127.0.0.1'].includes(base.hostname);
const live = base.origin === 'https://jnex.lk' && process.env.NEON_E2E_ALLOW_PRODUCTION === '1';
if (!local && !live) {
  throw new Error('Remote testing requires the explicit production flag and the jnex.lk origin.');
}
const migrationToken = process.env.NEON_E2E_MIGRATION_TOKEN_FILE
  ? fs.readFileSync(process.env.NEON_E2E_MIGRATION_TOKEN_FILE, 'utf8').trim() : '';
if (live && !migrationToken) throw new Error('Live migration verification requires a short-lived operator token.');
if (!new URL(process.env.DATABASE_URL).hostname.endsWith('.neon.tech')) {
  throw new Error('This test requires Neon; it must never run against RDS.');
}
const endpoint = process.env.NEON_STORAGE_ENDPOINT || process.env.AWS_ENDPOINT_URL_S3;
if (!endpoint || !new URL(endpoint).hostname.endsWith('.neon.tech')) {
  throw new Error('Neon storage credentials are required.');
}
const db = new PrismaClient();
const storage = new S3Client({
  endpoint,
  region: process.env.NEON_STORAGE_REGION || process.env.AWS_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.NEON_STORAGE_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.NEON_STORAGE_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
  },
});
const bucket = process.env.NEON_STORAGE_BUCKET || 'assets';
const cookies = new Map();
const id = randomUUID();
let tenant, user, product, objectKey;

async function request(path, options = {}) {
  const response = await fetch(new URL(path, base), {
    ...options,
    redirect: 'manual',
    headers: {
      Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; '),
      ...(migrationToken ? { 'X-Migration-Token': migrationToken } : {}),
      ...options.headers,
    },
    signal: AbortSignal.timeout(30000),
  });
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(';', 1)[0];
    const index = pair.indexOf('=');
    cookies.set(pair.slice(0, index), pair.slice(index + 1));
  }
  return response;
}

async function jsonRequest(path, method, body) {
  const response = await request(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  assert.equal(response.status, 200, `${method} ${path} returned ${response.status}`);
  return response.json();
}

async function main() {
  try {
    if (live) {
      const target = await jsonRequest('/api/migration/verify', 'GET');
      assert.equal(target.provider, 'neon');
      assert.equal(target.database, decodeURIComponent(new URL(process.env.DATABASE_URL).pathname.slice(1)));
      assert.equal(target.readOnly, false);
      console.log('PASS: live app connects to the exact Neon migration target.');
    }
    assert.equal((await request('/api/health')).status, 200);
    assert.equal((await request('/api/store/upload', { method: 'POST' })).status, 401);
    console.log('PASS: running app is healthy; anonymous uploads are denied.');

    tenant = await db.tenant.create({ data: { name: `Neon smoke test ${id}` } });
    const password = randomUUID();
    user = await db.user.create({ data: {
      email: `neon-smoke-${id}@example.invalid`, name: 'Temporary Neon verifier',
      password: await hash(password, 12), role: 'SUPER_ADMIN', permissions: [], tenantId: tenant.id,
    } });
    const csrf = await (await request('/api/auth/csrf')).json();
    const login = await request('/api/auth/callback/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Auth-Return-Redirect': '1' },
      body: new URLSearchParams({ csrfToken: csrf.csrfToken, email: user.email, password, callbackUrl: base.href, json: 'true' }),
    });
    assert.equal(login.status, 200, 'Credentials sign-in failed');
    const session = await (await request('/api/auth/session')).json();
    assert.equal(session.user?.id, user.id);
    assert.equal((await request('/superadmin/store')).status, 200);
    console.log('PASS: real credentials login and authenticated store page use Neon Postgres.');

    const upload = await jsonRequest('/api/store/upload', 'POST', { fileName: 'neon-smoke.png', contentType: 'image/png' });
    const prefix = `${endpoint.replace(/\/$/, '')}/${bucket}/`;
    assert.ok(upload.publicUrl.startsWith(prefix));
    objectKey = decodeURIComponent(upload.publicUrl.slice(prefix.length));
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRz8AAAAASUVORK5CYII=', 'base64');
    const preflight = await fetch(upload.uploadUrl, {
      method: 'OPTIONS',
      headers: { Origin: base.origin, 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'content-type,cache-control' },
    });
    assert.ok(preflight.ok, `Storage CORS preflight returned ${preflight.status}`);
    assert.ok([base.origin, '*'].includes(preflight.headers.get('access-control-allow-origin')));
    const put = await fetch(upload.uploadUrl, { method: 'PUT', body: png, headers: upload.uploadHeaders });
    assert.ok(put.ok, `Presigned upload returned ${put.status}`);
    const image = await fetch(upload.publicUrl);
    assert.equal(image.status, 200);
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), png);
    console.log('PASS: image upload API, browser CORS, signed PUT and anonymous image GET work end to end.');

    product = await jsonRequest('/api/store/products', 'POST', {
      name: 'Temporary Neon smoke product', sku: `neon-${id}`, price: 1, stock: 1, imageUrl: upload.publicUrl,
    });
    assert.equal((await db.storeProduct.findUniqueOrThrow({ where: { id: product.id } })).imageUrl, upload.publicUrl);
    const storePage = await request('/superadmin/store');
    assert.equal(storePage.status, 200);
    assert.ok((await storePage.text()).includes(upload.publicUrl), 'The uploaded image must render on the store page');
    console.log('PASS: the newly uploaded Neon image renders on the store page.');
    await jsonRequest(`/api/store/products/${product.id}`, 'PUT', { stock: 2 });
    const read = await jsonRequest(`/api/store/products/${product.id}`, 'GET');
    assert.equal(read.stock, 2);
    await jsonRequest(`/api/store/products/${product.id}`, 'DELETE');
    assert.equal((await db.storeProduct.findUniqueOrThrow({ where: { id: product.id } })).isActive, false);
    console.log('PASS: authenticated product create/read/update/delete persists correctly in Neon.');
  } finally {
    // Attempt every cleanup even if an earlier cleanup fails.
    const errors = [];
    for (const cleanup of [
      () => product && db.storeProduct.delete({ where: { id: product.id } }),
      () => objectKey && storage.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey })),
      () => user && db.user.delete({ where: { id: user.id } }),
      () => tenant && db.tenant.delete({ where: { id: tenant.id } }),
    ]) {
      try { await cleanup(); } catch (error) { errors.push(error); }
    }
    await db.$disconnect();
    storage.destroy();
    if (errors.length) throw new AggregateError(errors, 'Some smoke-test fixtures could not be removed.');
    console.log('PASS: temporary database records and uploaded object cleaned up.');
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
