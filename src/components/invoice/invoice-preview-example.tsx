'use client';

import React, { useState } from 'react';
import { InvoiceFormat } from '@/types/invoice';
import { FormatSelector } from './format-selector';
import { InvoicePreview } from './invoice-preview';
import { Label } from '@/components/ui/label';

/**
 * Example component demonstrating the invoice preview functionality
 * Shows how FormatSelector and InvoicePreview work together
 * Updates preview when format changes
 */
export function InvoicePreviewExample() {
  const [selectedFormat, setSelectedFormat] = useState<InvoiceFormat>(
    InvoiceFormat.FULL_PAGE
  );
  const [showCutLines, setShowCutLines] = useState(true);

  return (
    <div className="space-y-6 p-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-100 mb-6">
          Invoice Format Preview
        </h2>

        {/* Format Selector */}
        <FormatSelector
          selectedFormat={selectedFormat}
          onFormatChange={setSelectedFormat}
          className="mb-6"
        />

        {/* Cut Lines Toggle */}
        <div className="mb-6 flex items-center gap-3">
          <input
            type="checkbox"
            id="showCutLines"
            checked={showCutLines}
            onChange={(e) => setShowCutLines(e.target.checked)}
            className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-2 focus:ring-blue-500"
          />
          <Label
            htmlFor="showCutLines"
            className="text-sm text-gray-300 cursor-pointer"
          >
            Show cut lines in preview
          </Label>
        </div>

        {/* Invoice Preview */}
        <InvoicePreview
          format={selectedFormat}
          showCutLines={showCutLines}
        />
      </div>
    </div>
  );
}
