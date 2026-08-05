const LOCATION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const locationCache = new Map<string, CacheEntry<unknown>>();
const pendingLoads = new Map<string, Promise<unknown>>();

/** Reuse slow-changing courier location lists and deduplicate concurrent loads. */
export async function getCachedTransExpressLocations<T>(
  tenantId: string,
  resource: 'cities' | 'districts',
  loader: () => Promise<T>,
): Promise<T> {
  const key = `${tenantId}:${resource}`;
  const cached = locationCache.get(key) as CacheEntry<T> | undefined;
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const pending = pendingLoads.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const load = loader()
    .then((value) => {
      locationCache.set(key, { value, expiresAt: Date.now() + LOCATION_CACHE_TTL_MS });
      return value;
    })
    .finally(() => pendingLoads.delete(key));

  pendingLoads.set(key, load);
  return load;
}
