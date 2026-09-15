import { describe, it, expect } from 'vitest';
import { parseReportFilters, reportOrderFilter, reportLeadFilter } from '../report-filters';
import { salesChartData, productChartData, leadChartData, shippingChartData } from '../report-chart-data';
describe('report filters and chart parity',()=>{
 it('keeps explicit tenant scope with every dimension',()=>{
  const filters=parseReportFilters(new URLSearchParams('tenantId=other&productId=p&staffId=s&courier=TRANS_EXPRESS'));
  expect(reportOrderFilter('tenant',filters)).toEqual({tenantId:'tenant',productId:'p',userId:'s',shippingProvider:'TRANS_EXPRESS'});
  expect(reportLeadFilter('tenant',filters)).toEqual({tenantId:'tenant',product:{is:{id:'p'}},userId:'s',order:{is:{tenantId:'tenant',shippingProvider:'TRANS_EXPRESS'}}});
 });
 it('ignores invalid courier enums and preserves historic Royal filter',()=>{expect(parseReportFilters(new URLSearchParams('courier=BAD')).courier).toBeUndefined();expect(parseReportFilters(new URLSearchParams('courier=ROYAL_EXPRESS')).courier).toBe('ROYAL_EXPRESS');});
 it('sales count and chart revenue reconcile with returned rows',()=>{const data=salesChartData({orders:[{date:'2026-09-01',total:20},{date:'2026-09-01',total:40}],totalRevenue:60,averageOrderValue:30});expect(data.totalOrders).toBe(2);expect(data.dailyRevenue).toEqual([{date:'2026-09-01',revenue:60}]);});
 it('lead counts and conversion chart use same returned lead set',()=>{const data=leadChartData({leads:[{date:'2026-09-01',status:'CONFIRMED'},{date:'2026-09-01',status:'PENDING'}],conversionRate:50});expect(data.totalLeads).toBe(2);expect(data.conversionRate).toBe(.5);expect(data.dailyLeads[0]).toMatchObject({count:2,converted:1});});
 it('product and shipping charts use filtered rows for summaries',()=>{expect(productChartData([{name:'P',currentStock:2,lowStockAlert:1,totalSold:3,revenue:30}])).toMatchObject({totalProducts:1,totalRevenue:30,averageStock:2});const data=shippingChartData([{date:'2026-09-01',provider:'TRANS_EXPRESS',status:'DELIVERED'},{date:'2026-09-01',provider:'TRANS_EXPRESS',status:'RETURNED'}]);expect(data).toMatchObject({totalShipments:2,delivered:1,returned:1,providerPerformance:[{provider:'TRANS_EXPRESS',shipments:2}]});});
});
