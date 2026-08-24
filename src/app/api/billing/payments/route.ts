// src/app/api/billing/payments/route.ts
//
// Tenants settle platform invoices by bank transfer and submit the receipt
// details here, mirroring the store purchase flow. A super admin confirms or
// rejects the transfer; nothing is marked paid on the tenant's say-so.

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { Prisma, TenantInvoiceStatus } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const paymentSchema = z.object({
  invoiceId: z.string().min(1),
  bankReceiptNumber: z.string().min(1, 'Bank receipt number is required'),
  whatsappNumber: z.string().min(1, 'WhatsApp number is required'),
  transferTime: z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid transfer time'),
  amount: z.number().positive('Amount must be greater than zero'),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const parsed = paymentSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.errors }, { status: 400 });
  }
  const data = parsed.data;

  // Scoped by tenantId as well as id, so one tenant can never pay against
  // another tenant's invoice by guessing an id.
  const invoice = await prisma.tenantInvoice.findFirst({
    where: { id: data.invoiceId, tenantId: session.user.tenantId },
    select: { id: true, status: true, total: true },
  });
  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }
  if (invoice.status !== TenantInvoiceStatus.ISSUED) {
    return NextResponse.json(
      { error: `This invoice is ${invoice.status.toLowerCase()} and is not awaiting payment.` },
      { status: 400 },
    );
  }

  const submittedAmount = new Prisma.Decimal(data.amount.toFixed(2));
  if (!submittedAmount.equals(invoice.total)) {
    return NextResponse.json(
      { error: `The transfer amount must exactly match the invoice total of ${invoice.total.toFixed(2)}.` },
      { status: 400 },
    );
  }

  const alreadyPending = await prisma.tenantInvoicePayment.findFirst({
    where: { invoiceId: invoice.id, status: 'PENDING' },
    select: { id: true },
  });
  if (alreadyPending) {
    return NextResponse.json(
      { error: 'A payment for this invoice is already awaiting review.' },
      { status: 409 },
    );
  }

  const payment = await prisma.tenantInvoicePayment.create({
    data: {
      invoiceId: invoice.id,
      tenantId: session.user.tenantId,
      submittedByUserId: session.user.id,
      bankReceiptNumber: data.bankReceiptNumber,
      whatsappNumber: data.whatsappNumber,
      transferTime: new Date(data.transferTime),
      amount: submittedAmount,
    },
  });

  return NextResponse.json({ id: payment.id, status: payment.status });
}
