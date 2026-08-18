import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RoyalExpressProvider } from './royal-express';
import { ShipmentStatus } from './types';

// Mock fetch
global.fetch = vi.fn();

/** The auth handshake, which the provider makes once and then caches. */
function mockAuth() {
    const body = JSON.stringify({ user: { id: 1 }, token: 'mock-token', message: 'success' });
    (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => JSON.parse(body),
        text: async () => body,
    });
}

/**
 * Queues one tracking lookup. The response is read with .text() — a json-only
 * mock is exactly why every test in this file used to fail with
 * "response.text is not a function" and fall through to PENDING.
 */
function mockTracking(statusName: string) {
    const body = JSON.stringify({
        data: [{ status: { name: statusName }, date_time: '2023-01-01T12:00:00Z' }],
        status: true,
    });

    (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => JSON.parse(body),
        text: async () => body,
    });
}

describe('Royal Express Return Logic', () => {
    let provider: RoyalExpressProvider;

    beforeEach(() => {
        vi.clearAllMocks();
        provider = new RoyalExpressProvider('test@example.com:password');
        mockAuth();
    });

    // These three statuses are what trigger a fee reversal and a restock, so
    // getting them wrong costs real money in both directions.
    it.each([
        'Returned',
        'Returned to Sender',
        'Return to Client',
        'Received Failed Order',
    ])('maps "%s" to RETURNED', async (statusName) => {
        mockTracking(statusName);
        expect(await provider.trackShipment('JX123456')).toBe(ShipmentStatus.RETURNED);
    });

    // Curfox has been seen returning inconsistent casing and trailing spaces.
    // Before this was handled, any of these fell through to EXCEPTION — which
    // maps to SHIPPED, meaning no restock and no fee reversal.
    it.each([
        'returned',
        'RETURNED',
        '  Returned  ',
        'returned to sender',
    ])('maps "%s" to RETURNED despite casing or padding', async (statusName) => {
        mockTracking(statusName);
        expect(await provider.trackShipment('JX123456')).toBe(ShipmentStatus.RETURNED);
    });

    it('still maps the ordinary lifecycle statuses', async () => {
        mockTracking('Delivered');
        expect(await provider.trackShipment('JX123456')).toBe(ShipmentStatus.DELIVERED);

        mockTracking('In Transit');
        expect(await provider.trackShipment('JX123456')).toBe(ShipmentStatus.IN_TRANSIT);

        mockTracking('Rescheduled');
        expect(await provider.trackShipment('JX123456')).toBe(ShipmentStatus.RESCHEDULED);
    });

    it('does not guess at an unrecognised status', async () => {
        mockTracking('Something Curfox Invented Yesterday');
        expect(await provider.trackShipment('JX123456')).toBe(ShipmentStatus.EXCEPTION);
    });
});
