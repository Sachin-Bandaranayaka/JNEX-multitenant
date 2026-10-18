// Apply after `neon deploy` and whenever the application's origins change.
const fs = require('node:fs');
const dotenv = require('dotenv');
const { S3Client, PutBucketCorsCommand } = require('@aws-sdk/client-s3');

const externalEnv = { ...process.env };
const envFiles = process.env.NEON_ENV_FILE ? [process.env.NEON_ENV_FILE] : ['.env', '.env.local'];
for (const file of envFiles) {
  if (fs.existsSync(file)) Object.assign(process.env, dotenv.parse(fs.readFileSync(file)));
}
Object.assign(process.env, externalEnv);

async function main() {
  const endpoint = process.env.NEON_STORAGE_ENDPOINT || process.env.AWS_ENDPOINT_URL_S3;
  if (!endpoint || !new URL(endpoint).hostname.endsWith('.neon.tech')) {
    throw new Error('Pull Neon storage environment variables before configuring CORS.');
  }
  const origins = [...new Set([
    'http://localhost:3000',
    'http://localhost:3011',
    process.env.NEXTAUTH_URL,
    ...process.argv.slice(2),
  ].filter(Boolean).map(value => new URL(value).origin))];
  const client = new S3Client({
    endpoint,
    region: process.env.NEON_STORAGE_REGION || process.env.AWS_REGION,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.NEON_STORAGE_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.NEON_STORAGE_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
  try {
    await client.send(new PutBucketCorsCommand({
      Bucket: process.env.NEON_STORAGE_BUCKET || 'assets',
      CORSConfiguration: { CORSRules: [{
        AllowedOrigins: origins,
        AllowedMethods: ['GET', 'HEAD', 'PUT'],
        AllowedHeaders: ['content-type', 'cache-control', 'x-amz-*'],
        ExposeHeaders: ['ETag'],
        MaxAgeSeconds: 3600,
      }] },
    }));
    console.log(`Configured Neon storage CORS for ${origins.length} application origins.`);
  } finally {
    client.destroy();
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
