// src/types/orders.ts

export interface CreateOrderData {
    leadId: string;
    userId: string;
    quantity: number;
    tenantId: string;
    shippingLocation?: {
      provider: 'TRANS_EXPRESS';
      districtId: number;
      districtName: string;
      cityId: number;
      cityName: string;
    };
  }
