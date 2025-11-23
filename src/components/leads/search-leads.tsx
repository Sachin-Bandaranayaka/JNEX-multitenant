'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useDebounce } from 'use-debounce';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

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
        <div className="relative w-full sm:w-64">
            <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
                    className="w-full h-10 pl-10 pr-4 text-sm text-foreground bg-muted/50 border-none rounded-full focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground transition-all"
                />
            </div>
        </div>
    );
}