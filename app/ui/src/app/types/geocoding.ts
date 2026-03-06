// app/types/geocoding.ts

export interface Location {
  lat: number;
  lng: number;
}

export interface Vehicle {
  id: string;
  vehicleType: string;
  startLocation: Location;
  endLocation: Location;
  capacity: {
    type: string;
    value: number;
  };
}

export interface Delivery {
  id: string;
  address: string;
  location: Location;
  bufferTime: number;
  demand: {
    type: string;
    value: number;
  };
  time_windows: number[][];
}

export interface OptimizedResponse {
  vehicles: Vehicle[];
  deliveries: Delivery[];
  metadata?: {
    generatedAt: string;
    totalDeliveries: number;
    totalVehicles: number;
    successfulGeocoding: number;
    failedGeocoding: number;
  };
}

export interface VehicleInput {
  id: string;
  vehicleType: string;
  startAddress: string;
  endAddress: string;
  capacity: number;
}

export interface DeliveryInput {
  address: string;
  bufferTime?: number;
  demand?: number;
  timeWindowStart?: number;
  timeWindowEnd?: number;
}

export interface GeocodingRequest {
  deliveries: DeliveryInput[];
  vehicles: VehicleInput[];
}