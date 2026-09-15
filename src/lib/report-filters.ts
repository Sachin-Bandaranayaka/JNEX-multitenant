import { ShippingProvider, Prisma } from '@prisma/client';
export type ReportFilters = { productId?: string; staffId?: string; courier?: ShippingProvider };
export function parseReportFilters(params: URLSearchParams): ReportFilters {
    const courier = params.get('courier') || params.get('provider');
    return { ...(params.get('productId') ? { productId: params.get('productId')! } : {}), ...(params.get('staffId') ? {staffId:params.get('staffId')!} : {}), ...(courier && Object.values(ShippingProvider).includes(courier as ShippingProvider) ? {courier:courier as ShippingProvider} : {}) };
}
export function reportOrderFilter(tenantId: string, filters: ReportFilters): Prisma.OrderWhereInput {
    return { tenantId, ...(filters.productId ? {productId:filters.productId} : {}), ...(filters.staffId ? {userId:filters.staffId} : {}), ...(filters.courier ? {shippingProvider:filters.courier} : {}) };
}
export function reportLeadFilter(tenantId: string, filters: ReportFilters): Prisma.LeadWhereInput {
    return { tenantId, ...(filters.productId ? {product:{is:{id:filters.productId}}} : {}), ...(filters.staffId ? {userId:filters.staffId} : {}), ...(filters.courier ? {order:{is:{tenantId,shippingProvider:filters.courier}}} : {}) };
}
