'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Package, AlertCircle, CheckCircle } from 'lucide-react';
import { playSuccessSound, playErrorSound } from '@/lib/sounds';

interface OrderDetails {
  id: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  product: {
    name: string;
    price: number;
  };
  quantity: number;
  total: number;
  status: string;
  createdAt: string;
  trackingNumber?: string;
}

interface ReturnFormData {
  reason: string;
  description: string;
  refundMethod: string;
  returnShipping: string;
}

const RETURN_REASONS = [
  'Defective/Damaged Product',
  'Wrong Item Received',
  'Not as Described',
  'Changed Mind',
  'Size/Fit Issues',
  'Quality Issues',
  'Other'
];

const REFUND_METHODS = [
  'Original Payment Method',
  'Bank Transfer',
  'Store Credit',
  'Exchange for Different Product'
];

const RETURN_SHIPPING = [
  'Customer Arranges Pickup',
  'Company Arranges Pickup',
  'Customer Ships to Warehouse'
];

function ReturnProcessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [formData, setFormData] = useState<ReturnFormData>({
    reason: '',
    description: '',
    refundMethod: '',
    returnShipping: ''
  });

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails();
    } else {
      router.push('/returns');
    }
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      const response = await fetch(`/api/orders?orderNumber=${orderId}`);
      if (!response.ok) {
        throw new Error('Order not found');
      }
      const data = await response.json();
      setOrderDetails(data);
    } catch (error) {
      toast.error('Failed to fetch order details');
      router.push('/returns');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.reason || !formData.description || !formData.refundMethod || !formData.returnShipping) {
      playErrorSound();
      toast.error('Please fill in all required fields');
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch(`/api/orders/${orderDetails?.id}/return`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: formData.reason,
          description: formData.description,
          refundMethod: formData.refundMethod,
          returnShipping: formData.returnShipping
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process return');
      }

      playSuccessSound();
      toast.success('Return request submitted successfully!');
      router.push('/returns/success');
    } catch (error) {
      playErrorSound();
      toast.error(error instanceof Error ? error.message : 'Failed to process return');
    } finally {
      setProcessing(false);
    }
  };

  const canReturn = (status: string) => {
    return ['DELIVERED', 'SHIPPED'].includes(status);
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!orderDetails) {
    return (
      <div className="container mx-auto py-6">
        <Card className="w-full max-w-2xl mx-auto">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Order Not Found</h2>
              <p className="text-gray-600 mb-4">The order you're looking for could not be found.</p>
              <Button onClick={() => router.push('/returns')}>Back to Returns</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canReturn(orderDetails.status)) {
    return (
      <div className="container mx-auto py-6">
        <Card className="w-full max-w-2xl mx-auto">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Return Not Available</h2>
              <p className="text-gray-600 mb-4">
                This order cannot be returned. Returns are only available for delivered or shipped orders.
              </p>
              <p className="text-sm text-gray-500 mb-4">Current Status: {orderDetails.status}</p>
              <Button onClick={() => router.push('/returns')}>Back to Returns</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/returns')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Process Return</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Order Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Order Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label className="text-sm font-medium text-gray-500">Order ID</Label>
              <p className="font-mono text-sm">{orderDetails.id}</p>
            </div>
            
            <div className="grid gap-2">
              <Label className="text-sm font-medium text-gray-500">Customer</Label>
              <p>{orderDetails.customerName}</p>
              <p className="text-sm text-gray-600">{orderDetails.customerPhone}</p>
            </div>
            
            <div className="grid gap-2">
              <Label className="text-sm font-medium text-gray-500">Product</Label>
              <p>{orderDetails.product.name}</p>
              <p className="text-sm text-gray-600">Quantity: {orderDetails.quantity}</p>
              <p className="text-sm font-medium">Total: LKR {orderDetails.total.toFixed(2)}</p>
            </div>
            
            <div className="grid gap-2">
              <Label className="text-sm font-medium text-gray-500">Status</Label>
              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                orderDetails.status === 'DELIVERED' ? 'bg-green-100 text-green-800' :
                orderDetails.status === 'SHIPPED' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {orderDetails.status}
              </span>
            </div>
            
            {orderDetails.trackingNumber && (
              <div className="grid gap-2">
                <Label className="text-sm font-medium text-gray-500">Tracking Number</Label>
                <p className="font-mono text-sm">{orderDetails.trackingNumber}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Return Form */}
        <Card>
          <CardHeader>
            <CardTitle>Return Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="reason">Return Reason *</Label>
                <Select
                  value={formData.reason}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, reason: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {RETURN_REASONS.map((reason) => (
                      <SelectItem key={reason} value={reason}>
                        {reason}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Please provide details about the return..."
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="refundMethod">Preferred Refund Method *</Label>
                <Select
                  value={formData.refundMethod}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, refundMethod: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select refund method" />
                  </SelectTrigger>
                  <SelectContent>
                    {REFUND_METHODS.map((method) => (
                      <SelectItem key={method} value={method}>
                        {method}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="returnShipping">Return Shipping *</Label>
                <Select
                  value={formData.returnShipping}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, returnShipping: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select shipping method" />
                  </SelectTrigger>
                  <SelectContent>
                    {RETURN_SHIPPING.map((method) => (
                      <SelectItem key={method} value={method}>
                        {method}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={processing}
                  className="w-full"
                >
                  {processing ? 'Processing Return...' : 'Submit Return Request'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ReturnProcessPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    }>
      <ReturnProcessContent />
    </Suspense>
  );
}