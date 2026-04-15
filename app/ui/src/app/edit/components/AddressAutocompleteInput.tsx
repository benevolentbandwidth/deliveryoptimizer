"use client";

import { useEffect, useRef} from "react";
import { useAddressAutocomplete } from "../../components/AddressGeocoder/utils/useAddressAutocomplete";
import { AutocompleteDropdown } from "../../components/AddressGeocoder/AutocompleteDropdown";
import type { AddressSuggestion } from "../../components/AddressGeocoder/types";

type Props = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
};

export default function AddressAutocompleteInput({
  value,
  onChange,
  className,
  placeholder,
  ariaLabel,
}: Props) {
  
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { suggestions, showSuggestions, selectedIndex, debouncedFetch, clearSuggestions, handleKeyDown } =
    useAddressAutocomplete();

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  function handleBlur() {
    blurTimeoutRef.current = setTimeout(clearSuggestions, 150);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value);
    debouncedFetch(e.target.value);
  }

  function handleSelect(suggestion: AddressSuggestion) {

    // Avoid redundant blur events
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }

    onChange(suggestion.display_name);
    clearSuggestions();
  }

  return (
    <div className="relative">
      <input
        value={value}
        onChange={handleChange}
        onKeyDown={(e) => handleKeyDown(e, handleSelect)}
        onBlur={handleBlur}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={className}
        autoComplete="off"
      />
      {showSuggestions && (
        <AutocompleteDropdown
          suggestions={suggestions}
          selectedIndex={selectedIndex}
          onSelect={handleSelect}
        />
      )}
    </div>
  );
}
