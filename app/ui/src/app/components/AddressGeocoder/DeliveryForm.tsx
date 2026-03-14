// app/components/AddressGeocoder/DeliveryForm.tsx

import React, { useRef } from 'react';
import { AutocompleteDropdown } from './AutocompleteDropdown';
import type { DeliveryForm, AddressSuggestion } from './types';

interface DeliveryFormProps {
  delivery: DeliveryForm;
  index: number;
  canRemove: boolean;
  onRemove: (reactId: string) => void;
  onFieldChange: (reactId: string, field: keyof DeliveryForm, value: string) => void;
  onAddressChange: (reactId: string, value: string) => void;
  onFocus: (reactId: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  showSuggestions: boolean;
  suggestions: AddressSuggestion[];
  selectedIndex: number;
  onSelectSuggestion: (suggestion: AddressSuggestion) => void;
  isActive: boolean;
}

export const DeliveryFormComponent: React.FC<DeliveryFormProps> = ({
  delivery,
  index,
  canRemove,
  onRemove,
  onFieldChange,
  onAddressChange,
  onFocus,
  onKeyDown,
  showSuggestions,
  suggestions,
  selectedIndex,
  onSelectSuggestion,
  isActive,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  return (
    <div className="border border-gray-300 rounded-lg p-4 bg-gray-50 relative">
      {canRemove && (
        <button
          onClick={() => onRemove(delivery._reactId)}
          className="absolute top-2 right-2 text-red-600 hover:text-red-800 text-xl font-bold"
          title="Remove delivery"
        >
          ×
        </button>
      )}

      <h3 className="font-medium text-gray-700 mb-3 text-sm">Delivery {index + 1}</h3>

      {/* Address Field with Autocomplete */}
      <div className="mb-3 relative">
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Address *
        </label>
        <input
          ref={inputRef}
          type="text"
          value={delivery.address}
          onChange={(e) => onAddressChange(delivery._reactId, e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => onFocus(delivery._reactId)}
          className="w-full px-2 py-1.5 text-sm text-black border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="201 Pine St, San Francisco, CA"
        />
        
        {showSuggestions && isActive && (
          <AutocompleteDropdown
            suggestions={suggestions}
            selectedIndex={selectedIndex}
            onSelect={onSelectSuggestion}
            dropdownRef={dropdownRef}
          />
        )}
      </div>

      {/* Buffer Time and Demand */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Buffer Time (seconds)
          </label>
          <input
            type="number"
            value={delivery.bufferTime}
            onChange={(e) => onFieldChange(delivery._reactId, 'bufferTime', e.target.value)}
            className="w-full px-2 py-1.5 text-sm text-black border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="300"
            min="0"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Demand (units)
          </label>
          <input
            type="number"
            value={delivery.demandValue}
            onChange={(e) => onFieldChange(delivery._reactId, 'demandValue', e.target.value)}
            className="w-full px-2 py-1.5 text-sm text-black border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="1"
            min="1"
          />
        </div>
      </div>

      {/* Time Windows */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Window Start (Optional)
          </label>
          <input
            type="text"
            value={delivery.timeWindowStart}
            onChange={(e) => onFieldChange(delivery._reactId, 'timeWindowStart', e.target.value)}
            className="w-full px-2 py-1.5 text-sm text-black border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., 9:00 AM"
            title="Enter time in format like '9:00 AM' or '14:00'. Defaults to 7:00 AM if left blank."
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Window End (Optional)
          </label>
          <input
            type="text"
            value={delivery.timeWindowEnd}
            onChange={(e) => onFieldChange(delivery._reactId, 'timeWindowEnd', e.target.value)}
            className="w-full px-2 py-1.5 text-sm text-black border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., 5:00 PM"
            title="Enter time in format like '5:00 PM' or '17:00'. Defaults to 9:00 PM if left blank."
          />
        </div>
      </div>
      
      {/* Helper text for time windows */}
      <p className="text-xs text-gray-500 mt-2">
        💡 Times: Use &quot;9:00 AM&quot; or &quot;14:00&quot; format. Defaults: 7:00 AM - 9:00 PM
      </p>
    </div>
  );
};