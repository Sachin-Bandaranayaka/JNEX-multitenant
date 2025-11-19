
import { RoyalExpressProvider } from './royal-express';
import { ShipmentStatus } from './types';

// Mock fetch
global.fetch = jest.fn();

describe('Royal Express Return Logic', () => {
    let provider: RoyalExpressProvider;

    beforeEach(() => {
        provider = new RoyalExpressProvider('test@example.com:password');
    });

    test('should map "Returned" to ShipmentStatus.RETURNED', async () => {
        // Access private method via any cast or testing a public method that uses it
        // Since normalizeStatus is private, we can test trackShipment with a mocked response

        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            text: async () => JSON.stringify({
                user: { id: 1 },
                token: 'mock-token',
                message: 'success'
            })
        });

        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            text: async () => JSON.stringify({
                data: [{
                    status: { name: 'Returned' },
                    date_time: '2023-01-01T12:00:00Z'
                }],
                status: true
            })
        });

        const status = await provider.trackShipment('JX123456');
        expect(status).toBe(ShipmentStatus.RETURNED);
    });

    test('should map "Returned to Sender" to ShipmentStatus.RETURNED', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            text: async () => JSON.stringify({
                user: { id: 1 },
                token: 'mock-token',
                message: 'success'
            })
        });

        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            text: async () => JSON.stringify({
                data: [{
                    status: { name: 'Returned to Sender' },
                    date_time: '2023-01-01T12:00:00Z'
                }],
                status: true
            })
        });

        const status = await provider.trackShipment('JX123456');
        expect(status).toBe(ShipmentStatus.RETURNED);
    });

    test('should map "Return to Client" to ShipmentStatus.RETURNED', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            text: async () => JSON.stringify({
                user: { id: 1 },
                token: 'mock-token',
                message: 'success'
            })
        });

        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            text: async () => JSON.stringify({
                data: [{
                    status: { name: 'Return to Client' },
                    date_time: '2023-01-01T12:00:00Z'
                }],
                status: true
            })
        });

        const status = await provider.trackShipment('JX123456');
        expect(status).toBe(ShipmentStatus.RETURNED);
    });
});
