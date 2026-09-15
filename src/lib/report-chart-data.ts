type Sale = {date:string;total:number};
type Lead = {date:string;status:string};
type Shipment = {date:string;provider:string|null;status:string};
export function salesChartData(report: {orders:Sale[];totalRevenue:number;averageOrderValue:number}) {
    const days = new Map<string,number>(); report.orders.forEach(order=>days.set(order.date,(days.get(order.date)||0)+order.total));
    return {...report,totalOrders:report.orders.length,dailyRevenue:[...days].sort(([a],[b])=>a.localeCompare(b)).map(([date,revenue])=>({date,revenue}))};
}
export function leadChartData(report:{leads:Lead[];conversionRate:number}) {
    const days = new Map<string,{date:string;count:number;converted:number}>(); const states = new Map<string,number>();
    report.leads.forEach(lead=>{const day=days.get(lead.date)||{date:lead.date,count:0,converted:0};day.count++;if(lead.status==='CONFIRMED')day.converted++;days.set(lead.date,day);states.set(lead.status,(states.get(lead.status)||0)+1);});
    return {totalLeads:report.leads.length,conversionRate:report.conversionRate/100,averageResponseTime:0,dailyLeads:[...days.values()].sort((a,b)=>a.date.localeCompare(b.date)),leadsByStatus:[...states].map(([status,count])=>({status,count}))};
}
export function productChartData(rows:Array<{name:string;currentStock:number;lowStockAlert:number;totalSold:number;revenue:number}>) {
    return {totalProducts:rows.length,totalRevenue:rows.reduce((sum,row)=>sum+row.revenue,0),averageStock:rows.length?rows.reduce((sum,row)=>sum+row.currentStock,0)/rows.length:0,topProducts:rows.map(row=>({name:row.name,sales:row.totalSold,revenue:row.revenue})),stockLevels:rows.map(row=>({name:row.name,stock:row.currentStock,lowStockAlert:row.lowStockAlert}))};
}
export function shippingChartData(rows:Shipment[]) {
    const days = new Map<string,number>();const providers=new Map<string,number>();rows.forEach(row=>{days.set(row.date,(days.get(row.date)||0)+1);const key=row.provider||'UNASSIGNED';providers.set(key,(providers.get(key)||0)+1);});
    return {totalShipments:rows.length,delivered:rows.filter(row=>row.status==='DELIVERED').length,returned:rows.filter(row=>row.status==='RETURNED').length,onTimeDeliveryRate:0,averageDeliveryTime:0,dailyShipments:[...days].sort(([a],[b])=>a.localeCompare(b)).map(([date,count])=>({date,count})),providerPerformance:[...providers].map(([provider,shipments])=>({provider,shipments}))};
}
