// src/app/(authenticated)/orders/orders-client.tsx

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { OrderActions } from '@/components/orders/order-actions';
import { OrderStatus, Prisma } from '@prisma/client';
import { User } from 'next-auth';

// Define the types for the props this component will receive
type OrderWithRelations = Prisma.OrderGetPayload<{
  include: { product: true; lead: true; assignedTo: true; };
}>;

interface OrdersClientProps {
  initialOrders: OrderWithRelations[];
  user: User;
}

// Status configuration similar to leads page
const STATUS_CONFIG = {
  PENDING: { label: 'Pending Orders', border: 'border-yellow-500/50', text: 'text-yellow-300', icon: '⏳' },
  SHIPPED: { label: 'Shipped Orders', border: 'border-purple-500/50', text: 'text-purple-300', icon: '🚚' },
  DELIVERED: { label: 'Delivered Orders', border: 'border-green-500/50', text: 'text-green-300', icon: '✅' },
};

export function OrdersClient({ initialOrders, user }: OrdersClientProps) {
  // State to keep track of which order IDs are selected
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

  // Group orders by the main categories we want to display
  const ordersByCategory = {
    PENDING: initialOrders.filter(order => ['PENDING', 'CONFIRMED'].includes(order.status)),
    SHIPPED: initialOrders.filter(order => order.status === 'SHIPPED'),
    DELIVERED: initialOrders.filter(order => ['DELIVERED', 'RETURNED', 'CANCELLED'].includes(order.status)),
  };
  
  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-yellow-400', confirmed: 'bg-blue-400', shipped: 'bg-purple-400',
      delivered: 'bg-green-400', returned: 'bg-red-400', cancelled: 'bg-gray-400',
    };
    return colors[status.toLowerCase() as keyof typeof colors] || colors.pending;
  };

  // Handler for changing a single checkbox's state
  const handleSelectOrder = (orderId: string) => {
    setSelectedOrders(prev =>
      prev.includes(orderId)
        ? prev.filter(id => id !== orderId) // Uncheck: remove from array
        : [...prev, orderId] // Check: add to array
    );
  };

  // Handler for the "Select All" checkbox in each section
  const handleSelectAllByCategory = (ordersInSection: OrderWithRelations[]) => {
    const orderIdsInSection = ordersInSection.map(order => order.id);
    // Check if all orders in this section are already selected
    const allSelected = orderIdsInSection.every(id => selectedOrders.includes(id));

    if (allSelected) {
      // If all are selected, deselect them
      setSelectedOrders(prev => prev.filter(id => !orderIdsInSection.includes(id)));
    } else {
      // Otherwise, select all (ensuring no duplicates)
      setSelectedOrders(prev => [...new Set([...prev, ...orderIdsInSection])]);
    }
  };

  const canPrintInvoices = user.role === 'ADMIN' || user.permissions?.includes('CREATE_ORDERS') || user.permissions?.includes('EDIT_ORDERS');

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          {/* Header text... */}
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {canPrintInvoices && (
            <Link
              href={selectedOrders.length > 0 ? `/orders/print?ids=${selectedOrders.join(',')}` : '#'}
              aria-disabled={selectedOrders.length === 0}
              className={`inline-flex items-center px-4 py-2 border rounded-md ring-1 text-sm font-medium transition-colors ${
                selectedOrders.length === 0
                  ? 'border-gray-700 bg-gray-800 text-gray-500 cursor-not-allowed'
                  : 'border-gray-600 bg-gray-800 text-gray-300 hover:bg-gray-700 ring-white/10'
              }`}
              onClick={(e) => {
                if (selectedOrders.length === 0) e.preventDefault();
              }}
            >
              Print Selected ({selectedOrders.length})
            </Link>
          )}
        </div>
      </div>

      {initialOrders.length === 0 ? (
        <div className="bg-gray-800 rounded-lg ring-1 ring-white/10 p-6 text-center">
          <p className="text-gray-400">No orders found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-1 xl:grid-cols-2 gap-8">
          {Object.entries(STATUS_CONFIG).map(([category, config]) => {
            const categoryOrders = ordersByCategory[category as keyof typeof ordersByCategory] || [];
            
            // Check if all orders in this category are selected
            const areAllInCategorySelected = categoryOrders.every(order => selectedOrders.includes(order.id));

            return (
              <div key={category} className={`flex flex-col rounded-2xl ring-1 ring-white/10 overflow-hidden bg-gray-800 border-2 ${config.border} shadow-2xl min-h-[600px]`}>
                {/* Fixed Header */}
                <div className="flex-shrink-0 px-8 py-6 border-b border-gray-700 bg-gray-800/80 backdrop-blur-sm">
                  <div className="flex items-center justify-between">
                    <h2 className={`text-2xl font-bold flex items-center space-x-4 ${config.text}`}>
                      <span className="text-3xl">{config.icon}</span>
                      <span>{config.label}</span>
                      <span className="text-lg font-normal text-gray-400">({categoryOrders.length})</span>
                    </h2>
                    {categoryOrders.length > 0 && (
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          className="h-5 w-5 rounded border-gray-600 bg-gray-700 text-indigo-600 focus:ring-indigo-500 focus:ring-2"
                          onChange={() => handleSelectAllByCategory(categoryOrders)}
                          checked={areAllInCategorySelected}
                        />
                        <label className="text-base text-gray-300 cursor-pointer font-medium">Select All</label>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-hidden">
                  <div className="h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                    <ul className="divide-y divide-gray-700">
                      {categoryOrders.map((order) => (
                        <li key={order.id} className="p-6 hover:bg-gray-700/50 transition-all duration-200 hover:scale-[1.01]">
                          <div className="flex items-start justify-between gap-6">
                            <div className="flex items-start gap-5 flex-grow min-w-0">
                              <div className="flex-shrink-0 pt-1">
                                <input
                                  type="checkbox"
                                  className="h-5 w-5 rounded border-gray-600 bg-gray-700 text-indigo-600 focus:ring-indigo-500 focus:ring-2"
                                  checked={selectedOrders.includes(order.id)}
                                  onChange={() => handleSelectOrder(order.id)}
                                />
                              </div>
                              <div className="flex-grow min-w-0 space-y-3">
                                <Link 
                                  href={`/orders/${order.id}`} 
                                  className="text-lg font-bold text-indigo-400 hover:text-indigo-300 transition-colors block truncate"
                                >
                                  Order #{order.id.slice(0, 8)}
                                </Link>
                                <div className="space-y-2">
                                  <p className="text-base text-gray-200 truncate font-semibold">
                                    {order.product.name}
                                  </p>
                                  <p className="text-base text-gray-400 truncate">
                                    {order.customerName}
                                  </p>
                                </div>
                                <div className="flex items-center justify-between pt-3">
                                  <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-bold ${getStatusColor(order.status.toLowerCase())} text-white shadow-lg`}>
                                    {order.status.toLowerCase()}
                                  </span>
                                  {order.total > 0 && (
                                    <span className="text-lg font-bold text-green-400">
                                      LKR {order.total.toFixed(2)}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-400 pt-2 font-medium">
                                  {new Date(order.createdAt).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                  })}
                                </p>
                              </div>
                            </div>
                            <div className="flex-shrink-0">
                              <OrderActions order={order} user={user} />
                            </div>
                          </div>
                        </li>
                      ))}
                      {categoryOrders.length === 0 && (
                        <li className="p-12 text-center">
                          <div className="text-gray-500">
                            <div className="text-6xl mb-6 opacity-50">{config.icon}</div>
                            <p className="text-lg font-semibold">No {config.label.toLowerCase()}</p>
                            <p className="text-base text-gray-400 mt-3">Orders will appear here when available</p>
                          </div>
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
