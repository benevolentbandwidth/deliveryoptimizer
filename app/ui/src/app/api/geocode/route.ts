// app/api/geocode/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';

// TODO: Before production deployment:
// 1. Implement external rate limiting (Redis/Upstash) - current in-memory solution resets on serverless cold starts
// 2. Add request queue for fair distribution across concurrent requests
// 3. Consider caching geocoding results to reduce API calls
// 4. Update User-Agent email to actual contact address

// Zod validation schemas
const DeliveryInputSchema = z.object({
  address: z.string().min(1, 'Address is required'),
  bufferTime: z.number().int().min(0).optional().default(300),
  demand: z.number().int().min(1).optional().default(1),
  timeWindowStart: z.number().int().min(0).max(86400).optional(),
  timeWindowEnd: z.number().int().min(0).max(86400).optional(),
});

const VehicleInputSchema = z.object({
  id: z.string().min(1, 'Vehicle ID is required'),
  vehicleType: z.string().min(1, 'Vehicle type is required'),
  startAddress: z.string().min(1, 'Start address is required'),
  endAddress: z.string().min(1, 'End address is required'),
  capacity: z.number().int().min(1, 'Capacity must be at least 1'),
});

const GeocodingRequestSchema = z.object({
  deliveries: z.array(DeliveryInputSchema).min(1, 'At least one delivery is required'),
  vehicles: z.array(VehicleInputSchema).min(1, 'At least one vehicle is required'),
});

// Rate limiter class
class RateLimiter {
  private lastRequestTime: number = 0;
  private readonly minInterval: number;

  constructor(requestsPerSecond: number) {
    this.minInterval = 1000 / requestsPerSecond;
  }

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minInterval) {
      const waitTime = this.minInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }
}

// Geocoding service
class GeocodingService {
  private provider: 'nominatim' | 'google';
  private googleApiKey?: string;
  private rateLimiter: RateLimiter;

  constructor(provider: 'nominatim' | 'google' = 'nominatim', googleApiKey?: string) {
    this.provider = provider;
    this.googleApiKey = googleApiKey;
    this.rateLimiter = new RateLimiter(1); // 1 request per second for Nominatim
  }

  async geocode(address: string): Promise<{ lat: number; lng: number } | null> {
    if (this.provider === 'nominatim') {
      return this.geocodeNominatim(address);
    } else if (this.provider === 'google' && this.googleApiKey) {
      return this.geocodeGoogle(address);
    }
    return null;
  }

  private async geocodeNominatim(address: string): Promise<{ lat: number; lng: number } | null> {
    await this.rateLimiter.waitForSlot();

    try {
      const params = new URLSearchParams({
        q: address,
        format: 'json',
        limit: '1',
      });

      // Nominatim ToS requires contact email in User-Agent
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params}`,
        {
          headers: {
            'User-Agent': 'DeliveryOptimizer/1.0 (contact@yourcompany.com)', // TODO: Replace with actual contact email
          },
        }
      );

      if (!response.ok) {
        console.error(`Nominatim error: ${response.statusText}`);
        return null;
      }

      const data = await response.json();
      
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
        };
      }
      
      return null;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  }

  private async geocodeGoogle(address: string): Promise<{ lat: number; lng: number } | null> {
    if (!this.googleApiKey) return null;

    try {
      const params = new URLSearchParams({
        address,
        key: this.googleApiKey,
      });

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?${params}`
      );

      if (!response.ok) {
        console.error(`Google Maps error: ${response.statusText}`);
        return null;
      }

      const data = await response.json();

      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const location = data.results[0].geometry.location;
        return {
          lat: location.lat,
          lng: location.lng,
        };
      }

      return null;
    } catch (error) {
      console.error('Google geocoding error:', error);
      return null;
    }
  }
}

// Module-level singleton
// NOTE: This will reset on serverless cold starts - implement external rate limiting for production
const globalGeocoder = new GeocodingService('nominatim', process.env.GOOGLE_MAPS_API_KEY);

// Batch size limit to prevent timeout
const MAX_ADDRESSES = 8;

// Default time window (7 AM to 9 PM in seconds)
const DEFAULT_START_TIME = 7 * 3600;  // 25200
const DEFAULT_END_TIME = 21 * 3600;   // 75600

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate request body with Zod
    const validationResult = GeocodingRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.format(),
        },
        { status: 400 }
      );
    }

    const { deliveries, vehicles } = validationResult.data;

    // Check batch size limit
    const totalAddresses = deliveries.length + (vehicles.length * 2);
    if (totalAddresses > MAX_ADDRESSES) {
      return NextResponse.json(
        {
          error: `Too many addresses to geocode. Maximum ${MAX_ADDRESSES} addresses allowed (you have ${totalAddresses}). Please reduce the batch size.`,
        },
        { status: 400 }
      );
    }

    let successCount = 0;
    let failCount = 0;

    // Geocode deliveries
    const geocodedDeliveries = await Promise.all(
      deliveries.map(async (delivery, index) => {
        const location = await globalGeocoder.geocode(delivery.address);
        
        if (location) {
          successCount++;
        } else {
          failCount++;
        }

        const timeWindows: number[][] = [];
        const startTime = delivery.timeWindowStart ?? DEFAULT_START_TIME;
        const endTime = delivery.timeWindowEnd ?? DEFAULT_END_TIME;
        
        if (startTime && endTime) {
          timeWindows.push([startTime, endTime]);
        }

        return {
          id: `delivery_${index + 1}`,
          address: delivery.address,
          location: location || { lat: 0, lng: 0 },
          bufferTime: delivery.bufferTime,
          demand: {
            type: 'units',
            value: delivery.demand,
          },
          time_windows: timeWindows,
        };
      })
    );

    // Geocode vehicles
    const geocodedVehicles = await Promise.all(
      vehicles.map(async (vehicle) => {
        const startLocation = await globalGeocoder.geocode(vehicle.startAddress);
        const endLocation = await globalGeocoder.geocode(vehicle.endAddress);

        if (startLocation) successCount++;
        else failCount++;

        if (endLocation) successCount++;
        else failCount++;

        return {
          id: vehicle.id,
          vehicleType: vehicle.vehicleType,
          startLocation: startLocation || { lat: 0, lng: 0 },
          endLocation: endLocation || { lat: 0, lng: 0 },
          capacity: {
            type: 'units',
            value: vehicle.capacity,
          },
        };
      })
    );

    // Return optimized response format
    return NextResponse.json({
      vehicles: geocodedVehicles,
      deliveries: geocodedDeliveries,
      metadata: {
        generatedAt: new Date().toISOString(),
        totalDeliveries: deliveries.length,
        totalVehicles: vehicles.length,
        successfulGeocoding: successCount,
        failedGeocoding: failCount,
      },
    });
  } catch (error) {
    console.error('Geocoding API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}