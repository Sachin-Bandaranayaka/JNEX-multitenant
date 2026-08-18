'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { QrCode, Search, Camera } from 'lucide-react';

export default function ReturnsPage() {
  const router = useRouter();
  const [orderId, setOrderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [qrScanning, setQrScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSearch = async () => {
    if (!orderId.trim()) {
      toast.error('Please enter an order ID');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/orders?orderNumber=${orderId}`);
      if (!response.ok) {
        throw new Error('Order not found');
      }
      
      // Navigate to the return form with the order details
      router.push(`/returns/process?orderId=${orderId}`);
    } catch (error) {
      toast.error('Order not found. Please check the order number and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleQRUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setQrScanning(true);
    try {
      // Create a canvas to read the QR code from the image
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = async () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        
        // For now, we'll simulate QR code reading
        // In a real implementation, you'd use a QR code library like jsQR
        toast.info('QR code scanning feature coming soon! Please use manual entry for now.');
        setQrScanning(false);
      };
      
      img.src = URL.createObjectURL(file);
    } catch (error) {
      toast.error('Failed to process QR code');
      setQrScanning(false);
    }
  };

  const triggerQRUpload = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="jnex-themed container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Returns Management</h1>
      </div>
      
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Process New Return</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="manual" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="manual" className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                Manual Entry
              </TabsTrigger>
              <TabsTrigger value="qr" className="flex items-center gap-2">
                <QrCode className="h-4 w-4" />
                QR Code
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="manual" className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="orderId">Order ID</Label>
                <div className="flex gap-2">
                  <Input
                    id="orderId"
                    placeholder="Enter order ID (e.g., JH240101ABC123)"
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    className="flex-1"
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <Button
                    onClick={handleSearch}
                    disabled={loading}
                    className="min-w-[100px]"
                  >
                    {loading ? 'Searching...' : 'Search'}
                  </Button>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="qr" className="space-y-4">
              <div className="text-center space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
                  <QrCode className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Scan QR Code from Invoice</h3>
                  <p className="text-gray-600 mb-4">
                    Upload a photo of the QR code from your invoice to automatically find your order.
                  </p>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleQRUpload}
                    className="hidden"
                  />
                  
                  <Button
                    onClick={triggerQRUpload}
                    disabled={qrScanning}
                    className="flex items-center gap-2"
                  >
                    <Camera className="h-4 w-4" />
                    {qrScanning ? 'Processing...' : 'Upload QR Code Image'}
                  </Button>
                </div>
                
                <div className="text-sm text-gray-500">
                  <p>💡 Tip: The QR code is usually found at the bottom of your invoice or receipt.</p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}