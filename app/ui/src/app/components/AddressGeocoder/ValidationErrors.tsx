// app/components/AddressGeocoder/ValidationErrors.tsx

import React from 'react';

interface ValidationErrorsProps {
  errors: string[];
}

export const ValidationErrors: React.FC<ValidationErrorsProps> = ({ errors }) => {
  if (errors.length === 0) return null;

  return (
    <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
      <p className="font-semibold text-yellow-800 mb-2">⚠️ Validation Warnings:</p>
      <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
        {errors.map((err, idx) => (
          <li key={idx}>{err}</li>
        ))}
      </ul>
    </div>
  );
};