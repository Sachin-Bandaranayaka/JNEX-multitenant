'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import {
  ArrowLeftIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  MinusIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import {
  TransExpressLocationPicker,
  type TransExpressLocationValue,
} from '@/components/shipping/trans-express-location-picker';

interface Product {
  id: string;
  name: string;
  code: string;
  price: number;
  stock: number;
  lowStockAlert: number;
}

interface PrefilledLead {
  id: string;
  productCode: string;
  product: { id: string; name: string; code: string; price: number };
  csvData: {
    name?: string;
    phone?: string;
    secondPhone?: string;
    email?: string;
    address?: string;
    notes?: string;
    quantity?: number;
    discount?: number;
    city?: string;
    source?: string;
  };
}

interface LeadFormProps {
  products: Product[];
  prefilledLead?: PrefilledLead;
  returnTo?: string;
  hasTransExpress?: boolean;
  onSubmit?: () => Promise<void>;
  onCancel?: () => void;
}

const leadSchema = z.object({
  name: z.string().trim().min(1, 'Customer name is required'),
  address: z.string().trim().min(1, 'Address is required'),
  city: z.string().optional(),
  phone: z.string().trim().min(1, 'Contact number one is required'),
  secondPhone: z.string().optional(),
  email: z.string().email('Enter a valid email address').optional().or(z.literal('')),
  notes: z.string().optional(),
  source: z.enum(['Facebook', 'WhatsApp', 'Advertisement', 'Other']),
});

type LeadFormData = z.infer<typeof leadSchema>;
type StagedProduct = { product: Product; quantity: number; discount: number };

function normalizePhoneNumber(phone: string): string {
  let cleaned = phone.trim().replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+94') && cleaned.length === 12) return `0${cleaned.substring(3)}`;
  if (cleaned.startsWith('94') && cleaned.length === 11) return `0${cleaned.substring(2)}`;
  if (cleaned.length === 9 && !cleaned.startsWith('0')) return `0${cleaned}`;
  return cleaned.replace('+', '');
}

const inputClass = 'h-10 w-full border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:bg-muted/40 disabled:opacity-70';

function FieldRow({ label, htmlFor, required, children }: { label: string; htmlFor?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-start">
      <label htmlFor={htmlFor} className="pt-2.5 text-sm font-semibold text-foreground/75 sm:border-l-2 sm:border-border sm:pl-3">
        {label}{required && <span className="ml-1 text-primary" aria-hidden="true">*</span>}
      </label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function LoadingButtonText({ confirmationMode }: { confirmationMode: boolean }) {
  return <>{confirmationMode ? 'Adding order…' : 'Creating lead…'}</>;
}

export function LeadForm({ products, prefilledLead, returnTo = '/leads', hasTransExpress = false, onSubmit, onCancel }: LeadFormProps) {
  const router = useRouter();
  const confirmationMode = Boolean(prefilledLead);
  const initialSource = prefilledLead?.csvData.source;
  const [formData, setFormData] = useState<LeadFormData>({
    name: prefilledLead?.csvData.name || '',
    phone: prefilledLead?.csvData.phone || '',
    secondPhone: prefilledLead?.csvData.secondPhone || '',
    email: prefilledLead?.csvData.email || '',
    address: prefilledLead?.csvData.address || '',
    city: prefilledLead?.csvData.city || '',
    notes: prefilledLead?.csvData.notes || '',
    source: initialSource === 'WhatsApp' || initialSource === 'Advertisement' || initialSource === 'Other'
      ? initialSource
      : 'Facebook',
  });
  const [productCode, setProductCode] = useState(prefilledLead?.productCode || '');
  const [productSearch, setProductSearch] = useState('');
  const [quantity, setQuantity] = useState(prefilledLead?.csvData.quantity || 1);
  const [discount, setDiscount] = useState(prefilledLead?.csvData.discount || 0);
  const [stagedProduct, setStagedProduct] = useState<StagedProduct | null>(null);
  const [shippingLocation, setShippingLocation] = useState<TransExpressLocationValue>();
  const [isLoading, setIsLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState<'NO_ANSWER' | 'REJECTED' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedProduct = products.find((product) => product.code === productCode);
  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    return query
      ? products.filter((product) => `${product.name} ${product.code}`.toLowerCase().includes(query))
      : products;
  }, [productSearch, products]);
  const previewTotal = Math.max(0, (selectedProduct?.price || 0) * quantity - discount);
  const stagedTotal = stagedProduct
    ? Math.max(0, stagedProduct.product.price * stagedProduct.quantity - stagedProduct.discount)
    : 0;

  const setField = <K extends keyof LeadFormData>(field: K, value: LeadFormData[K]) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const stageProduct = () => {
    setError(null);
    if (!selectedProduct) return setError('Select a product before adding it.');
    if (quantity < 1 || !Number.isInteger(quantity)) return setError('Quantity must be a whole number greater than zero.');
    if (discount < 0) return setError('Discount cannot be negative.');
    setStagedProduct({ product: selectedProduct, quantity, discount });
    toast.success(stagedProduct ? 'Product updated.' : 'Product added.');
  };

  const handleStatus = async (status: 'NO_ANSWER' | 'REJECTED') => {
    if (!prefilledLead) return;
    const confirmationMessage = status === 'NO_ANSWER'
      ? 'Mark this lead as no answer and return it to the follow-up queue?'
      : 'Reject this lead? This will remove it from the active lead queue.';
    if (!window.confirm(confirmationMessage)) return;
    setStatusLoading(status);
    setError(null);
    try {
      const response = await fetch(`/api/leads/${prefilledLead.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to update lead status.');
      toast.success(status === 'NO_ANSWER' ? 'Lead marked as no answer.' : 'Lead rejected.');
      router.replace(returnTo);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to update lead status.');
      setStatusLoading(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent, forceCreate = false) => {
    event.preventDefault();
    setError(null);
    if (!stagedProduct) return setError('Add a product before continuing.');
    setIsLoading(true);
    try {
      const validated = leadSchema.parse(formData);
      if (confirmationMode && hasTransExpress && !shippingLocation) {
        throw new Error('Select a Trans Express city before adding the order.');
      }
      const csvData = {
        name: validated.name,
        phone: normalizePhoneNumber(validated.phone),
        secondPhone: validated.secondPhone ? normalizePhoneNumber(validated.secondPhone) : '',
        email: validated.email || null,
        address: validated.address,
        notes: validated.notes || '',
        city: shippingLocation?.cityName || validated.city || '',
        source: validated.source,
        quantity: stagedProduct.quantity,
        discount: stagedProduct.discount,
      };

      if (prefilledLead) {
        const updateResponse = await fetch(`/api/leads/${prefilledLead.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csvData, productCode: stagedProduct.product.code }),
        });
        const updated = await updateResponse.json();
        if (!updateResponse.ok) throw new Error(updated.error || 'Failed to update lead details.');

        const orderResponse = await fetch('/api/orders/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leadId: prefilledLead.id,
            quantity: stagedProduct.quantity,
            forceCreate: true,
            shippingLocation,
          }),
        });
        const order = await orderResponse.json();
        if (!orderResponse.ok) throw new Error(order.error || 'Failed to add order.');
        toast.success('Order added successfully.');
        await onSubmit?.();
        router.replace(returnTo);
      } else {
        const response = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csvData, productCode: stagedProduct.product.code, forceCreate }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to create lead.');
        if (result.requiresConfirmation) {
          if (window.confirm(result.message)) {
            setIsLoading(false);
            return handleSubmit({ preventDefault() {} } as React.FormEvent, true);
          }
          setIsLoading(false);
          return;
        }
        toast.success('Lead created successfully.');
        await onSubmit?.();
        router.replace(returnTo);
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof z.ZodError ? caught.errors[0].message : caught instanceof Error ? caught.message : 'An error occurred.');
      setIsLoading(false);
    }
  };

  const cancel = onCancel || (() => router.push(returnTo));

  return (
    <form onSubmit={handleSubmit} className="border-t-[3px] border-t-primary bg-card">
      <header className="flex flex-col gap-3 border-b border-border bg-muted/15 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Customer Form</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {confirmationMode ? 'Review the lead, stage its product and add the order.' : 'Capture customer details and stage a product for a new lead.'}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {confirmationMode && (
            <div className="flex items-center gap-2 sm:border-r sm:border-border sm:pr-3" aria-label="Lead status actions">
              <span className="hidden text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground xl:inline">Lead actions</span>
              <button type="button" onClick={() => handleStatus('NO_ANSWER')} disabled={Boolean(statusLoading || isLoading)} className="h-9 bg-cyan-600 px-3 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-60">
                {statusLoading === 'NO_ANSWER' ? 'Updating…' : 'No answer'}
              </button>
              <button type="button" onClick={() => handleStatus('REJECTED')} disabled={Boolean(statusLoading || isLoading)} className="h-9 bg-red-500 px-3 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60">
                {statusLoading === 'REJECTED' ? 'Updating…' : 'Reject'}
              </button>
            </div>
          )}
          <button type="button" onClick={cancel} className="inline-flex h-9 items-center gap-1.5 border border-input px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
            <ArrowLeftIcon className="h-4 w-4" /> Back to leads
          </button>
        </div>
      </header>

      <div className="grid divide-y divide-border lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        <section aria-labelledby="customer-details" className="space-y-4 p-4 sm:p-5">
          <h2 id="customer-details" className="-mx-4 -mt-4 border-b border-border bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-700 sm:-mx-5 sm:-mt-5 sm:px-5 dark:bg-slate-900/40 dark:text-slate-200"><span className="mr-2 text-primary">01</span>Customer details</h2>
          <FieldRow label="Customer Name" htmlFor="name" required>
            <input id="name" required value={formData.name} onChange={(event) => setField('name', event.target.value)} placeholder="Enter customer name" className={inputClass} />
          </FieldRow>
          <FieldRow label="Address" htmlFor="address" required>
            <input id="address" required value={formData.address} onChange={(event) => setField('address', event.target.value)} placeholder="Enter delivery address" className={inputClass} />
          </FieldRow>
          {confirmationMode && hasTransExpress ? (
            <FieldRow label="City" required>
              <TransExpressLocationPicker value={shippingLocation} onChange={setShippingLocation} suggestedCity={prefilledLead?.csvData.city} disabled={isLoading} compact />
            </FieldRow>
          ) : (
            <FieldRow label="City" htmlFor="city">
              <input id="city" value={formData.city || ''} onChange={(event) => setField('city', event.target.value)} placeholder="Enter city" className={inputClass} />
            </FieldRow>
          )}
          <FieldRow label="Contact Number One" htmlFor="phone" required>
            <input id="phone" required type="tel" value={formData.phone} onChange={(event) => setField('phone', event.target.value)} placeholder="Enter contact number" className={inputClass} />
          </FieldRow>
          <FieldRow label="Contact Number Two" htmlFor="secondPhone">
            <input id="secondPhone" type="tel" value={formData.secondPhone || ''} onChange={(event) => setField('secondPhone', event.target.value)} placeholder="Optional contact number" className={inputClass} />
          </FieldRow>
          <FieldRow label="Email" htmlFor="email">
            <input id="email" type="email" value={formData.email || ''} onChange={(event) => setField('email', event.target.value)} placeholder="Optional email address" className={inputClass} />
          </FieldRow>
          <FieldRow label="Other" htmlFor="notes">
            <textarea id="notes" rows={2} value={formData.notes || ''} onChange={(event) => setField('notes', event.target.value)} placeholder="Notes or special instructions" className={`${inputClass} h-16 resize-y py-2`} />
          </FieldRow>
          <FieldRow label="Lead From">
            <div className="flex min-h-10 flex-wrap items-center gap-x-5 gap-y-2">
              {(['Facebook', 'WhatsApp', 'Advertisement', 'Other'] as const).map((source) => (
                <label key={source} className="flex cursor-pointer items-center gap-2 text-sm text-foreground/80">
                  <input type="radio" name="source" checked={formData.source === source} onChange={() => setField('source', source)} className="text-primary focus:ring-primary" />
                  {source}
                </label>
              ))}
            </div>
          </FieldRow>
        </section>

        <section aria-labelledby="product-details" className="space-y-4 p-4 sm:p-5">
          <h2 id="product-details" className="-mx-4 -mt-4 border-b border-border bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-700 sm:-mx-5 sm:-mt-5 sm:px-5 dark:bg-slate-900/40 dark:text-slate-200"><span className="mr-2 text-primary">02</span>Product &amp; order details</h2>
          <FieldRow label="Find Product" htmlFor="productSearch">
            <div className="relative">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input id="productSearch" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Filter by name or code" className={`${inputClass} pl-9`} />
            </div>
          </FieldRow>
          <FieldRow label="Product" htmlFor="product" required>
            <select id="product" required value={productCode} onChange={(event) => setProductCode(event.target.value)} className={inputClass}>
              <option value="">Select product</option>
              {filteredProducts.map((product) => <option key={product.id} value={product.code}>{product.name} · {product.code} · Stock {product.stock}</option>)}
            </select>
            <div className="mt-1.5 flex flex-wrap justify-between gap-1 text-xs">
              <span className="text-muted-foreground">One product per order; adding again replaces it.</span>
              {selectedProduct && <span className={`font-semibold ${selectedProduct.stock <= 0 ? 'text-destructive' : selectedProduct.stock <= selectedProduct.lowStockAlert ? 'text-amber-600' : 'text-emerald-600'}`}>{selectedProduct.stock} available · Rs. {selectedProduct.price.toLocaleString('en-LK')} each</span>}
            </div>
          </FieldRow>
          <FieldRow label="Qty" htmlFor="quantity" required>
            <input id="quantity" required type="number" min={1} step={1} value={quantity} onChange={(event) => setQuantity(Number(event.target.value) || 1)} className={inputClass} />
          </FieldRow>
          <FieldRow label="Sale Amount (Rs)" htmlFor="saleAmount">
            <input id="saleAmount" readOnly value={previewTotal.toLocaleString('en-LK')} className={`${inputClass} bg-muted/30 font-semibold`} />
          </FieldRow>
          <FieldRow label="Discount (Rs)" htmlFor="discount">
            <input id="discount" type="number" min={0} value={discount} onChange={(event) => setDiscount(Math.max(0, Number(event.target.value) || 0))} className={inputClass} />
          </FieldRow>
          <div className="grid grid-cols-3 border-l-[3px] border-primary bg-slate-900 text-white dark:bg-slate-800">
            <div className="border-r border-white/10 px-3 py-2.5"><span className="block text-[10px] uppercase tracking-wider text-slate-400">Item</span><strong className="mt-0.5 block truncate text-sm">{selectedProduct?.name || 'Not selected'}</strong></div>
            <div className="border-r border-white/10 px-3 py-2.5 text-center"><span className="block text-[10px] uppercase tracking-wider text-slate-400">Qty</span><strong className="mt-0.5 block text-sm">{quantity}</strong></div>
            <div className="px-3 py-2.5 text-right"><span className="block text-[10px] uppercase tracking-wider text-slate-400">Line total</span><strong className="mt-0.5 block text-sm">Rs. {previewTotal.toLocaleString('en-LK')}</strong></div>
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={stageProduct} disabled={!selectedProduct || isLoading} className="inline-flex h-10 items-center gap-2 bg-amber-500 px-5 text-sm font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50">
              <PlusIcon className="h-4 w-4" /> {stagedProduct ? 'Update Product' : 'Add Product'}
            </button>
          </div>
        </section>
      </div>

      <section aria-labelledby="added-products" className="border-t border-border px-4 py-5 sm:px-5">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <h2 id="added-products" className="text-sm font-semibold text-foreground/80">Added Products</h2>
          <span className="inline-flex h-5 min-w-5 items-center justify-center bg-primary px-1.5 text-xs font-bold text-primary-foreground">{stagedProduct ? 1 : 0}</span>
        </div>
        {stagedProduct ? (
          <>
            <div className="rounded-sm border border-border bg-slate-50 p-3 sm:hidden dark:bg-slate-900/30">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{stagedProduct.product.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{stagedProduct.product.code} · {stagedProduct.quantity} × Rs. {stagedProduct.product.price.toLocaleString('en-LK')}</p></div>
                <button type="button" onClick={() => setStagedProduct(null)} aria-label="Remove staged product" className="inline-flex h-8 w-8 shrink-0 items-center justify-center bg-red-500 text-white hover:bg-red-600"><MinusIcon className="h-4 w-4" /></button>
              </div>
              <div className="mt-3 grid grid-cols-2 border-t border-border pt-2 text-xs"><span className="text-muted-foreground">Discount <strong className="ml-1 text-foreground">Rs. {stagedProduct.discount.toLocaleString('en-LK')}</strong></span><span className="text-right text-muted-foreground">Total <strong className="ml-1 text-base text-foreground">Rs. {stagedTotal.toLocaleString('en-LK')}</strong></span></div>
            </div>
            <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted/30 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"><tr><th className="px-3 py-2.5">#</th><th className="px-3 py-2.5">Product</th><th className="px-3 py-2.5">Code</th><th className="px-3 py-2.5 text-right">Qty</th><th className="px-3 py-2.5 text-right">Unit price</th><th className="px-3 py-2.5 text-right">Discount</th><th className="px-3 py-2.5 text-right">Total</th><th className="px-3 py-2.5 text-center">Remove</th></tr></thead>
              <tbody><tr className="border-t border-border"><td className="px-3 py-3 text-muted-foreground">1</td><td className="px-3 py-3 font-medium text-foreground">{stagedProduct.product.name}</td><td className="px-3 py-3 text-muted-foreground">{stagedProduct.product.code}</td><td className="px-3 py-3 text-right">{stagedProduct.quantity}</td><td className="px-3 py-3 text-right">Rs. {stagedProduct.product.price.toLocaleString('en-LK')}</td><td className="px-3 py-3 text-right">Rs. {stagedProduct.discount.toLocaleString('en-LK')}</td><td className="px-3 py-3 text-right font-semibold">Rs. {stagedTotal.toLocaleString('en-LK')}</td><td className="px-3 py-3 text-center"><button type="button" onClick={() => setStagedProduct(null)} aria-label="Remove staged product" className="inline-flex h-7 w-7 items-center justify-center bg-red-500 text-white hover:bg-red-600"><MinusIcon className="h-4 w-4" /></button></td></tr></tbody>
            </table>
            </div>
          </>
        ) : (
          <div className="py-8 text-center text-sm font-medium text-muted-foreground">No products added</div>
        )}
      </section>

      {error && <div role="alert" className="mx-4 mb-4 flex items-start gap-2 border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-sm text-destructive sm:mx-5"><ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}

      <footer className="flex flex-col-reverse gap-2 border-t border-border bg-muted/10 px-4 py-4 sm:flex-row sm:justify-end sm:px-5">
        <button type="button" onClick={cancel} disabled={isLoading} className="h-10 border border-red-300 px-5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">Cancel</button>
        <button type="submit" disabled={!stagedProduct || isLoading || Boolean(statusLoading)} className="inline-flex h-10 min-w-40 items-center justify-center gap-2 bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-cyan-400 disabled:text-white">
          {isLoading ? <LoadingButtonText confirmationMode={confirmationMode} /> : stagedProduct ? <><CheckIcon className="h-4 w-4" />{confirmationMode ? 'Add Order' : 'Create Lead'}</> : 'Please Add Product'}
        </button>
      </footer>
    </form>
  );
}
