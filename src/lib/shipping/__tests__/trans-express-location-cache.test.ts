import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCachedTransExpressLocations } from '../trans-express-location-cache';

describe('Trans Express location cache', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reuses a loaded location list', async () => {
    const loader = vi.fn().mockResolvedValue([{ id: 1, text: 'Colombo' }]);

    const first = await getCachedTransExpressLocations('cache-reuse-tenant', 'cities', loader);
    const second = await getCachedTransExpressLocations('cache-reuse-tenant', 'cities', loader);

    expect(second).toBe(first);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent loads', async () => {
    let resolveLoad!: (value: string[]) => void;
    const loader = vi.fn(() => new Promise<string[]>((resolve) => {
      resolveLoad = resolve;
    }));

    const first = getCachedTransExpressLocations('cache-pending-tenant', 'districts', loader);
    const second = getCachedTransExpressLocations('cache-pending-tenant', 'districts', loader);
    resolveLoad(['Colombo']);

    await expect(first).resolves.toEqual(['Colombo']);
    await expect(second).resolves.toEqual(['Colombo']);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('reloads an expired location list', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-05T00:00:00Z'));
    const loader = vi.fn()
      .mockResolvedValueOnce(['old'])
      .mockResolvedValueOnce(['new']);

    await getCachedTransExpressLocations('cache-expiry-tenant', 'cities', loader);
    vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1);

    await expect(getCachedTransExpressLocations('cache-expiry-tenant', 'cities', loader))
      .resolves.toEqual(['new']);
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
