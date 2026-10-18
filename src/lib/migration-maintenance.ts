import { decode } from 'next-auth/jwt';

export function isMigrationMaintenance() {
  return process.env.MAINTENANCE_MODE === '1';
}

// Only a short-lived token minted by the operator with the existing server
// secret can bypass maintenance. It does not bypass normal route permissions.
export async function hasMigrationBypass(headers: Headers) {
  const token = headers.get('x-migration-token');
  const secret = process.env.NEXTAUTH_SECRET;
  if (!token || !secret) return false;
  try {
    const claims = await decode({ token, secret });
    return claims?.purpose === 'rds-neon-cutover';
  } catch {
    return false;
  }
}
