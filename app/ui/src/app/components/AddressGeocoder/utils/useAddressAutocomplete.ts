// app/components/hooks/useAddressAutocomplete.ts

import { useState, useRef, useCallback } from 'react';
import type { AddressSuggestion } from '../types';

export const useAddressAutocomplete = () => {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const params = new URLSearchParams({ q: query });
      const response = await fetch(`/api/autocomplete?${params}`);

      if (response.ok) {
        const data: AddressSuggestion[] = await response.json();
        setSuggestions(data);
        setShowSuggestions(data.length > 0);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  }, []);

  const debouncedFetch = useCallback((query: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchSuggestions(query);
    }, 300);
  }, [fetchSuggestions]);

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedIndex(-1);
  }, []);

  const handleKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLInputElement>,
    onSelect: (suggestion: AddressSuggestion) => void
  ) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        if (selectedIndex >= 0) {
          e.preventDefault();
          onSelect(suggestions[selectedIndex]);
          clearSuggestions();
        }
        break;
      case 'Escape':
        clearSuggestions();
        break;
    }
  }, [showSuggestions, suggestions, selectedIndex, clearSuggestions]);

  return {
    suggestions,
    showSuggestions,
    selectedIndex,
    debouncedFetch,
    clearSuggestions,
    handleKeyDown,
  };
};