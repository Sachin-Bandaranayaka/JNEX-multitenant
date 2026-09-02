import nodemailer from 'nodemailer';
import { render } from '@react-email/render';
import { prisma } from './prisma';
import OrderConfirmation from '@/emails/order-confirmation';
import LeadAssignment from '@/emails/lead-assignment';
import StockAlert from '@/emails/stock-alert';
import UserInvitation from '@/emails/user-invitation';
import ShipmentUpdate from '@/emails/shipment-update';
import SecurityCode from '@/emails/security-code';
import { OrderStatus } from '@prisma/client';

// Two ways out of here, and the configuration picks one.
//
// SMTP (nodemailer) is the low-friction option: any mailbox you already own --
// Gmail with an app password, Google Workspace, your host's mail server -- works
// with no DNS records and no domain to verify. Resend is the higher-volume
// option, but it will not send from an address on a domain you have not proved
// you own, which is a real setup step.
//
// If SMTP_HOST is set we use SMTP; otherwise we fall back to Resend. Nothing
// changes for an existing Resend deployment.

/// The transporter is built on first use rather than at import time: with no
/// SMTP_HOST configured, creating it eagerly meant every deployment carried a
/// transporter pointed at `undefined`.
let cachedTransporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      // Port 465 is implicit TLS; 587 upgrades with STARTTLS after connecting.
      secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }
  return cachedTransporter;
}

/// Most providers refuse to send as an address the authenticated account does
/// not own, so this has to be configurable -- on Gmail it must be the mailbox
/// you authenticated as.
function fromAddress() {
  return process.env.MAIL_FROM || 'Jnex Sales <sales@jnex.lk>';
}

/// SMTP counts as configured only once there are credentials to go with the
/// host. A half-filled block -- the host pasted in but the app password not
/// added yet -- must not hijack the transport and turn every send into an
/// authentication error.
function hasSmtp() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

/// Whether outbound mail can actually be delivered. Callers use this to fail
/// loudly rather than telling a user to check an inbox nothing was sent to.
export function isEmailConfigured() {
  return hasSmtp() || Boolean(process.env.RESEND_API_KEY);
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

async function sendEmail({ to, subject, html }: EmailOptions) {
  if (hasSmtp()) {
    return getTransporter().sendMail({ from: fromAddress(), to, subject, html });
  }

  if (!process.env.RESEND_API_KEY) {
    throw new Error(
      'No email transport configured. Set SMTP_HOST (and credentials) or RESEND_API_KEY.',
    );
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: fromAddress(),
      to,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return response.json();
}

// Order Notifications
export async function sendOrderConfirmationEmail(orderId: string) {
  try {
    // Get order details
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        product: true,
        assignedTo: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    // Format order items for email
    const items = [{
      name: order.product.name,
      quantity: order.quantity,
      price: order.total,
    }];

    // Render email template
    const emailHtml = render(
      OrderConfirmation({
        orderNumber: order.id,
        customerName: order.customerName,
        items,
        total: order.total,
        salesPerson: order.assignedTo?.name || 'Sales Team',
      })
    );

    // Send email
    await sendEmail({
      to: order.customerEmail || 'sales@jnex.lk',
      subject: `Order Confirmation - ${order.id}`,
      html: emailHtml,
    });

    // Update order status
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CONFIRMED,
      },
    });
  } catch (error) {
    console.error('Error sending order confirmation email:', error);
    throw error;
  }
}

// Lead Notifications
export async function sendLeadAssignment(leadId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      product: true,
      assignedTo: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  if (!lead || !lead.assignedTo) {
    throw new Error('Lead not found or not assigned');
  }

  const emailHtml = render(
    LeadAssignment({
      leadId: lead.id,
      customerName: (lead.csvData as any).name,
      productName: lead.product.name,
      assignedTo: lead.assignedTo.name || 'Unknown User',
    })
  );

  await sendEmail({
    to: lead.assignedTo.email,
    subject: `New Lead Assignment: ${(lead.csvData as any).name}`,
    html: emailHtml,
  });
}

// Stock Notifications
export async function sendStockAlert(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    throw new Error('Product not found');
  }

  // Get all admin users
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
  });

  const emailHtml = render(
    StockAlert({
      productName: product.name,
      productCode: product.code,
      currentStock: product.stock,
      lowStockThreshold: product.lowStockAlert,
    })
  );

  // Send to all admins
  await Promise.all(
    admins.map(admin =>
      sendEmail({
        to: admin.email,
        subject: `Low Stock Alert: ${product.name}`,
        html: emailHtml,
      })
    )
  );
}

// User Notifications
export async function sendUserInvitation(userId: string, temporaryPassword: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const emailHtml = render(
    UserInvitation({
      name: user.name || user.email,
      email: user.email,
      temporaryPassword,
      role: user.role,
    })
  );

  await sendEmail({
    to: user.email,
    subject: 'Welcome to J-nex Holdings Sales Management System',
    html: emailHtml,
  });
}

// Shipment Notifications
export async function sendShipmentUpdate(orderId: string, trackingNumber: string, status: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      assignedTo: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  if (!order) {
    throw new Error('Order not found');
  }

  const emailHtml = render(
    ShipmentUpdate({
      trackingNumber,
      status,
      provider: order.shippingProvider || 'Unknown Provider',
      estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default to 7 days from now
      orderNumber: order.id,
      customerName: order.customerName,
    })
  );

  // Send to both customer and sales person
  const emailPromises = [];

  if (order.customerEmail) {
    emailPromises.push(
      sendEmail({
        to: order.customerEmail,
        subject: `Shipment Update: ${trackingNumber}`,
        html: emailHtml,
      })
    );
  }

  if (order.assignedTo?.email) {
    emailPromises.push(
      sendEmail({
        to: order.assignedTo.email,
        subject: `Shipment Update: ${trackingNumber}`,
        html: emailHtml,
      })
    );
  }

  await Promise.all(emailPromises);
}

// Security Codes (passwordless sign-in and password reset)
//
// Deliberately not wrapped in a try/catch: if the code cannot be delivered the
// caller must know, because telling a user "check your email" for a message
// that was never sent leaves them locked out with no explanation.
export async function sendSecurityCodeEmail({
  to,
  name,
  code,
  purpose,
  expiresInMinutes,
}: {
  to: string;
  name?: string | null;
  code: string;
  purpose: 'LOGIN' | 'PASSWORD_RESET';
  expiresInMinutes: number;
}) {
  const emailHtml = render(SecurityCode({ name, code, purpose, expiresInMinutes }));

  await sendEmail({
    to,
    subject: `${code} is your JNEX OMS ${purpose === 'LOGIN' ? 'sign-in' : 'password reset'} code`,
    html: emailHtml,
  });
}
