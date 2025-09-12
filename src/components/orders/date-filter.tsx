'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { CalendarIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

type QuickFilterOption = {
  label: string;
  value: string;
  getDateRange: () => { start: Date; end: Date };
};

export function DateFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const currentDateFilter = searchParams.get('dateFilter') || '';
  const currentStartDate = searchParams.get('startDate') || '';
  const currentEndDate = searchParams.get('endDate') || '';

  const quickFilterOptions: QuickFilterOption[] = [
    {
      label: 'Today',
      value: 'today',
      getDateRange: () => {
        // Get today's date in local timezone
        const today = new Date();
        const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
        
        return { start, end };
      }
    },
    {
      label: 'Yesterday',
      value: 'yesterday',
      getDateRange: () => {
        // Get yesterday's date in local timezone
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        
        const start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
        const end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
        
        return { start, end };
      }
    },
    {
      label: 'This Week',
      value: 'thisWeek',
      getDateRange: () => {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const start = new Date(today);
        start.setDate(today.getDate() - dayOfWeek);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        return { start, end };
      }
    },
    {
      label: 'This Month',
      value: 'thisMonth',
      getDateRange: () => {
        const today = new Date();
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        const end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
        return { start, end };
      }
    },
    {
      label: 'Last 7 Days',
      value: 'last7Days',
      getDateRange: () => {
        const today = new Date();
        const start = new Date(today);
        start.setDate(today.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        const end = new Date(today);
        end.setHours(23, 59, 59, 999);
        return { start, end };
      }
    },
    {
      label: 'Last 30 Days',
      value: 'last30Days',
      getDateRange: () => {
        const today = new Date();
        const start = new Date(today);
        start.setDate(today.getDate() - 29);
        start.setHours(0, 0, 0, 0);
        const end = new Date(today);
        end.setHours(23, 59, 59, 999);
        return { start, end };
      }
    }
  ];

  const createQueryString = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(Array.from(searchParams.entries()));
      
      Object.entries(updates).forEach(([name, value]) => {
        if (value === null || value === '') {
          params.delete(name);
        } else {
          params.set(name, value);
        }
      });
      
      return params.toString();
    },
    [searchParams]
  );

  const handleQuickFilter = (option: QuickFilterOption) => {
    const { start, end } = option.getDateRange();
    
    // Format dates in local timezone to avoid UTC conversion issues
    const formatLocalDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    // For single-day filters (Today, Yesterday), only set startDate
    const isSingleDay = option.value === 'today' || option.value === 'yesterday';
    
    const queryString = createQueryString({
      dateFilter: option.value,
      startDate: formatLocalDate(start),
      endDate: isSingleDay ? formatLocalDate(start) : formatLocalDate(end),
    });
    
    router.push(`?${queryString}`);
    setIsOpen(false);
    setShowCustomRange(false);
  };

  const handleCustomRange = () => {
    if (!customStartDate || !customEndDate) return;
    
    const queryString = createQueryString({
      dateFilter: 'custom',
      startDate: customStartDate,
      endDate: customEndDate,
    });
    
    router.push(`?${queryString}`);
    setIsOpen(false);
    setShowCustomRange(false);
  };

  const clearFilter = () => {
    const queryString = createQueryString({
      dateFilter: null,
      startDate: null,
      endDate: null,
    });
    
    router.push(`?${queryString}`);
    setIsOpen(false);
    setShowCustomRange(false);
    setCustomStartDate('');
    setCustomEndDate('');
  };

  const getActiveFilterLabel = () => {
    if (!currentDateFilter) return 'All Dates';
    
    if (currentDateFilter === 'custom') {
      return `${currentStartDate} to ${currentEndDate}`;
    }
    
    const option = quickFilterOptions.find(opt => opt.value === currentDateFilter);
    return option?.label || 'All Dates';
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-colors min-w-[200px] justify-between ${
          currentDateFilter 
            ? 'text-indigo-300 bg-indigo-500/20 border border-indigo-500/50 hover:bg-indigo-500/30' 
            : 'text-gray-300 bg-gray-700 border border-gray-600 hover:bg-gray-600'
        }`}
      >
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4" />
          <span className="truncate">{getActiveFilterLabel()}</span>
          {currentDateFilter && (
            <div className="w-2 h-2 bg-indigo-400 rounded-full flex-shrink-0"></div>
          )}
        </div>
        <ChevronDownIcon className={`h-4 w-4 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-80 bg-gray-800 border border-gray-600 rounded-lg shadow-xl ring-1 ring-black ring-opacity-5 backdrop-blur-sm">
          <div className="p-4">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-200 mb-3">Quick Filters</h3>
              
              {quickFilterOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleQuickFilter(option)}
                  className={`block w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                    currentDateFilter === option.value
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  {option.label}
                </button>
              ))}
              
              <div className="border-t border-gray-600 pt-3 mt-3">
                <button
                  onClick={() => setShowCustomRange(!showCustomRange)}
                  className={`block w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                    currentDateFilter === 'custom'
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  Custom Date Range
                </button>
                
                {showCustomRange && (
                  <div className="mt-3 space-y-3 p-3 bg-gray-700/50 rounded-md">
                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={customStartDate || currentStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-600 rounded-md text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={customEndDate || currentEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-600 rounded-md text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                    <button
                      onClick={handleCustomRange}
                      disabled={!customStartDate || !customEndDate}
                      className="w-full px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Apply Range
                    </button>
                  </div>
                )}
              </div>
              
              {currentDateFilter && (
                <div className="border-t border-gray-600 pt-3 mt-3">
                  <button
                    onClick={clearFilter}
                    className="block w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-md transition-colors"
                  >
                    Clear Filter
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}