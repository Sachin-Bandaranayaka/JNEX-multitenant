'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Home, FileText } from 'lucide-react';

export default function ReturnSuccessPage() {
  const router = useRouter();

  return (
    <div className="jnex-themed container mx-auto py-6">
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="pt-6">
          <div className="text-center space-y-6">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-green-700">Return Request Submitted</h1>
              <p className="text-gray-600">
                Your return request has been successfully submitted and is being processed.
              </p>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-left">
              <h3 className="font-semibold text-green-800 mb-2">What happens next?</h3>
              <ul className="text-sm text-green-700 space-y-1">
                <li>• Our team will review your return request within 24 hours</li>
                <li>• You will receive an email confirmation with return instructions</li>
                <li>• Once approved, we'll arrange pickup or provide shipping details</li>
                <li>• Refund will be processed after we receive and inspect the item</li>
              </ul>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
              <h3 className="font-semibold text-blue-800 mb-2">Important Notes:</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Keep the product in its original condition</li>
                <li>• Include all original packaging and accessories</li>
                <li>• Return processing typically takes 3-5 business days</li>
                <li>• You'll receive email updates throughout the process</li>
              </ul>
            </div>
            
            <div className="flex gap-3 justify-center">
              <Button
                onClick={() => router.push('/')}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Home className="h-4 w-4" />
                Back to Home
              </Button>
              
              <Button
                onClick={() => router.push('/returns')}
                className="flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                Process Another Return
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}