'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

export function BulkOperations() {
  const [selectedOperation, setSelectedOperation] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOperationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedOperation(e.target.value);
    setError(null);
  };

  const handleExecute = async () => {
    if (!selectedOperation) {
      setError('Please select an operation');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/products/bulk/${selectedOperation}`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to execute operation');
      }

      // Reset selection after successful operation
      setSelectedOperation('');
      window.location.reload(); // Refresh to show updated data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-white">Bulk Operations</h2>
      </div>

      <div className="flex items-center space-x-4">
        <select
          value={selectedOperation}
          onChange={handleOperationChange}
          className="block w-64 rounded-md border-gray-600 bg-gray-700 text-gray-100 ring-1 ring-white/10 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        >
          <option key="empty" value="">Select an operation</option>
          <option key="export-csv" value="export-csv">Export to CSV</option>
          <option key="check-low-stock" value="check-low-stock">Check Low Stock</option>
        </select>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleExecute}
          disabled={isLoading || !selectedOperation}
          className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/10 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </>
          ) : (
            'Execute'
          )}
        </motion.button>
      </div>

      {error && (
        <div className="rounded-md bg-red-900/50 p-4 text-sm text-red-400 ring-1 ring-red-500">
          {error}
        </div>
      )}

      <div className="mt-4 text-sm text-gray-400">
        <h3 className="font-medium text-gray-300">Available Operations:</h3>
        <ul className="mt-2 list-disc pl-5 space-y-1">
          <li>Export to CSV: Download product catalog as CSV file</li>
          <li>Check Low Stock: Generate report of products with low stock levels</li>
        </ul>
      </div>
    </div>
  );
}
