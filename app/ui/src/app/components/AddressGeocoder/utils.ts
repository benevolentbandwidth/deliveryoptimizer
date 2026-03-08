// app/components/AddressGeocoder/utils.ts

export const hasAtLeastOneLetter = (str: string): boolean => {
  return /[a-zA-Z]/.test(str);
};

export const generateVehicleId = (count: number): string => {
  return `vehicle_${count + 1}`;
};

export const generateDeliveryDefaults = (): Omit<import('./types').DeliveryForm, '_reactId'> => ({
  address: '',
  bufferTime: '300',
  demandValue: '1',
  timeWindowStart: '',
  timeWindowEnd: '',
});

export const generateVehicleDefaults = (count: number): Omit<import('./types').VehicleForm, '_reactId'> => ({
  id: generateVehicleId(count),
  vehicleType: 'car',
  startAddress: '',
  endAddress: '',
  capacity: '200',
});