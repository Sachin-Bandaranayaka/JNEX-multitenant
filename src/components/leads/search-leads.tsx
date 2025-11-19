'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useDebounce } from 'use-debounce';

export function SearchLeads() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [searchTerm, setSearchTerm] = useState(searchParams.get('query') || '');
    const [debouncedSearchTerm] = useDebounce(searchTerm, 300);

    const createQueryString = useCallback(
        (name: string, value: string) => {
            const params = new URLSearchParams(Array.from(searchParams.entries()));
            if (value) {
                params.set(name, value);
            } else {
                params.delete(name);
            }
            return params.toString();
        },
        [searchParams]
    );

    const handleSearch = useCallback(() => {
        const queryString = createQueryString('query', searchTerm);
        router.push(`/leads${queryString ? `?${queryString}` : ''}`);
    }, [searchTerm, createQueryString, router]);

    useEffect(() => {
        const timeFilter = searchParams.get('timeFilter') || 'daily';
        let query = createQueryString('query', debouncedSearchTerm);

        // Make sure we preserve the timeFilter parameter
        if (query && timeFilter) {
            if (!query.includes('timeFilter')) {
                const params = new URLSearchParams(query);
                params.set('timeFilter', timeFilter);
                query = params.toString();
            }
        }

        router.push(`/leads${query ? `?${query}` : ''}`);
    }, [debouncedSearchTerm, createQueryString, router, searchParams]);

    return (
        <div className="relative w-64">
            <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        handleSearch();
                    }
                }}
                placeholder="Search leads..."
                className="w-full px-4 py-2 text-sm text-foreground bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-muted-foreground"
            />
            <button
                onClick={handleSearch}
                className="absolute right-2 top-2 p-1 hover:bg-accent rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label="Search"
            >
                <svg
                    className="h-5 w-5 text-muted-foreground"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                >
                    <path
                        fillRule="evenodd"
                        d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                        clipRule="evenodd"
                    />
                </svg>
            </button>
        </div>
    );
} 