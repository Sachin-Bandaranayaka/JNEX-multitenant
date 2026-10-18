// src/lib/s3.ts
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// The NEON_STORAGE aliases also work on hosts such as Amplify that reserve
// AWS_* environment variable names. Locally, use Neon's injected AWS_* vars.
const endpoint = process.env.NEON_STORAGE_ENDPOINT || process.env.AWS_ENDPOINT_URL_S3;
const region = endpoint
  ? process.env.NEON_STORAGE_REGION || process.env.AWS_REGION
  : process.env.AWS_S3_REGION || process.env.AWS_REGION;
const accessKeyId = process.env.NEON_STORAGE_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.NEON_STORAGE_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
const s3Client = new S3Client({
  region,
  endpoint,
  forcePathStyle: Boolean(endpoint),
  ...(accessKeyId && secretAccessKey
    ? { credentials: { accessKeyId, secretAccessKey } }
    : {}),
});

const BUCKET_NAME = process.env.NEON_STORAGE_BUCKET || (endpoint ? 'assets' : process.env.AWS_S3_BUCKET_NAME);

function getPublicObjectUrl(key: string) {
  if (!BUCKET_NAME || !region) {
    throw new Error('Object storage bucket and region must be configured.');
  }
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  return endpoint
    ? `${endpoint.replace(/\/$/, '')}/${BUCKET_NAME}/${encodedKey}`
    : `https://${BUCKET_NAME}.s3.${region}.amazonaws.com/${encodedKey}`;
}

export async function getPresignedUploadUrl(key: string, contentType: string) {
  const publicUrl = getPublicObjectUrl(key);
  const uploadHeaders = {
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=31536000, immutable',
  };
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    // Upload keys are unique, so browsers can cache product images safely.
    CacheControl: uploadHeaders['Cache-Control'],
  });

  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 * 5 }); // 5 minutes
  
  return {
    uploadUrl: signedUrl,
    publicUrl,
    uploadHeaders,
  };
}

export async function deleteS3Object(key: string) {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
}

export function getS3KeyFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    if (endpoint) {
      const storageUrl = new URL(endpoint);
      const prefix = `${storageUrl.pathname.replace(/\/$/, '')}/${BUCKET_NAME}/`;
      if (urlObj.origin === storageUrl.origin && urlObj.pathname.startsWith(prefix)) {
        return decodeURIComponent(urlObj.pathname.slice(prefix.length));
      }
    }
    // Only extract deletion keys for the active provider. Old S3 image URLs
    // remain readable, but must not be treated as keys in the Neon bucket.
    if (!endpoint && process.env.AWS_S3_BUCKET_NAME && process.env.AWS_S3_REGION &&
        urlObj.hostname === `${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_S3_REGION}.amazonaws.com`) {
      return decodeURIComponent(urlObj.pathname.slice(1));
    }
    return null;
  } catch {
    return null;
  }
}
