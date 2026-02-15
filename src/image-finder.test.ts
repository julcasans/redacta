import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callCustomSearch } from './image-finder.js';

// Mock fetch globally
const fetchMock = vi.fn();
global.fetch = fetchMock;

describe('Image Finder', () => {
    beforeEach(() => {
        fetchMock.mockClear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });
    
    it('should return null on fetch error', async () => {
        fetchMock.mockResolvedValue({
            ok: false,
            statusText: 'Not Found'
        });
        
        const result = await callCustomSearch('query', 'key', 'cx');
        expect(result).toBeNull();
    });

    it('should return image data on success', async () => {
        const mockData = {
            items: [
                {
                    link: 'http://example.com/image.jpg',
                    title: 'Example Image'
                }
            ]
        };
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => mockData
        });

        const result = await callCustomSearch('query', 'key', 'cx');
        expect(result).toEqual({
            link: 'http://example.com/image.jpg',
            title: 'Example Image'
        });
    });

    it('should return null if no items found', async () => {
        const mockData = {
            items: []
        };
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => mockData
        });

        const result = await callCustomSearch('query', 'key', 'cx');
        expect(result).toBeNull();
    });
});
