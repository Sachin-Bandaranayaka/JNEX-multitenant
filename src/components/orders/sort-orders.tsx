'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';

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
                className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-100 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:bg-gray-600"
            >
                <span>Sort: {currentSortOption.label}</span>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-gray-800 border border-gray-700 rounded-md ring-1 ring-white/10 z-10">
                    <ul className="py-1">
                        {sortOptions.map((option) => (
                            <li key={`${option.value}:${option.direction}`}>
                                <button
                                    onClick={() => handleSort(option)}
                                    className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-700 ${`${option.value}:${option.direction}` === currentSort
                                            ? 'bg-indigo-500/20 text-indigo-300'
                                            : 'text-gray-300'
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