export interface ShippingAddress {
  name: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
  alternatePhone?: string;
}

export interface PackageDetails {
  weight: number; // in kg
  length: number; // in cm
  width: number;  // in cm
  height: number; // in cm
  description?: string; // Package description
}

export interface ShippingRate {
  provider: string;
  service: string;
  rate: number;
  estimatedDays: number;
}

export interface ShippingLabel {
  trackingNumber: string;
  labelUrl: string;
  provider: string;
}

export interface ShippingProvider {
  getName(): string;
  getRates(
    origin: ShippingAddress,
    destination: ShippingAddress,
    packageDetails: PackageDetails
  ): Promise<ShippingRate[]>;
  createShipment(
    origin: ShippingAddress,
    destination: ShippingAddress,
    packageDetails: PackageDetails,
    service: string
  ): Promise<ShippingLabel>;
  trackShipment(trackingNumber: string): Promise<ShipmentStatus>;
}

export enum ShipmentStatus {
  PENDING = 'PENDING',
  IN_TRANSIT = 'IN_TRANSIT',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  RETURNED = 'RETURNED',
  EXCEPTION = 'EXCEPTION'
}
