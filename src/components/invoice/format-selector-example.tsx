'use client';

import React, { useState } from 'react';
import { InvoiceFormat } from '@/types/invoice';
import { FormatSelector } from './format-selector';

/**
 * Example component demonstrating format selector with persistence
 * 
 * This component shows how the FormatSelector automatically:
 * 1. Loads the saved format preference on mount
 * 2. Saves the selected format to localStorage when changed
 * 3. Defaults to FULL_PAGE when no preference exists
 */
export function FormatSelectorExample() {
  const [selectedFormat, setSelectedFormat] = useState<InvoiceFormat>(
    InvoiceFormat.FULL_PAGE
  );

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-2xl font-bold">Invoice Format Selection</h2>
      
      <p className="text-gray-400">
        Select your preferred invoice format. Your selection will be saved and
        automatically applied the next time you generate invoices.
      </p>

      <FormatSelector
        selectedFormat={selectedFormat}
        onFormatChange={setSelectedFormat}
      />

      <div className="mt-6 p-4 bg-gray-800 rounded-lg">
        <h3 className="font-semibold mb-2">Current Selection:</h3>
        <p className="text-gray-300">{selectedFormat}</p>
        <p className="text-sm text-gray-500 mt-2">
          This preference is saved to localStorage and will persist across sessions.
        </p>
      </div>
    </div>
  );
}
