// app/components/AddressGeocoder/VehicleForm.tsx

import React, { useRef } from 'react';
import { AutocompleteDropdown } from './AutocompleteDropdown';
import type { VehicleForm, AddressSuggestion } from './types';

interface VehicleFormProps {
  vehicle: VehicleForm;
  index: number;
  canRemove: boolean;
  onRemove: (reactId: string) => void;
  onFieldChange: (reactId: string, field: keyof VehicleForm, value: string) => void;
  onAddressChange: (reactId: string, field: 'start' | 'end', value: string) => void;
  onFocus: (reactId: string, field: 'start' | 'end') => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  // Autocomplete props
  showStartSuggestions: boolean;
  showEndSuggestions: boolean;
  suggestions: AddressSuggestion[];
  selectedIndex: number;
  onSelectSuggestion: (suggestion: AddressSuggestion) => void;
}

export const VehicleFormComponent: React.FC<VehicleFormProps> = ({
  vehicle,
  index,
  canRemove,
  onRemove,
  onFieldChange,
  onAddressChange,
  onFocus,
  onKeyDown,
  showStartSuggestions,
  showEndSuggestions,
  suggestions,
  selectedIndex,
  onSelectSuggestion,
}) => {
  const startDropdownRef = useRef<HTMLDivElement>(null);
  const endDropdownRef = useRef<HTMLDivElement>(null);

  return (
    <div className="border border-gray-300 rounded-lg p-4 bg-gray-50 relative">
      {canRemove && (
        <button
          onClick={() => onRemove(vehicle._reactId)}
          className="absolute top-2 right-2 text-red-600 hover:text-red-800 text-xl font-bold"
          title="Remove vehicle"
        >
          ×
        </button>
      )}

      <h3 className="font-medium text-gray-700 mb-3">Vehicle {index + 1}</h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">ID</label>
          <input
            type="text"
            value={vehicle.id}
            onChange={(e) => onFieldChange(vehicle._reactId, 'id', e.target.value)}
            className="w-full px-2 py-1.5 text-sm text-black border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="vehicle_1"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
          <select
            value={vehicle.vehicleType}
            onChange={(e) => onFieldChange(vehicle._reactId, 'vehicleType', e.target.value)}
            className="w-full px-2 py-1.5 text-sm text-black border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="car">Car</option>
            <option value="van">Van</option>
            <option value="truck">Truck</option>
            <option value="bicycle">Bicycle</option>
            <option value="motorcycle">Motorcycle</option>
          </select>
        </div>

        <div className="col-span-2 relative">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Start Address *
          </label>
          <input
            type="text"
            value={vehicle.startAddress}
            onChange={(e) => onAddressChange(vehicle._reactId, 'start', e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => onFocus(vehicle._reactId, 'start')}
            className="w-full px-2 py-1.5 text-sm text-black border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="123 Main St, San Francisco, CA"
          />
          
          {showStartSuggestions && (
            <AutocompleteDropdown
              suggestions={suggestions}
              selectedIndex={selectedIndex}
              onSelect={onSelectSuggestion}
              dropdownRef={startDropdownRef}
            />
          )}
        </div>

        <div className="col-span-2 relative">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            End Address *
          </label>
          <input
            type="text"
            value={vehicle.endAddress}
            onChange={(e) => onAddressChange(vehicle._reactId, 'end', e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => onFocus(vehicle._reactId, 'end')}
            className="w-full px-2 py-1.5 text-sm text-black border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="123 Main St, San Francisco, CA"
          />
          
          {showEndSuggestions && (
            <AutocompleteDropdown
              suggestions={suggestions}
              selectedIndex={selectedIndex}
              onSelect={onSelectSuggestion}
              dropdownRef={endDropdownRef}
            />
          )}
        </div>

        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Capacity (units)
          </label>
          <input
            type="number"
            value={vehicle.capacity}
            onChange={(e) => onFieldChange(vehicle._reactId, 'capacity', e.target.value)}
            className="w-full px-2 py-1.5 text-sm text-black border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="200"
            min="1"
          />
        </div>
      </div>
    </div>
  );
};