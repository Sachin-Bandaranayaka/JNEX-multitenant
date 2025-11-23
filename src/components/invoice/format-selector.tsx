'use client';

import React, { useEffect } from 'react';
import { InvoiceFormat } from '@/types/invoice';
import { INVOICE_FORMAT_CONFIGS } from '@/lib/invoice/format-configs';
import { saveFormatPreference, loadFormatPreference } from '@/lib/invoice/format-preferences';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FormatSelectorProps {
  selectedFormat: InvoiceFormat;
  onFormatChange: (format: InvoiceFormat) => void;
  className?: string;
}

/**
 * FormatSelector component allows users to select an invoice format
 * Displays visual preview icons and descriptions for each format option
 * Persists user's format selection to localStorage
 */
export function FormatSelector({
  selectedFormat,
  onFormatChange,
  className,
}: FormatSelectorProps) {
  // Load saved preference on component mount
  useEffect(() => {
    try {
      const savedFormat = loadFormatPreference();
      if (savedFormat !== selectedFormat) {
        onFormatChange(savedFormat);
      }
    } catch (error) {
      console.error('Failed to load format preference:', error);
      // Continue with current format if loading fails
    }
  }, []); // Empty dependency array - only run on mount

  // Handle format change and persist to localStorage
  const handleFormatChange = (format: InvoiceFormat) => {
    try {
      onFormatChange(format);
      saveFormatPreference(format);
    } catch (error) {
      console.error('Failed to save format preference:', error);
      // Still update the UI even if saving fails
      onFormatChange(format);
    }
  };
  const formats = [
    {
      value: InvoiceFormat.FULL_PAGE,
      label: 'Full Page',
      description: '1 per page',
      icon: <FullPageIcon />,
    },
    {
      value: InvoiceFormat.HALF_PAGE,
      label: 'Half Page',
      description: '2 per page',
      icon: <HalfPageIcon />,
    },
    {
      value: InvoiceFormat.QUARTER_PAGE,
      label: 'Quarter Page',
      description: '4 per page',
      icon: <QuarterPageIcon />,
    },
  ];

  return (
    <div className={cn('space-y-3', className)}>
      <Label className="text-base font-semibold">Invoice Format</Label>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {formats.map((format) => {
          const isSelected = selectedFormat === format.value;
          const config = INVOICE_FORMAT_CONFIGS[format.value];

          return (
            <button
              key={format.value}
              type="button"
              onClick={() => handleFormatChange(format.value)}
              className={cn(
                'relative flex flex-col items-center p-4 rounded-lg border-2 transition-all',
                'hover:border-blue-500 hover:bg-gray-700/50',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900',
                isSelected
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-gray-600 bg-gray-800'
              )}
              aria-pressed={isSelected}
              aria-label={`Select ${format.label} format - ${format.description}`}
            >
              {/* Radio indicator */}
              <div className="absolute top-3 right-3">
                <div
                  className={cn(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center',
                    isSelected
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-gray-500'
                  )}
                >
                  {isSelected && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
              </div>

              {/* Visual preview icon */}
              <div className="mb-3 text-gray-300">{format.icon}</div>

              {/* Format label */}
              <div className="text-sm font-semibold text-gray-100">
                {format.label}
              </div>

              {/* Format description */}
              <div className="text-xs text-gray-400 mt-1">
                {format.description}
              </div>

              {/* Additional info */}
              <div className="text-xs text-gray-500 mt-2">
                {config.dimensions.width}×{config.dimensions.height}mm
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Icon representing a full-page invoice layout
 */
function FullPageIcon() {
  return (
    <svg
      width="48"
      height="64"
      viewBox="0 0 48 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect
        x="1"
        y="1"
        width="46"
        height="62"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      {/* Content lines */}
      <line x1="8" y1="10" x2="40" y2="10" stroke="currentColor" strokeWidth="2" />
      <line x1="8" y1="18" x2="32" y2="18" stroke="currentColor" strokeWidth="1.5" />
      <line x1="8" y1="24" x2="36" y2="24" stroke="currentColor" strokeWidth="1.5" />
      <line x1="8" y1="30" x2="28" y2="30" stroke="currentColor" strokeWidth="1.5" />
      {/* Barcode representation */}
      <rect x="8" y="45" width="32" height="8" fill="currentColor" opacity="0.3" />
    </svg>
  );
}

/**
 * Icon representing a half-page invoice layout (2 per page)
 */
function HalfPageIcon() {
  return (
    <svg
      width="48"
      height="64"
      viewBox="0 0 48 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect
        x="1"
        y="1"
        width="46"
        height="62"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      {/* Horizontal divider */}
      <line
        x1="1"
        y1="32"
        x2="47"
        y2="32"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="3 3"
      />
      {/* Top invoice */}
      <line x1="6" y1="8" x2="42" y2="8" stroke="currentColor" strokeWidth="1.5" />
      <line x1="6" y1="14" x2="30" y2="14" stroke="currentColor" strokeWidth="1" />
      <rect x="6" y="20" width="20" height="6" fill="currentColor" opacity="0.3" />
      {/* Bottom invoice */}
      <line x1="6" y1="40" x2="42" y2="40" stroke="currentColor" strokeWidth="1.5" />
      <line x1="6" y1="46" x2="30" y2="46" stroke="currentColor" strokeWidth="1" />
      <rect x="6" y="52" width="20" height="6" fill="currentColor" opacity="0.3" />
    </svg>
  );
}

/**
 * Icon representing a quarter-page invoice layout (4 per page)
 */
function QuarterPageIcon() {
  return (
    <svg
      width="48"
      height="64"
      viewBox="0 0 48 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect
        x="1"
        y="1"
        width="46"
        height="62"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      {/* Horizontal divider */}
      <line
        x1="1"
        y1="32"
        x2="47"
        y2="32"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="3 3"
      />
      {/* Vertical divider */}
      <line
        x1="24"
        y1="1"
        x2="24"
        y2="63"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="3 3"
      />
      {/* Top-left invoice */}
      <line x1="4" y1="8" x2="20" y2="8" stroke="currentColor" strokeWidth="1" />
      <line x1="4" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="0.5" />
      <rect x="4" y="18" width="12" height="4" fill="currentColor" opacity="0.3" />
      {/* Top-right invoice */}
      <line x1="28" y1="8" x2="44" y2="8" stroke="currentColor" strokeWidth="1" />
      <line x1="28" y1="12" x2="40" y2="12" stroke="currentColor" strokeWidth="0.5" />
      <rect x="28" y="18" width="12" height="4" fill="currentColor" opacity="0.3" />
      {/* Bottom-left invoice */}
      <line x1="4" y1="40" x2="20" y2="40" stroke="currentColor" strokeWidth="1" />
      <line x1="4" y1="44" x2="16" y2="44" stroke="currentColor" strokeWidth="0.5" />
      <rect x="4" y="50" width="12" height="4" fill="currentColor" opacity="0.3" />
      {/* Bottom-right invoice */}
      <line x1="28" y1="40" x2="44" y2="40" stroke="currentColor" strokeWidth="1" />
      <line x1="28" y1="44" x2="40" y2="44" stroke="currentColor" strokeWidth="0.5" />
      <rect x="28" y="50" width="12" height="4" fill="currentColor" opacity="0.3" />
    </svg>
  );
}
