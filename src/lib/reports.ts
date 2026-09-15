import { ReportFilters, reportOrderFilter, reportLeadFilter } from './report-filters';
import { getScopedPrismaClient } from './prisma';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf'; // --- FIX: Changed to a default import
import autoTable from 'jspdf-autotable';
import { parse } from 'json2csv';
import { ShippingProvider } from '@prisma/client';

// --- INTERFACES (No changes) ---

interface ReportOptions extends ReportFilters {
    startDate: Date;
    endDate: Date;
    tenantId: string;
}

interface ShippingReportOptions extends ReportOptions {
    provider?: ShippingProvider | null;
}

// --- DATA GENERATION FUNCTIONS (No changes) ---

export async function generateSalesReport({ startDate, endDate, tenantId, ...filters }: ReportOptions) {
    const prisma = getScopedPrismaClient(tenantId);
    const orders = await prisma.order.findMany({
        where: { ...reportOrderFilter(tenantId,filters), createdAt: { gte: startDate, lte: endDate } },
        include: {
            product: { select: { name: true } },
            assignedTo: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
    });

    const mappedOrders = orders.map((order) => ({
        id: order.id,
        date: order.createdAt.toISOString().slice(0,10),
        customer: order.customerName,
        total: order.total,
        product: order.product.name,
        quantity: order.quantity,
        status: order.status,
        salesPerson: order.assignedTo?.name || 'N/A',
    }));

    return {
        totalOrders: orders.length,
        totalRevenue: orders.reduce((sum, order) => sum + order.total, 0),
        averageOrderValue: orders.length > 0 ? orders.reduce((sum, order) => sum + order.total, 0) / orders.length : 0,
        orders: mappedOrders,
    };
}

export async function generateProductReport({ startDate, endDate, tenantId, ...filters }: ReportOptions) {
    const prisma = getScopedPrismaClient(tenantId);
    const products = await prisma.product.findMany({
        where: {tenantId, ...(filters.productId ? {id:filters.productId} : {}), ...((filters.staffId || filters.courier) ? {OR:[{orders:{some:reportOrderFilter(tenantId,filters)}},{leads:{some:reportLeadFilter(tenantId,filters)}}]} : {})},
        include: {
            orders: { where: { ...reportOrderFilter(tenantId,filters), createdAt: { gte: startDate, lte: endDate } } },
            leads: { where: { ...reportLeadFilter(tenantId,filters), createdAt: { gte: startDate, lte: endDate } } },
        },
    });

    return products.map((product) => ({
        code: product.code,
        name: product.name,
        currentStock: product.stock,
        lowStockAlert: product.lowStockAlert,
        totalSold: product.orders.reduce((sum, order) => sum + order.quantity, 0),
        revenue: product.orders.reduce((sum, order) => sum + order.total, 0),
        leads: product.leads.length,
    }));
}

export async function generateLeadReport({ startDate, endDate, tenantId, ...filters }: ReportOptions) {
    const prisma = getScopedPrismaClient(tenantId);
    const leads = await prisma.lead.findMany({
        where: { ...reportLeadFilter(tenantId,filters), createdAt: { gte: startDate, lte: endDate } },
        include: {
            product: { select: { name: true } },
            assignedTo: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
    });
    
    const mappedLeads = leads.map((lead) => ({
        id: lead.id,
        date: lead.createdAt.toISOString().slice(0,10),
        customerName: (lead.csvData as any)?.name || 'N/A',
        customerPhone: (lead.csvData as any)?.phone || 'N/A',
        product: lead.product.name,
        status: lead.status,
        assignedTo: lead.assignedTo?.name || 'Unassigned',
    }));

    return {
        totalLeads: leads.length,
        conversionRate: leads.length > 0 ? (leads.filter((lead) => lead.status === 'CONFIRMED').length / leads.length) * 100 : 0,
        leads: mappedLeads,
    };
}

export async function generateShippingReport({ startDate, endDate, provider, tenantId, ...filters }: ShippingReportOptions) {
    const prisma = getScopedPrismaClient(tenantId);
    const orders = await prisma.order.findMany({
        where: {
            ...reportOrderFilter(tenantId, filters),
            createdAt: { gte: startDate, lte: endDate },
            status: { in: ['SHIPPED', 'DELIVERED', 'RETURNED'] },
            ...(provider && { shippingProvider: provider }),
        },
        include: { product: true, assignedTo: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
    });

    return orders.map(order => ({
        id: order.id,
        date: order.createdAt.toISOString().slice(0,10),
        customer: order.customerName,
        status: order.status,
        provider: order.shippingProvider,
        trackingNumber: order.trackingNumber,
        salesPerson: order.assignedTo?.name || 'N/A',
    }));
}


// --- EXPORT HELPER FUNCTIONS ---

async function exportToExcel(data: any[], sheetName: string, columns: { header: string; key: string }[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);
    worksheet.columns = columns.map(col => ({ ...col, width: 25 }));
    worksheet.getRow(1).font = { bold: true };
    worksheet.addRows(data);
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
}

async function exportToCsv(data: any[]): Promise<Buffer> {
    if (data.length === 0) return Buffer.from('');
    const csv = parse(data);
    return Buffer.from(csv);
}

async function exportToPdf(title: string, columns: { header: string; dataKey: string }[], data: any[]): Promise<Buffer> {
    const doc = new jsPDF();
    doc.text(title, 14, 20);
    autoTable(doc, {
        head: [columns.map(c => c.header)],
        body: data.map(row => columns.map(c => row[c.dataKey] ?? 'N/A')),
        startY: 25,
        theme: 'striped',
        headStyles: { fillColor: [38, 43, 62] },
    });
    return Buffer.from(doc.output('arraybuffer'));
}


// --- EXPORT ORCHESTRATION FUNCTIONS (No changes) ---

export async function exportSalesReport(data: any, format: string): Promise<Buffer> {
    const columns = [
        { header: 'Order ID', key: 'id' }, { header: 'Date', key: 'date' },
        { header: 'Customer', key: 'customer' }, { header: 'Total', key: 'total' },
        { header: 'Product', key: 'product' }, { header: 'Status', key: 'status' },
    ];
    if (format === 'excel') return exportToExcel(data.orders, 'Sales Report', columns);
    if (format === 'csv') return exportToCsv(data.orders);
    if (format === 'pdf') return exportToPdf('Sales Report', columns.map(c => ({...c, dataKey: c.key})), data.orders);
    throw new Error('Unsupported format');
}

export async function exportProductReport(data: any[], format: string): Promise<Buffer> {
    const columns = [
        { header: 'Code', key: 'code' }, { header: 'Name', key: 'name' },
        { header: 'Stock', key: 'currentStock' }, { header: 'Sold', key: 'totalSold' },
        { header: 'Revenue', key: 'revenue' },
    ];
    if (format === 'excel') return exportToExcel(data, 'Product Report', columns);
    if (format === 'csv') return exportToCsv(data);
    if (format === 'pdf') return exportToPdf('Product Report', columns.map(c => ({...c, dataKey: c.key})), data);
    throw new Error('Unsupported format');
}

export async function exportLeadReport(data: any, format: string): Promise<Buffer> {
    const columns = [
        { header: 'Date', key: 'date' }, { header: 'Customer', key: 'customerName' },
        { header: 'Phone', key: 'customerPhone' }, { header: 'Product', key: 'product' },
        { header: 'Status', key: 'status' }, { header: 'Assigned To', key: 'assignedTo' },
    ];
    if (format === 'excel') return exportToExcel(data.leads, 'Lead Report', columns);
    if (format === 'csv') return exportToCsv(data.leads);
    if (format === 'pdf') return exportToPdf('Lead Report', columns.map(c => ({...c, dataKey: c.key})), data.leads);
    throw new Error('Unsupported format');
}

export async function exportShippingReport(data: any[], format: string): Promise<Buffer> {
    const columns = [
        { header: 'Order ID', key: 'id' }, { header: 'Date', key: 'date' },
        { header: 'Customer', key: 'customer' }, { header: 'Status', key: 'status' },
        { header: 'Provider', key: 'provider' }, { header: 'Tracking #', key: 'trackingNumber' },
    ];
    if (format === 'excel') return exportToExcel(data, 'Shipping Report', columns);
    if (format === 'csv') return exportToCsv(data);
    if (format === 'pdf') return exportToPdf('Shipping Report', columns.map(c => ({...c, dataKey: c.key})), data);
    throw new Error('Unsupported format');
}