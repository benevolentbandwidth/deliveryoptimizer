// app/api/geocode/route.ts
import { NextRequest, NextResponse } from 'next/server';
import type { 
  VehicleInput, 
  DeliveryInput, 
  GeocodingRequest,
  OptimizedResponse,
  Vehicle,
  Delivery,
  Location
} from '@/app/types/geocoding';

// SINGLETON RATE LIMITER - Shared across all requests

class RateLimiter {
  private lastRequestTime = 0;
  private delay: number;

  constructor(delayMs: number = 1000) {
    this.delay = delayMs;
  }

  async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    
    if (elapsed < this.delay) {
      await new Promise(resolve => setTimeout(resolve, this.delay - elapsed));
    }
    
    this.lastRequestTime = Date.now();
  }
}

class GeocodingService {
  private rateLimiter: RateLimiter;
  private provider: 'nominatim' | 'google';
  private apiKey?: string;

  constructor(provider: 'nominatim' | 'google' = 'nominatim', apiKey?: string) {
    this.provider = provider;
    this.apiKey = apiKey;
    this.rateLimiter = new RateLimiter(1000);
  }

  async geocode(address: string): Promise<{
    latitude?: number;
    longitude?: number;
    formattedAddress: string;
    status: string;
    confidence?: number;
    error?: string;
  }> {
    await this.rateLimiter.throttle();

    try {
      if (this.provider === 'nominatim') {
        return await this.geocodeNominatim(address);
      } else if (this.provider === 'google') {
        return await this.geocodeGoogle(address);
      }
      
      throw new Error('Invalid provider');
    } catch (error) {
      return {
        formattedAddress: address,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async geocodeNominatim(address: string) {
    const params = new URLSearchParams({
      q: address,
      format: 'json',
      limit: '1',
    });

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      {
        headers: {
          'User-Agent': 'AddressGeocodingApp/1.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (data && data.length > 0) {
      const result = data[0];
      return {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        formattedAddress: result.display_name,
        status: 'success',
        confidence: parseFloat(result.importance || '0.5'),
      };
    }

    return {
      formattedAddress: address,
      status: 'not_found',
    };
  }

  private async geocodeGoogle(address: string) {
    if (!this.apiKey) {
      throw new Error('Google Maps API key is required');
    }

    const params = new URLSearchParams({
      address: address,
      key: this.apiKey,
    });

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${params}`
    );

    if (!response.ok) {
      throw new Error(`Google Maps API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const result = data.results[0];
      const location = result.geometry.location;

      return {
        latitude: location.lat,
        longitude: location.lng,
        formattedAddress: result.formatted_address,
        status: 'success',
        confidence:
          result.geometry.location_type === 'ROOFTOP' ? 1.0 : 0.8,
      };
    }

    return {
      formattedAddress: address,
      status: data.status.toLowerCase(),
    };
  }
}

const globalGeocoder = new GeocodingService('nominatim', process.env.GOOGLE_MAPS_API_KEY);

interface RequestInput {
  deliveries: DeliveryInput[];
  vehicles: VehicleInput[];
}

// Main geocoding handler
export async function POST(request: NextRequest) {
  try {
    const body: RequestInput = await request.json();
    const { deliveries, vehicles } = body;

    if (!deliveries || !Array.isArray(deliveries)) {
      return NextResponse.json(
        { error: 'Invalid input: deliveries array required' },
        { status: 400 }
      );
    }

    if (!vehicles || !Array.isArray(vehicles)) {
      return NextResponse.json(
        { error: 'Invalid input: vehicles array required' },
        { status: 400 }
      );
    }
    const MAX_ADDRESSES = 8; // Conservative limit (deliveries + vehicles * 2)
    const totalAddresses = deliveries.length + (vehicles.length * 2);
    
    if (totalAddresses > MAX_ADDRESSES) {
      return NextResponse.json(
        { 
          error: `Batch size too large. Maximum ${MAX_ADDRESSES} addresses allowed (you have ${totalAddresses}). Please split into smaller batches.`,
          details: {
            deliveries: deliveries.length,
            vehicles: vehicles.length,
            totalAddresses: totalAddresses,
            maxAllowed: MAX_ADDRESSES,
          }
        },
        { status: 400 }
      );
    }

    // USE THE SINGLETON GEOCODER
    const geocoder = globalGeocoder;

    let successCount = 0;
    let failCount = 0;

    // Default time window: 7 AM to 9 PM in seconds
    const DEFAULT_START_TIME = 7 * 3600;  // 25200 seconds (7 AM)
    const DEFAULT_END_TIME = 21 * 3600;   // 75600 seconds (9 PM)

    // Process deliveries
    const processedDeliveries: Delivery[] = [];
    for (let i = 0; i < deliveries.length; i++) {
      const delivery = deliveries[i];
      const geoResult = await geocoder.geocode(delivery.address);

      if (geoResult.status === 'success' && geoResult.latitude && geoResult.longitude) {
        // Determine time window start (default to 7 AM if not provided or is 0)
        const timeStart = delivery.timeWindowStart && delivery.timeWindowStart > 0 
          ? delivery.timeWindowStart 
          : DEFAULT_START_TIME;
        
        // Determine time window end (default to 9 PM if not provided or is 0)
        const timeEnd = delivery.timeWindowEnd && delivery.timeWindowEnd > 0
          ? delivery.timeWindowEnd
          : DEFAULT_END_TIME;

        const deliveryData: Delivery = {
          id: `delivery_${i + 1}`,
          address: delivery.address,
          location: {
            lat: geoResult.latitude,
            lng: geoResult.longitude,
          },
          bufferTime: delivery.bufferTime || 300,
          demand: {
            type: 'units',
            value: delivery.demand || 1,
          },
          time_windows: [[timeStart, timeEnd]],  // ALWAYS PRESENT
        };

        processedDeliveries.push(deliveryData);
        successCount++;
      } else {
        failCount++;
        console.error(`Failed to geocode delivery: ${delivery.address}`);
      }
    }

    // Process vehicles
    const processedVehicles: Vehicle[] = [];
    for (const vehicle of vehicles) {
      const startGeoResult = await geocoder.geocode(vehicle.startAddress);
      const endGeoResult = await geocoder.geocode(vehicle.endAddress);

      if (
        startGeoResult.status === 'success' &&
        startGeoResult.latitude &&
        startGeoResult.longitude &&
        endGeoResult.status === 'success' &&
        endGeoResult.latitude &&
        endGeoResult.longitude
      ) {
        processedVehicles.push({
          id: vehicle.id,
          vehicleType: vehicle.vehicleType,
          startLocation: {
            lat: startGeoResult.latitude,
            lng: startGeoResult.longitude,
          },
          endLocation: {
            lat: endGeoResult.latitude,
            lng: endGeoResult.longitude,
          },
          capacity: {
            type: 'units',
            value: vehicle.capacity,
          },
        });
        successCount += 2;
      } else {
        failCount += 2;
        console.error(`Failed to geocode vehicle: ${vehicle.id}`);
      }
    }

    const response: OptimizedResponse = {
      vehicles: processedVehicles,
      deliveries: processedDeliveries,
      metadata: {
        generatedAt: new Date().toISOString(),
        totalDeliveries: processedDeliveries.length,
        totalVehicles: processedVehicles.length,
        successfulGeocoding: successCount,
        failedGeocoding: failCount,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Geocoding error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}