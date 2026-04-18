export type DeliveryStatus = 'pending' | 'completed' | 'failed';

export type DeliveryStop = {
  id: string;
  stopNumber: number;
  address: string;
  customerName: string;
  phoneNumber?: string;
  packageCount: number;
  notes: string;
  status: DeliveryStatus;
  lat: number;
  lng: number;
  completedAt?: string;
  failureReason?: string;
};

export type DriverRoute = {
  driverName: string;
  routeLabel: string;
  stops: DeliveryStop[];
};

export type OptimizeRequestLike = {
  deliveries?: {
    id: number;
    recipientName?: string;
    phoneNumber?: string;
    address?: string;
    notes?: string;
    location?: {
      lat: number;
      lng: number;
    };
    demand?: {
      value?: number;
    };
  }[];
  vehicles?: {
    id: number;
    driverName?: string;
    vehicleType?: string;
  }[];
};
