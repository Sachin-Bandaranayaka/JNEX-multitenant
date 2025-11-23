'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { ChevronDownIcon, ArrowsUpDownIcon } from '@heroicons/react/24/outline';

type SortOption = {
    label: string;
    value: string;
    direction: 'asc' | 'desc';
};

export function SortOrders() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const currentSort = searchParams.get('sort') || 'createdAt:asc';
    const [isOpen, setIsOpen] = useState(false);

    const sortOptions: SortOption[] = [
        { label: 'Date (Oldest)', value: 'createdAt', direction: 'asc' },
        { label: 'Date (Newest)', value: 'createdAt', direction: 'desc' },
        { label: 'Total (High to Low)', value: 'total', direction: 'desc' },
        { label: 'Total (Low to High)', value: 'total', direction: 'asc' },
        { label: 'Customer Name (A-Z)', value: 'customerName', direction: 'asc' },
        { label: 'Customer Name (Z-A)', value: 'customerName', direction: 'desc' },
    ];

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

    const handleSort = (option: SortOption) => {
        const sortValue = `${option.value}:${option.direction}`;
        const queryString = createQueryString('sort', sortValue);
        router.push(`/orders${queryString ? `?${queryString}` : ''}`);
        setIsOpen(false);
    };

    // Find the current sort option
    const currentSortOption = sortOptions.find(
        option => `${option.value}:${option.direction}` === currentSort
    ) || sortOptions[0];

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground bg-white dark:bg-muted border border-border rounded-full hover:bg-accent transition-colors shadow-sm"
            >
                <ArrowsUpDownIcon className="h-4 w-4 text-muted-foreground" />
                <span>{currentSortOption.label}</span>
                <ChevronDownIcon
                    className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-popover border border-border rounded-xl shadow-lg z-50 overflow-hidden">
                    <ul className="py-1">
                        {sortOptions.map((option) => (
                            <li key={`${option.value}:${option.direction}`}>
                                <button
                                    onClick={() => handleSort(option)}
                                    className={`block w-full text-left px-4 py-2 text-sm transition-colors ${`${option.value}:${option.direction}` === currentSort
                                        ? 'bg-primary/10 text-primary font-medium'
                                        : 'text-foreground hover:bg-accent'
                                        }`}
                                >
                                    {option.label}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}