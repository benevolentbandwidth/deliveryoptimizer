// app/components/AddressGeocoder/hooks/useGeocodingValidation.ts

import { isValidTime, isStartBeforeEnd } from './timeConversion';
import { hasAtLeastOneLetter } from '../utils';
import type { DeliveryForm, VehicleForm } from '../types';

export const useGeocodingValidation = () => {
  const validateDeliveries = (deliveries: DeliveryForm[]): {
    valid: DeliveryForm[];
    errors: string[];
  } => {
    const errors: string[] = [];
    
    const valid = deliveries.filter((d, index) => {
      const deliveryName = `Delivery ${index + 1}`;
      
      if (!d.address.trim()) return false;
      
      if (!hasAtLeastOneLetter(d.address)) {
        errors.push(`${deliveryName}: Address must contain at least one letter`);
        return false;
      }
      
      if (d.timeWindowStart && d.timeWindowStart.trim().length > 0) {
        if (!isValidTime(d.timeWindowStart)) {
          errors.push(`${deliveryName}: Start time must be between 7:00 AM and 9:00 PM`);
        }
      }
      
      if (d.timeWindowEnd && d.timeWindowEnd.trim().length > 0) {
        if (!isValidTime(d.timeWindowEnd)) {
          errors.push(`${deliveryName}: End time must be between 7:00 AM and 9:00 PM`);
        }
      }
      
      if (d.timeWindowStart && d.timeWindowStart.trim().length > 0 && 
          d.timeWindowEnd && d.timeWindowEnd.trim().length > 0) {
        if (!isStartBeforeEnd(d.timeWindowStart, d.timeWindowEnd)) {
          errors.push(`${deliveryName}: Start time must be before end time`);
        }
      }
      
      return true;
    });

    return { valid, errors };
  };

  const validateVehicles = (vehicles: VehicleForm[]): {
    valid: VehicleForm[];
    errors: string[];
  } => {
    const errors: string[] = [];
    
    const valid = vehicles.filter((v, index) => {
      const vehicleName = `Vehicle ${index + 1}`;
      let isValid = true;
      
      if (!v.startAddress.trim() || !hasAtLeastOneLetter(v.startAddress)) {
        errors.push(`${vehicleName}: Start address must contain at least one letter`);
        isValid = false;
      }
      
      if (!v.endAddress.trim() || !hasAtLeastOneLetter(v.endAddress)) {
        errors.push(`${vehicleName}: End address must contain at least one letter`);
        isValid = false;
      }
      
      return isValid;
    });

    return { valid, errors };
  };

  return {
    validateDeliveries,
    validateVehicles,
  };
};