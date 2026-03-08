// app/components/AddressGeocoder/AutocompleteDropdown.tsx

import React from 'react';
import type { AddressSuggestion } from './types';

interface AutocompleteDropdownProps {
  suggestions: AddressSuggestion[];
  selectedIndex: number;
  onSelect: (suggestion: AddressSuggestion) => void;
  dropdownRef?: React.RefObject<HTMLDivElement>; // Make it optional with nullable type
}

export const AutocompleteDropdown: React.FC<AutocompleteDropdownProps> = ({
  suggestions,
  selectedIndex,
  onSelect,
  dropdownRef,
}) => {
  if (suggestions.length === 0) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute z-50 w-full mt-1 bg-white border-2 border-blue-300 rounded-md shadow-xl max-h-48 overflow-y-auto"
    >
      <div className="bg-blue-50 px-3 py-1 border-b border-blue-200">
        <p className="text-xs font-semibold text-blue-900">Select Address</p>
      </div>
      {suggestions.map((suggestion, idx) => (
        <div
          key={suggestion.place_id}
          onClick={() => onSelect(suggestion)}
          className={`px-3 py-2 cursor-pointer border-b border-gray-100 last:border-b-0 text-sm ${
            idx === selectedIndex
              ? 'bg-blue-100 text-blue-900'
              : 'hover:bg-gray-50'
          }`}
        >
          <div className="flex items-start">
            <span className="text-gray-400 mr-2 text-xs">📍</span>
            <p className="flex-1 text-gray-900 leading-tight">
              {suggestion.display_name}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};