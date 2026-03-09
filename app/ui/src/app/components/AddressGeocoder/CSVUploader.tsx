// app/components/AddressGeocoder/CSVUploader.tsx

import React from 'react';

interface CSVUploaderProps {
  onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  fileName: string;
  deliveryCount: number;
  vehicleCount: number;
}

export const CSVUploader: React.FC<CSVUploaderProps> = ({
  onUpload,
  fileName,
  deliveryCount,
  vehicleCount,
}) => {
  return (
    <div className="mb-8">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Upload CSV File (Optional)
      </label>
      <p className="text-xs text-gray-600 mb-2">
        CSV Format: type, id, address, buffer_time, demand_value, time_window_start, time_window_end, vehicle_type, capacity_units, start_address, end_address
      </p>
      <p className="text-xs text-gray-500 mb-2">
        💡 Time windows: Use seconds from midnight (e.g., 28800 for 8:00 AM) or time format (e.g., "9:00 AM")
      </p>
      <input
        type="file"
        accept=".csv"
        onChange={onUpload}
        className="block w-full text-sm text-gray-500
          file:mr-4 file:py-2 file:px-4
          file:rounded-md file:border-0
          file:text-sm file:font-semibold
          file:bg-blue-50 file:text-blue-700
          hover:file:bg-blue-100"
      />
      {fileName && (
        <p className="mt-2 text-sm text-gray-600">
          Loaded: {fileName} ({deliveryCount} deliveries, {vehicleCount} vehicles)
        </p>
      )}
    </div>
  );
};