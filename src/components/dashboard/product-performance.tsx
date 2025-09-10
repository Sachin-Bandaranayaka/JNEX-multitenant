'use client';

interface Product {
  productId: string;
  productName: string;
  totalSales: number;
  revenue: number;
  stock: number;
}

interface ProductPerformanceTableProps {
  data: {
    products?: Product[];
  };
}

export function ProductPerformanceTable({ data }: ProductPerformanceTableProps) {
  if (!data.products || data.products.length === 0) {
    return (
      <div className="text-center py-4 text-gray-400">
        No product performance data available
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
          <div className="ring-1 ring-white/10 overflow-hidden border-b border-gray-700 sm:rounded-lg">
            <table className="min-w-full divide-y divide-gray-700" style={{ minWidth: '600px' }}>
              <thead className="bg-gray-900">
                <tr>
                  <th
                    scope="col"
                    className="px-4 py-3 sm:px-6 text-left text-xs font-medium text-gray-400 uppercase tracking-wider min-w-[150px]"
                  >
                    Product
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 sm:px-6 text-left text-xs font-medium text-gray-400 uppercase tracking-wider min-w-[100px]"
                  >
                    Sales
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 sm:px-6 text-left text-xs font-medium text-gray-400 uppercase tracking-wider min-w-[120px]"
                  >
                    Revenue
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 sm:px-6 text-left text-xs font-medium text-gray-400 uppercase tracking-wider min-w-[100px]"
                  >
                    Stock
                  </th>
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                {data.products.map((product) => (
                  <tr key={product.productId} className="hover:bg-gray-700/50 transition-colors duration-200 touch-manipulation">
                    <td className="px-4 py-4 sm:px-6 whitespace-nowrap text-base sm:text-sm font-medium text-white truncate">
                      {product.productName}
                    </td>
                    <td className="px-4 py-4 sm:px-6 whitespace-nowrap text-base sm:text-sm text-gray-400">
                      {product.totalSales.toLocaleString()}
                    </td>
                    <td className="px-4 py-4 sm:px-6 whitespace-nowrap text-base sm:text-sm text-gray-400">
                      LKR {product.revenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </td>
                    <td className="px-4 py-4 sm:px-6 whitespace-nowrap text-base sm:text-sm text-gray-400">
                      {product.stock.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
