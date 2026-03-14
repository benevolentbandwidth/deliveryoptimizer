// app/components/types.ts

export interface AddressSuggestion {
  display_name: string;
  lat: string;
  lon: string;
  place_id: number;
}

export interface VehicleForm {
  _reactId: string;
  id: string;
  vehicleType: string;
  startAddress: string;
  endAddress: string;
  capacity: string;
}

export interface DeliveryForm {
  _reactId: string;
  address: string;
  bufferTime: string;
  demandValue: string;
  timeWindowStart: string;
  timeWindowEnd: string;
}

export interface ActiveAddressField {
  vehicleId: string;
  field: 'start' | 'end';
}