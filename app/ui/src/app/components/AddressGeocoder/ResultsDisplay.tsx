// app/components/AddressGeocoder/ResultsDisplay.tsx

import React from 'react';
import type { OptimizedResponse } from '@/app/types/geocoding';

interface ResultsDisplayProps {
  results: OptimizedResponse;
  onDownload: () => void;
}

export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ results, onDownload }) => {
  return (
    <div className="mt-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-900">✅ Results Ready</h2>
        <div className="flex gap-3">
          <button
            onClick={onDownload}
            className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
          >
            📥 Download JSON
          </button>
        </div>
      </div>

      {results.metadata && (
        <div className="bg-gradient-to-r from-blue-50 to-green-50 p-6 rounded-lg mb-6 border border-blue-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Vehicles</p>
              <p className="text-3xl font-bold text-blue-600">
                {results.metadata.totalVehicles}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Deliveries</p>
              <p className="text-3xl font-bold text-purple-600">
                {results.metadata.totalDeliveries}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Success</p>
              <p className="text-3xl font-bold text-green-600">
                {results.metadata.successfulGeocoding}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Failed</p>
              <p className="text-3xl font-bold text-red-600">
                {results.metadata.failedGeocoding}
              </p>
            </div>
          </div>
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-700">
              Generated: {new Date(results.metadata.generatedAt).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
        <p className="text-green-800 font-medium">
          ✓ Geocoding complete! Download the JSON to continue.
        </p>
      </div>
    </div>
  );
};
