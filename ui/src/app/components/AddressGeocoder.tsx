'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Papa from 'papaparse';
import type { OptimizedResponse } from '@/app/types/geocoding';

interface AddressSuggestion {
  display_name: string;
  lat: string;
  lon: string;
  place_id: number;
}

interface VehicleForm {
  _reactId: string;
  id: string;
  vehicleType: string;
  startAddress: string;
  endAddress: string;
  capacity: string;
}

interface DeliveryForm {
  _reactId: string;
  address: string;
  bufferTime: string;
  demandValue: string;
  timeWindowStart: string;
  timeWindowEnd: string;
}

export default function AddressGeocoder() {
  // Delivery states
  const [deliveries, setDeliveries] = useState<DeliveryForm[]>([
    { 
      _reactId: crypto.randomUUID(), 
      address: '', 
      bufferTime: '300',
      demandValue: '1',
      timeWindowStart: '', 
      timeWindowEnd: '' 
    }
  ]);
  
  const [deliverySuggestions, setDeliverySuggestions] = useState<AddressSuggestion[]>([]);
  const [showDeliverySuggestions, setShowDeliverySuggestions] = useState(false);
  const [selectedDeliverySuggestionIndex, setSelectedDeliverySuggestionIndex] = useState(-1);
  const [activeDeliveryId, setActiveDeliveryId] = useState<string | null>(null);
  
  // Vehicle states
  const [vehicles, setVehicles] = useState<VehicleForm[]>([
    {
      _reactId: crypto.randomUUID(),
      id: 'vehicle_1',
      vehicleType: 'car',
      startAddress: '',
      endAddress: '',
      capacity: '200',
    }
  ]);
  
  const [activeAddressField, setActiveAddressField] = useState<{
    vehicleId: string;
    field: 'start' | 'end';
  } | null>(null);
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [selectedAddressSuggestionIndex, setSelectedAddressSuggestionIndex] = useState(-1);
  
  // Other states
  const [results, setResults] = useState<OptimizedResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [csvFileName, setCsvFileName] = useState<string>('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  const deliverySuggestionsRef = useRef<HTMLDivElement>(null);
  const addressSuggestionsRef = useRef<HTMLDivElement>(null);
  const deliveryDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const addressDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const addressInputRefs = useRef<{ [reactId: string]: HTMLInputElement }>({});
  const deliveryInputRefs = useRef<{ [reactId: string]: HTMLInputElement }>({});

  // Validation helpers
  const hasAtLeastOneLetter = (str: string): boolean => {
    return /[a-zA-Z]/.test(str);
  };

  const isValidTime = (timeStr: string): boolean => {
    if (!timeStr || timeStr.trim() === '') return true;
    
    const seconds = timeToSeconds(timeStr);
    const minSeconds = 7 * 3600;
    const maxSeconds = 21 * 3600;
    
    return seconds >= minSeconds && seconds <= maxSeconds;
  };

  const isStartBeforeEnd = (startTime: string, endTime: string): boolean => {
    if (!startTime || !endTime) return true;
    
    const startSeconds = timeToSeconds(startTime);
    const endSeconds = timeToSeconds(endTime);
    
    return startSeconds < endSeconds;
  };

  // Convert time string to seconds from midnight
  const timeToSeconds = (time: string): number => {
    if (!time || time.trim() === '') return 0;
    
    const timeUpper = time.toUpperCase().trim();
    let hours = 0;
    let minutes = 0;
    
    if (timeUpper.includes('AM') || timeUpper.includes('PM')) {
      const isPM = timeUpper.includes('PM');
      const timePart = timeUpper.replace(/AM|PM/g, '').trim();
      const [h, m] = timePart.split(':').map(s => parseInt(s.trim()) || 0);
      
      hours = h === 12 ? (isPM ? 12 : 0) : (isPM ? h + 12 : h);
      minutes = m;
    } else {
      const [h, m] = time.split(':').map(s => parseInt(s.trim()) || 0);
      hours = h;
      minutes = m;
    }
    
    return hours * 3600 + minutes * 60;
  };

  // Validate time string for input field
  const validateTimeInput = (time: string): { valid: boolean; seconds: number } => {
    if (!time || time.trim() === '') {
      return { valid: true, seconds: 0 };
    }

    const seconds = timeToSeconds(time);
    const minSeconds = 7 * 3600;
    const maxSeconds = 21 * 3600;
    
    return {
      valid: seconds >= minSeconds && seconds <= maxSeconds,
      seconds: seconds
    };
  };

  // Fetch address suggestions via API proxy
  const fetchSuggestions = async (
    query: string, 
    setSuggestions: React.Dispatch<React.SetStateAction<AddressSuggestion[]>>, 
    setShow: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    if (query.length < 3) {
      setSuggestions([]);
      setShow(false);
      return;
    }

    try {
      const params = new URLSearchParams({ q: query });
      const response = await fetch(`/api/autocomplete?${params}`);

      if (response.ok) {
        const data: AddressSuggestion[] = await response.json();
        console.log('Autocomplete suggestions:', data); // Debug log
        setSuggestions(data);
        setShow(data.length > 0);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  // Handle delivery address input change
  const handleDeliveryAddressChange = (reactId: string, value: string) => {
    const newDeliveries = deliveries.map(d => 
      d._reactId === reactId ? { ...d, address: value } : d
    );
    setDeliveries(newDeliveries);

    setActiveDeliveryId(reactId);

    if (deliveryDebounceTimerRef.current) {
      clearTimeout(deliveryDebounceTimerRef.current);
    }

    deliveryDebounceTimerRef.current = setTimeout(() => {
      if (value.length >= 3) {
        fetchSuggestions(value, setDeliverySuggestions, setShowDeliverySuggestions);
      } else {
        setDeliverySuggestions([]);
        setShowDeliverySuggestions(false);
      }
    }, 300);
  };

  // Handle delivery field change
  const handleDeliveryFieldChange = (reactId: string, field: keyof DeliveryForm, value: string) => {
    const newDeliveries = deliveries.map(d => 
      d._reactId === reactId ? { ...d, [field]: value } : d
    );
    setDeliveries(newDeliveries);
  };

  // Add new delivery
  const addDelivery = () => {
    setDeliveries([...deliveries, { 
      _reactId: crypto.randomUUID(), 
      address: '', 
      bufferTime: '300',
      demandValue: '1',
      timeWindowStart: '', 
      timeWindowEnd: '' 
    }]);
  };

  // Remove delivery
  const removeDelivery = (reactId: string) => {
    if (deliveries.length > 1) {
      const newDeliveries = deliveries.filter(d => d._reactId !== reactId);
      setDeliveries(newDeliveries);
    }
  };

  // Handle vehicle address input change
  const handleVehicleAddressChange = (reactId: string, field: 'start' | 'end', value: string) => {
    const newVehicles = vehicles.map(v => 
      v._reactId === reactId 
        ? { ...v, [field === 'start' ? 'startAddress' : 'endAddress']: value }
        : v
    );
    setVehicles(newVehicles);

    setActiveAddressField({ vehicleId: reactId, field });

    if (addressDebounceTimerRef.current) {
      clearTimeout(addressDebounceTimerRef.current);
    }

    addressDebounceTimerRef.current = setTimeout(() => {
      if (value.length >= 3) {
        fetchSuggestions(value, setAddressSuggestions, setShowAddressSuggestions);
      } else {
        setAddressSuggestions([]);
        setShowAddressSuggestions(false);
      }
    }, 300);
  };

  // Handle vehicle field change
  const handleVehicleFieldChange = (reactId: string, field: keyof VehicleForm, value: string) => {
    const newVehicles = vehicles.map(v => 
      v._reactId === reactId ? { ...v, [field]: value } : v
    );
    setVehicles(newVehicles);
  };

  // Add new vehicle
  const addVehicle = () => {
    setVehicles([...vehicles, {
      _reactId: crypto.randomUUID(),
      id: `vehicle_${vehicles.length + 1}`,
      vehicleType: 'car',
      startAddress: '',
      endAddress: '',
      capacity: '200',
    }]);
  };

  // Remove vehicle
  const removeVehicle = (reactId: string) => {
    if (vehicles.length > 1) {
      const newVehicles = vehicles.filter(v => v._reactId !== reactId);
      setVehicles(newVehicles);
    }
  };

  // Select delivery suggestion
  const selectDeliverySuggestion = (suggestion: AddressSuggestion) => {
    if (activeDeliveryId === null) return;

    const newDeliveries = deliveries.map(d => 
      d._reactId === activeDeliveryId 
        ? { ...d, address: suggestion.display_name }
        : d
    );
    setDeliveries(newDeliveries);

    setDeliverySuggestions([]);
    setShowDeliverySuggestions(false);
    setSelectedDeliverySuggestionIndex(-1);
    setActiveDeliveryId(null);
  };

  // Select vehicle address suggestion
  const selectAddressSuggestion = (suggestion: AddressSuggestion) => {
    if (!activeAddressField) return;

    const newVehicles = vehicles.map(v => 
      v._reactId === activeAddressField.vehicleId
        ? { 
            ...v, 
            [activeAddressField.field === 'start' ? 'startAddress' : 'endAddress']: suggestion.display_name 
          }
        : v
    );
    setVehicles(newVehicles);

    setAddressSuggestions([]);
    setShowAddressSuggestions(false);
    setSelectedAddressSuggestionIndex(-1);
    setActiveAddressField(null);
  };

  // Handle keyboard navigation for deliveries
  const handleDeliveryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDeliverySuggestions || deliverySuggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedDeliverySuggestionIndex(prev => 
          prev < deliverySuggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedDeliverySuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        if (selectedDeliverySuggestionIndex >= 0) {
          e.preventDefault();
          selectDeliverySuggestion(deliverySuggestions[selectedDeliverySuggestionIndex]);
        }
        break;
      case 'Escape':
        setDeliverySuggestions([]);
        setShowDeliverySuggestions(false);
        setSelectedDeliverySuggestionIndex(-1);
        break;
    }
  };

  // Handle keyboard navigation for vehicle addresses
  const handleAddressKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showAddressSuggestions || addressSuggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedAddressSuggestionIndex(prev => 
          prev < addressSuggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedAddressSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        if (selectedAddressSuggestionIndex >= 0) {
          e.preventDefault();
          selectAddressSuggestion(addressSuggestions[selectedAddressSuggestionIndex]);
        }
        break;
      case 'Escape':
        setAddressSuggestions([]);
        setShowAddressSuggestions(false);
        setSelectedAddressSuggestionIndex(-1);
        break;
    }
  };

  // Click outside handlers
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        deliverySuggestionsRef.current &&
        !deliverySuggestionsRef.current.contains(event.target as Node)
      ) {
        const clickedInsideDeliveryInput = Object.values(deliveryInputRefs.current).some(
          ref => ref && ref.contains(event.target as Node)
        );
        
        if (!clickedInsideDeliveryInput) {
          setShowDeliverySuggestions(false);
          setSelectedDeliverySuggestionIndex(-1);
          setActiveDeliveryId(null);
        }
      }
      
      if (
        addressSuggestionsRef.current &&
        !addressSuggestionsRef.current.contains(event.target as Node)
      ) {
        const clickedInsideInput = Object.values(addressInputRefs.current).some(
          ref => ref && ref.contains(event.target as Node)
        );
        
        if (!clickedInsideInput) {
          setShowAddressSuggestions(false);
          setSelectedAddressSuggestionIndex(-1);
          setActiveAddressField(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (deliveryDebounceTimerRef.current) {
        clearTimeout(deliveryDebounceTimerRef.current);
      }
      if (addressDebounceTimerRef.current) {
        clearTimeout(addressDebounceTimerRef.current);
      }
    };
  }, []);

  // Handle CSV upload with VALIDATION
  const handleCSVUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);
    setError(null);
    setValidationErrors([]);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: (results) => {
        try {
          const deliveriesData: DeliveryForm[] = [];
          const vehiclesData: VehicleForm[] = [];
          const errors: string[] = [];

          results.data.forEach((row: any, rowIndex: number) => {
            const rowType = row.type?.toLowerCase();
            const rowNum = rowIndex + 2;

            if (rowType === 'delivery') {
              const address = row.address?.trim() || '';
              
              if (address && hasAtLeastOneLetter(address)) {
                const rawTimeStart = row.time_window_start;
                const rawTimeEnd = row.time_window_end;
                
                const hasStartTime = rawTimeStart != null && 
                                    rawTimeStart !== '' && 
                                    String(rawTimeStart).trim() !== '';
                const hasEndTime = rawTimeEnd != null && 
                                  rawTimeEnd !== '' && 
                                  String(rawTimeEnd).trim() !== '';
                
                let validStartTime = '';
                let validEndTime = '';
                
                if (hasStartTime) {
                  const timeStart = String(rawTimeStart).trim();
                  const startValidation = validateTimeInput(timeStart);
                  if (startValidation.valid) {
                    validStartTime = timeStart;
                  } else {
                    errors.push(`Row ${rowNum}: Delivery time window start must be between 7:00 AM and 9:00 PM`);
                  }
                }
                
                if (hasEndTime) {
                  const timeEnd = String(rawTimeEnd).trim();
                  const endValidation = validateTimeInput(timeEnd);
                  if (endValidation.valid) {
                    validEndTime = timeEnd;
                  } else {
                    errors.push(`Row ${rowNum}: Delivery time window end must be between 7:00 AM and 9:00 PM`);
                  }
                }
                
                if (validStartTime && validEndTime) {
                  if (!isStartBeforeEnd(validStartTime, validEndTime)) {
                    errors.push(`Row ${rowNum}: Delivery window start time must be before end time`);
                    validStartTime = '';
                    validEndTime = '';
                  }
                }
                
                deliveriesData.push({
                  _reactId: crypto.randomUUID(),
                  address: address,
                  bufferTime: row.buffer_time || '300',
                  demandValue: row.demand_value || '1',
                  timeWindowStart: validStartTime,
                  timeWindowEnd: validEndTime,
                });
              } else {
                errors.push(`Row ${rowNum}: Delivery address must contain at least one letter`);
              }
            } else if (rowType === 'vehicle') {
              const startAddress = row.start_address?.trim() || '';
              const endAddress = row.end_address?.trim() || '';
              
              const validStartAddress = hasAtLeastOneLetter(startAddress) ? startAddress : '';
              const validEndAddress = hasAtLeastOneLetter(endAddress) ? endAddress : '';
              
              if (!validStartAddress) {
                errors.push(`Row ${rowNum}: Vehicle start address must contain at least one letter`);
              }
              if (!validEndAddress) {
                errors.push(`Row ${rowNum}: Vehicle end address must contain at least one letter`);
              }
              
              vehiclesData.push({
                _reactId: crypto.randomUUID(),
                id: row.id || `vehicle_${vehiclesData.length + 1}`,
                vehicleType: row.vehicle_type || 'car',
                startAddress: validStartAddress,
                endAddress: validEndAddress,
                capacity: row.capacity_units || '100',
              });
            }
          });

          if (deliveriesData.length === 0 && vehiclesData.length === 0) {
            setError('No valid deliveries or vehicles found in CSV');
            return;
          }

          if (deliveriesData.length > 0) {
            setDeliveries(deliveriesData);
          }
          if (vehiclesData.length > 0) {
            setVehicles(vehiclesData);
          }

          if (errors.length > 0) {
            setValidationErrors(errors);
          }

          console.log(`Parsed ${deliveriesData.length} deliveries and ${vehiclesData.length} vehicles from CSV`);
        } catch (err) {
          setError('Error parsing CSV file');
          console.error(err);
        }
      },
      error: (error) => {
        setError(`CSV parsing error: ${error.message}`);
      },
    });
  }, []);

  // Handle geocoding with VALIDATION
  const handleGeocode = async () => {
    setLoading(true);
    setError(null);
    setResults(null);
    setValidationErrors([]);

    try {
      const errors: string[] = [];

      // Validate deliveries
      const validDeliveries = deliveries.filter((d, index) => {
        if (!d.address.trim()) return false;
        
        if (!hasAtLeastOneLetter(d.address)) {
          errors.push(`Delivery ${index + 1}: Address must contain at least one letter`);
          return false;
        }
        
        if (d.timeWindowStart && d.timeWindowStart.trim().length > 0) {
          if (!isValidTime(d.timeWindowStart)) {
            errors.push(`Delivery ${index + 1}: Start time must be between 7:00 AM and 9:00 PM`);
          }
        }
        
        if (d.timeWindowEnd && d.timeWindowEnd.trim().length > 0) {
          if (!isValidTime(d.timeWindowEnd)) {
            errors.push(`Delivery ${index + 1}: End time must be between 7:00 AM and 9:00 PM`);
          }
        }
        
        if (d.timeWindowStart && d.timeWindowStart.trim().length > 0 && 
            d.timeWindowEnd && d.timeWindowEnd.trim().length > 0) {
          if (!isStartBeforeEnd(d.timeWindowStart, d.timeWindowEnd)) {
            errors.push(`Delivery ${index + 1}: Start time must be before end time`);
          }
        }
        
        return true;
      });

      if (validDeliveries.length === 0) {
        setError('Please enter at least one valid delivery address');
        setLoading(false);
        return;
      }

      // Convert deliveries to API format
      const deliveriesToGeocode = validDeliveries.map(d => {
        const startSeconds = d.timeWindowStart && d.timeWindowStart.trim().length > 0 
          ? timeToSeconds(d.timeWindowStart) 
          : undefined;
        const endSeconds = d.timeWindowEnd && d.timeWindowEnd.trim().length > 0
          ? timeToSeconds(d.timeWindowEnd) 
          : undefined;

        return {
          address: d.address,
          bufferTime: parseInt(d.bufferTime) || 300,
          demand: parseInt(d.demandValue) || 1,
          timeWindowStart: startSeconds,
          timeWindowEnd: endSeconds,
        };
      });

      // Validate vehicles
      const validVehicles = vehicles.filter((v, index) => {
        let isValid = true;
        
        if (!v.startAddress.trim() || !hasAtLeastOneLetter(v.startAddress)) {
          errors.push(`Vehicle ${index + 1}: Start address must contain at least one letter`);
          isValid = false;
        }
        
        if (!v.endAddress.trim() || !hasAtLeastOneLetter(v.endAddress)) {
          errors.push(`Vehicle ${index + 1}: End address must contain at least one letter`);
          isValid = false;
        }
        
        return isValid;
      });

      if (errors.length > 0) {
        setValidationErrors(errors);
        setLoading(false);
        return;
      }

      if (validVehicles.length === 0) {
        setError('Please enter at least one valid vehicle with start and end addresses');
        setLoading(false);
        return;
      }

      // Convert vehicles to API format
      const vehiclesToGeocode = validVehicles.map(v => ({
        id: v.id,
        vehicleType: v.vehicleType,
        startAddress: v.startAddress,
        endAddress: v.endAddress,
        capacity: parseInt(v.capacity) || 100,
      }));

      // Call API
      const response = await fetch('/api/geocode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deliveries: deliveriesToGeocode,
          vehicles: vehiclesToGeocode,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Geocoding failed');
      }

      const data: OptimizedResponse = await response.json();
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Download JSON
  const downloadJSON = () => {
    if (!results) return;

    const blob = new Blob([JSON.stringify(results, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `delivery_optimization_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            Delivery Route Optimizer
          </h1>

          {/* CSV Upload */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload CSV File (Optional)
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={handleCSVUpload}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100"
            />
            {csvFileName && (
              <p className="mt-2 text-sm text-gray-600">
                Loaded: {csvFileName} ({deliveries.length} deliveries, {vehicles.length} vehicles)
              </p>
            )}
          </div>

          <div className="grid lg:grid-cols-2 gap-12">
            {/* Deliveries Section */}
            <div className="flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                  <span className="text-2xl mr-2">📦</span>
                  Deliveries
                </h2>
                <button
                  onClick={addDelivery}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 flex items-center"
                >
                  <span className="mr-1">+</span> Add Delivery
                </button>
              </div>

              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {deliveries.map((delivery, index) => (
                  <div key={delivery._reactId} className="border border-gray-300 rounded-lg p-4 bg-gray-50 relative">
                    {deliveries.length > 1 && (
                      <button
                        onClick={() => removeDelivery(delivery._reactId)}
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
                        ref={(el) => {
                          if (el) deliveryInputRefs.current[delivery._reactId] = el;
                        }}
                        type="text"
                        value={delivery.address}
                        onChange={(e) => handleDeliveryAddressChange(delivery._reactId, e.target.value)}
                        onKeyDown={handleDeliveryKeyDown}
                        onFocus={() => setActiveDeliveryId(delivery._reactId)}
                        className="text-black w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="201 Pine St, San Francisco, CA"
                      />
                      
                      {/* DELIVERY AUTOCOMPLETE DROPDOWN */}
                      {showDeliverySuggestions && activeDeliveryId === delivery._reactId && deliverySuggestions.length > 0 && (
                        <div
                          ref={deliverySuggestionsRef}
                          className="absolute z-50 w-full mt-1 bg-white border-2 border-blue-300 rounded-md shadow-xl max-h-48 overflow-y-auto"
                        >
                          <div className="bg-blue-50 px-3 py-1 border-b border-blue-200">
                            <p className="text-xs font-semibold text-blue-900">Select Address</p>
                          </div>
                          {deliverySuggestions.map((suggestion, idx) => (
                            <div
                              key={suggestion.place_id}
                              onClick={() => selectDeliverySuggestion(suggestion)}
                              className={`px-3 py-2 cursor-pointer border-b border-gray-100 last:border-b-0 text-sm ${
                                idx === selectedDeliverySuggestionIndex
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
                          onChange={(e) => handleDeliveryFieldChange(delivery._reactId, 'bufferTime', e.target.value)}
                          className="text-black w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                          onChange={(e) => handleDeliveryFieldChange(delivery._reactId, 'demandValue', e.target.value)}
                          className="text-black w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                          onChange={(e) => handleDeliveryFieldChange(delivery._reactId, 'timeWindowStart', e.target.value)}
                          className="text-black w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Default: 7:00AM"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Window End (Optional)
                        </label>
                        <input
                          type="text"
                          value={delivery.timeWindowEnd}
                          onChange={(e) => handleDeliveryFieldChange(delivery._reactId, 'timeWindowEnd', e.target.value)}
                          className="text-black w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Default: 9:00PM"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-3 text-xs text-gray-500">
                💡 Type at least 3 characters to see address suggestions
              </p>
            </div>

            {/* Vehicles */}
            <div className="flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                  <span className="text-2xl mr-2">🚗</span>
                  Vehicles
                </h2>
                <button
                  onClick={addVehicle}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 flex items-center"
                >
                  <span className="mr-1">+</span> Add Vehicle
                </button>
              </div>

              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {vehicles.map((vehicle, index) => (
                  <div key={vehicle._reactId} className="border border-gray-300 rounded-lg p-4 bg-gray-50 relative">
                    {vehicles.length > 1 && (
                      <button
                        onClick={() => removeVehicle(vehicle._reactId)}
                        className="absolute top-2 right-2 text-red-600 hover:text-red-800 text-xl font-bold"
                        title="Remove vehicle"
                      >
                        ×
                      </button>
                    )}

                    <h3 className="font-medium text-gray-700 mb-3">Vehicle {index + 1}</h3>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          ID
                        </label>
                        <input
                          type="text"
                          value={vehicle.id}
                          onChange={(e) => handleVehicleFieldChange(vehicle._reactId, 'id', e.target.value)}
                          className="text-black w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="vehicle_1"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Type
                        </label>
                        <select
                          value={vehicle.vehicleType}
                          onChange={(e) => handleVehicleFieldChange(vehicle._reactId, 'vehicleType', e.target.value)}
                          className="text-black w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                          ref={(el) => {
                            if (el) addressInputRefs.current[`start-${vehicle._reactId}`] = el;
                          }}
                          type="text"
                          value={vehicle.startAddress}
                          onChange={(e) => handleVehicleAddressChange(vehicle._reactId, 'start', e.target.value)}
                          onKeyDown={handleAddressKeyDown}
                          onFocus={() => setActiveAddressField({ vehicleId: vehicle._reactId, field: 'start' })}
                          className="text-black w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="123 Main St, San Francisco, CA"
                        />
                        
                        {/* VEHICLE START ADDRESS AUTOCOMPLETE DROPDOWN */}
                        {showAddressSuggestions && 
                         activeAddressField?.vehicleId === vehicle._reactId && 
                         activeAddressField?.field === 'start' && 
                         addressSuggestions.length > 0 && (
                          <div
                            ref={addressSuggestionsRef}
                            className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto"
                          >
                            {addressSuggestions.map((suggestion, idx) => (
                              <div
                                key={suggestion.place_id}
                                onClick={() => selectAddressSuggestion(suggestion)}
                                className={`px-3 py-2 cursor-pointer border-b border-gray-100 last:border-b-0 text-sm ${
                                  idx === selectedAddressSuggestionIndex
                                    ? 'bg-blue-50 text-blue-900'
                                    : 'hover:bg-gray-50'
                                }`}
                              >
                                <div className="flex items-start">
                                  <span className="text-gray-400 mr-2 text-xs">📍</span>
                                  <p className="flex-1 text-gray-900">
                                    {suggestion.display_name}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="col-span-2 relative">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          End Address *
                        </label>
                        <input
                          ref={(el) => {
                            if (el) addressInputRefs.current[`end-${vehicle._reactId}`] = el;
                          }}
                          type="text"
                          value={vehicle.endAddress}
                          onChange={(e) => handleVehicleAddressChange(vehicle._reactId, 'end', e.target.value)}
                          onKeyDown={handleAddressKeyDown}
                          onFocus={() => setActiveAddressField({ vehicleId: vehicle._reactId, field: 'end' })}
                          className="text-black w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="123 Main St, San Francisco, CA"
                        />
                        
                        {/* VEHICLE END ADDRESS AUTOCOMPLETE DROPDOWN */}
                        {showAddressSuggestions && 
                         activeAddressField?.vehicleId === vehicle._reactId && 
                         activeAddressField?.field === 'end' && 
                         addressSuggestions.length > 0 && (
                          <div
                            ref={addressSuggestionsRef}
                            className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto"
                          >
                            {addressSuggestions.map((suggestion, idx) => (
                              <div
                                key={suggestion.place_id}
                                onClick={() => selectAddressSuggestion(suggestion)}
                                className={`px-3 py-2 cursor-pointer border-b border-gray-100 last:border-b-0 text-sm ${
                                  idx === selectedAddressSuggestionIndex
                                    ? 'bg-blue-50 text-blue-900'
                                    : 'hover:bg-gray-50'
                                }`}
                              >
                                <div className="flex items-start">
                                  <span className="text-gray-400 mr-2 text-xs">📍</span>
                                  <p className="flex-1 text-gray-900">
                                    {suggestion.display_name}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Capacity (units)
                        </label>
                        <input
                          type="number"
                          value={vehicle.capacity}
                          onChange={(e) => handleVehicleFieldChange(vehicle._reactId, 'capacity', e.target.value)}
                          className="text-black w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="200"
                          min="1"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-3 text-xs text-gray-500">
                💡 Type at least 3 characters to see address suggestions
              </p>
            </div>
          </div>

          {/* Validation Errors Display */}
          {validationErrors.length > 0 && (
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="font-semibold text-yellow-800 mb-2">⚠️ Validation Warnings:</p>
              <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
                {validationErrors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {/* Geocode Button */}
          <button
            onClick={handleGeocode}
            disabled={loading || deliveries.every(d => !d.address.trim()) || vehicles.every(v => !v.startAddress.trim())}
            className="w-full mt-6 bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium text-lg"
          >
            {loading ? 'Processing...' : '🚀 Generate Optimized Routes'}
          </button>

          {/* Results */}
          {results && (
            <div className="mt-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-900">✅ Results Ready</h2>
                <button
                  onClick={downloadJSON}
                  className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
                >
                  📥 Download JSON
                </button>
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
                  ✓ Geocoding complete! Click "Download JSON" above to save your optimized route data.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}