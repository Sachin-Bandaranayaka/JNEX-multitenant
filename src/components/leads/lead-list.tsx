// src/components/leads/lead-list.tsx

'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useSession } from 'next-auth/react';
import { LeadEditModal } from './lead-edit-modal';

interface Lead {
  id: string;
  csvData: {
    name: string;
    phone: string;
    secondPhone?: string;
    email?: string | null;
    address: string;
    city: string;
    source: string;
    notes?: string;
    quantity?: number;
  };
  product: {
    id: string;
    name: string;
    code: string;
    price?: number;
  };
  productCode: string;
  status: 'PENDING' | 'CONVERTED' | 'REJECTED' | 'NO_ANSWER' | 'CONFIRMED';
  createdAt: string;
  assignedTo?: {
    id: string;
    name: string | null;
    email: string;
  };
}

export function LeadList() {
  const { data: session } = useSession();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [products, setProducts] = useState<any[]>([]);

  const fetchLeads = async () => {
    try {
      const response = await fetch('/api/leads');
      if (!response.ok) {
        throw new Error('Failed to fetch leads');
      }
      const data = await response.json();
      setLeads(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while fetching leads');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const handleConvertToOrder = async (lead: Lead) => {
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          leadId: lead.id,
          productId: lead.product.id,
          userId: session?.user?.id,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create order');
      }

      // Refresh leads list after conversion
      fetchLeads();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to convert lead to order');
    }
  };

  const handleEditLead = async (lead: Lead) => {
    try {
      const response = await fetch('/api/products');
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
      }
      setSelectedLead(lead);
      setEditModalOpen(true);
    } catch (err) {
      console.error('Failed to fetch products:', err);
      // Still open the modal with at least the current product
      setSelectedLead(lead);
      setEditModalOpen(true);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">{error}</h3>
          </div>
        </div>
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="mt-2 text-base sm:text-lg font-medium text-white leading-relaxed">No leads</h3>
        <p className="mt-1 text-sm sm:text-base text-gray-400 leading-relaxed">Get started by creating a new lead.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Mobile-optimized table container with horizontal scroll */}
      <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
          <div className="ring-1 ring-white/10 overflow-hidden border-b border-gray-700 sm:rounded-lg">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700" style={{ minWidth: '800px' }}>
                <thead className="bg-gray-900">
                  <tr>
                    <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider min-w-[120px] leading-tight">
                      Name
                    </th>
                    <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider min-w-[120px] leading-tight">
                      Contact
                    </th>
                    <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider min-w-[140px] leading-tight">
                      Address
                    </th>
                    <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider min-w-[120px] leading-tight">
                      Product
                    </th>
                    <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider min-w-[100px]">
                      Status
                    </th>
                    <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider min-w-[100px]">
                      Created
                    </th>
                    <th scope="col" className="relative px-3 sm:px-6 py-3 min-w-[120px]">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                  {leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-gray-700/50 transition-colors touch-manipulation">
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-white truncate max-w-[100px] sm:max-w-none">{lead.csvData.name}</div>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <div className="text-sm text-white truncate max-w-[100px] sm:max-w-none">{lead.csvData.phone}</div>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <div className="text-sm text-white truncate max-w-[120px] sm:max-w-none">{lead.csvData.address}</div>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <div className="text-sm text-white truncate max-w-[100px] sm:max-w-none">{lead.product.name}</div>
                        <div className="text-xs sm:text-sm text-gray-400 truncate max-w-[100px] sm:max-w-none">{lead.product.code}</div>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-4 font-semibold rounded-full transition-colors ${
                          lead.status === 'CONVERTED'
                            ? 'bg-green-900/30 text-green-300'
                            : lead.status === 'REJECTED'
                              ? 'bg-red-900/30 text-red-300'
                              : lead.status === 'NO_ANSWER'
                                ? 'bg-yellow-900/30 text-yellow-300'
                                : 'bg-blue-900/30 text-blue-300'
                        }`}>
                          {lead.status.toLowerCase()}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-400">
                        {format(new Date(lead.createdAt), 'MMM d, yyyy')}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right text-sm font-medium">
                        {lead.status === 'PENDING' && (
                          <div className="flex flex-col sm:flex-row justify-end space-y-1 sm:space-y-0 sm:space-x-2">
                            <button
                              onClick={() => handleEditLead(lead)}
                              className="text-indigo-600 hover:text-indigo-400 transition-colors touch-manipulation px-2 py-1 text-xs sm:text-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleConvertToOrder(lead)}
                              className="text-indigo-400 hover:text-indigo-300 transition-colors touch-manipulation px-2 py-1 text-xs sm:text-sm"
                            >
                              Convert
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      {selectedLead && (
        <LeadEditModal
          isOpen={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setSelectedLead(null);
          }}
          lead={selectedLead}
          products={products}
        />
      )}
    </div>
  );
}
