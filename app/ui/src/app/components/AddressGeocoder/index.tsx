// app/components/AddressGeocoder/index.tsx

'use client';

import { useState, useCallback, useEffect } from 'react';
import Papa from 'papaparse';
import type { OptimizedResponse } from '@/app/types/geocoding';
import { DeliveryFormComponent } from './DeliveryForm';
import { VehicleFormComponent } from './VehicleForm';
import { CSVUploader } from './CSVUploader';
import { ResultsDisplay } from './ResultsDisplay';
import { ValidationErrors } from './ValidationErrors';
import { useAddressAutocomplete } from './utils/useAddressAutocomplete';
import { useGeocodingValidation } from './utils/useGeocodingValidation';
import { timeToSeconds, secondsToTimeAMPM } from './utils/timeConversion';
import { hasAtLeastOneLetter, generateDeliveryDefaults, generateVehicleDefaults } from './utils';
import type { DeliveryForm, VehicleForm, AddressSuggestion, ActiveAddressField } from './types';

export default function AddressGeocoder() {
  // State: Deliveries
  const [deliveries, setDeliveries] = useState<DeliveryForm[]>([
    { _reactId: crypto.randomUUID(), ...generateDeliveryDefaults() }
  ]);
  const [activeDeliveryId, setActiveDeliveryId] = useState<string | null>(null);

  // State: Vehicles
  const [vehicles, setVehicles] = useState<VehicleForm[]>([
    { _reactId: crypto.randomUUID(), ...generateVehicleDefaults(0) }
  ]);
  const [activeAddressField, setActiveAddressField] = useState<ActiveAddressField | null>(null);

  // State: UI
  const [results, setResults] = useState<OptimizedResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [csvFileName, setCsvFileName] = useState<string>('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Hooks: Autocomplete for deliveries
  const deliveryAutocomplete = useAddressAutocomplete();
  
  // Hooks: Autocomplete for vehicles
  const vehicleAutocomplete = useAddressAutocomplete();

  // Hooks: Validation
  const { validateDeliveries, validateVehicles } = useGeocodingValidation();

  // Delivery Handlers
  const handleAddDelivery = () => {
    setDeliveries([...deliveries, { 
      _reactId: crypto.randomUUID(), 
      ...generateDeliveryDefaults() 
    }]);
  };

  const handleRemoveDelivery = (reactId: string) => {
    if (deliveries.length > 1) {
      setDeliveries(deliveries.filter(d => d._reactId !== reactId));
    }
  };

  const handleDeliveryFieldChange = (reactId: string, field: keyof DeliveryForm, value: string) => {
    setDeliveries(deliveries.map(d => 
      d._reactId === reactId ? { ...d, [field]: value } : d
    ));
  };

  const handleDeliveryAddressChange = (reactId: string, value: string) => {
    handleDeliveryFieldChange(reactId, 'address', value);
    setActiveDeliveryId(reactId);
    deliveryAutocomplete.debouncedFetch(value);
  };

  const handleDeliveryFocus = (reactId: string) => {
    setActiveDeliveryId(reactId);
  };

  const handleSelectDeliverySuggestion = (suggestion: AddressSuggestion) => {
    if (activeDeliveryId === null) return;
    
    handleDeliveryFieldChange(activeDeliveryId, 'address', suggestion.display_name);
    deliveryAutocomplete.clearSuggestions();
    setActiveDeliveryId(null);
  };

  // Vehicle Handlers
  const handleAddVehicle = () => {
    setVehicles([...vehicles, {
      _reactId: crypto.randomUUID(),
      ...generateVehicleDefaults(vehicles.length),
    }]);
  };

  const handleRemoveVehicle = (reactId: string) => {
    if (vehicles.length > 1) {
      setVehicles(vehicles.filter(v => v._reactId !== reactId));
    }
  };

  const handleVehicleFieldChange = (reactId: string, field: keyof VehicleForm, value: string) => {
    setVehicles(vehicles.map(v => 
      v._reactId === reactId ? { ...v, [field]: value } : v
    ));
  };

  const handleVehicleAddressChange = (reactId: string, field: 'start' | 'end', value: string) => {
    const fieldName = field === 'start' ? 'startAddress' : 'endAddress';
    handleVehicleFieldChange(reactId, fieldName, value);
    setActiveAddressField({ vehicleId: reactId, field });
    vehicleAutocomplete.debouncedFetch(value);
  };

  const handleVehicleFocus = (reactId: string, field: 'start' | 'end') => {
    setActiveAddressField({ vehicleId: reactId, field });
  };

  const handleSelectVehicleSuggestion = (suggestion: AddressSuggestion) => {
    if (!activeAddressField) return;

    const fieldName = activeAddressField.field === 'start' ? 'startAddress' : 'endAddress';
    handleVehicleFieldChange(activeAddressField.vehicleId, fieldName, suggestion.display_name);
    vehicleAutocomplete.clearSuggestions();
    setActiveAddressField(null);
  };

  // CSV Upload Handler
  const handleCSVUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);
    setError(null);
    setValidationErrors([]);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: (results) => {
        try {
          const deliveriesData: DeliveryForm[] = [];
          const vehiclesData: VehicleForm[] = [];
          const errors: string[] = [];

          results.data.forEach((row, rowIndex) => {
            const rowType = row.type?.toLowerCase();

            if (rowType === 'delivery') {
              const address = row.address?.trim() || '';
              const deliveryName = `Delivery ${deliveriesData.length + 1}`;
              
              if (address && hasAtLeastOneLetter(address)) {
                // Parse time window start (handle both seconds and time string)
                let timeWindowStart = '';
                if (row.time_window_start) {
                  const rawStart = String(row.time_window_start).trim();
                  // Check if it's a number (seconds from midnight)
                  if (/^\d+$/.test(rawStart)) {
                    const seconds = parseInt(rawStart);
                    timeWindowStart = secondsToTimeAMPM(seconds);
                  } else {
                    // Already in time format
                    timeWindowStart = rawStart;
                  }
                }
                
                // Parse time window end (handle both seconds and time string)
                let timeWindowEnd = '';
                if (row.time_window_end) {
                  const rawEnd = String(row.time_window_end).trim();
                  // Check if it's a number (seconds from midnight)
                  if (/^\d+$/.test(rawEnd)) {
                    const seconds = parseInt(rawEnd);
                    timeWindowEnd = secondsToTimeAMPM(seconds);
                  } else {
                    // Already in time format
                    timeWindowEnd = rawEnd;
                  }
                }
                
                deliveriesData.push({
                  _reactId: crypto.randomUUID(),
                  address: address,
                  bufferTime: row.buffer_time || '300',
                  demandValue: row.demand_value || '1',
                  timeWindowStart: timeWindowStart,
                  timeWindowEnd: timeWindowEnd,
                });
              } else {
                errors.push(`${deliveryName} (CSV row ${rowIndex + 2}): Address must contain at least one letter`);
              }
            } else if (rowType === 'vehicle') {
              const startAddress = row.start_address?.trim() || '';
              const endAddress = row.end_address?.trim() || '';
              const vehicleName = `Vehicle ${vehiclesData.length + 1}`;
              
              const validStartAddress = hasAtLeastOneLetter(startAddress) ? startAddress : '';
              const validEndAddress = hasAtLeastOneLetter(endAddress) ? endAddress : '';
              
              if (!validStartAddress) {
                errors.push(`${vehicleName} (CSV row ${rowIndex + 2}): Start address must contain at least one letter`);
              }
              if (!validEndAddress) {
                errors.push(`${vehicleName} (CSV row ${rowIndex + 2}): End address must contain at least one letter`);
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

          if (deliveriesData.length > 0) setDeliveries(deliveriesData);
          if (vehiclesData.length > 0) setVehicles(vehiclesData);
          if (errors.length > 0) setValidationErrors(errors);

          console.log(`Parsed ${deliveriesData.length} deliveries and ${vehiclesData.length} vehicles`);
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

  // Geocoding Handler
  const handleGeocode = async () => {
    setLoading(true);
    setError(null);
    setResults(null);
    setValidationErrors([]);

    try {
      // Validate
      const { valid: validDeliveries, errors: deliveryErrors } = validateDeliveries(deliveries);
      const { valid: validVehicles, errors: vehicleErrors } = validateVehicles(vehicles);
      
      const allErrors = [...deliveryErrors, ...vehicleErrors];

      if (allErrors.length > 0) {
        setValidationErrors(allErrors);
        setLoading(false);
        return;
      }

      if (validDeliveries.length === 0) {
        setError('Please enter at least one valid delivery address');
        setLoading(false);
        return;
      }

      if (validVehicles.length === 0) {
        setError('Please enter at least one valid vehicle with start and end addresses');
        setLoading(false);
        return;
      }

      // Convert to API format
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
        headers: { 'Content-Type': 'application/json' },
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

  // Click outside to close dropdowns - FIXED: Destructure specific values
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Check if click is outside delivery suggestions
      if (deliveryAutocomplete.showSuggestions) {
        const clickedInside = Array.from(document.querySelectorAll('[data-delivery-input]'))
          .some(el => el.contains(target));
        
        if (!clickedInside) {
          deliveryAutocomplete.clearSuggestions();
          setActiveDeliveryId(null);
        }
      }

      // Check if click is outside vehicle suggestions
      if (vehicleAutocomplete.showSuggestions) {
        const clickedInside = Array.from(document.querySelectorAll('[data-vehicle-input]'))
          .some(el => el.contains(target));
        
        if (!clickedInside) {
          vehicleAutocomplete.clearSuggestions();
          setActiveAddressField(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [
    deliveryAutocomplete.showSuggestions,
    deliveryAutocomplete.clearSuggestions,
    vehicleAutocomplete.showSuggestions,
    vehicleAutocomplete.clearSuggestions
  ]);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            Delivery Route Optimizer
          </h1>

          <CSVUploader
            onUpload={handleCSVUpload}
            fileName={csvFileName}
            deliveryCount={deliveries.length}
            vehicleCount={vehicles.length}
          />

          <div className="grid lg:grid-cols-2 gap-12">
            {/* Deliveries Section */}
            <div className="flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                  <span className="text-2xl mr-2">📦</span>
                  Deliveries
                </h2>
                <button
                  onClick={handleAddDelivery}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 flex items-center"
                >
                  <span className="mr-1">+</span> Add Delivery
                </button>
              </div>

              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {deliveries.map((delivery, index) => (
                  <div key={delivery._reactId} data-delivery-input>
                    <DeliveryFormComponent
                      delivery={delivery}
                      index={index}
                      canRemove={deliveries.length > 1}
                      onRemove={handleRemoveDelivery}
                      onFieldChange={handleDeliveryFieldChange}
                      onAddressChange={handleDeliveryAddressChange}
                      onFocus={handleDeliveryFocus}
                      onKeyDown={(e) => deliveryAutocomplete.handleKeyDown(e, handleSelectDeliverySuggestion)}
                      showSuggestions={deliveryAutocomplete.showSuggestions}
                      suggestions={deliveryAutocomplete.suggestions}
                      selectedIndex={deliveryAutocomplete.selectedIndex}
                      onSelectSuggestion={handleSelectDeliverySuggestion}
                      isActive={activeDeliveryId === delivery._reactId}
                    />
                  </div>
                ))}
              </div>

              <p className="mt-3 text-xs text-gray-500">
                💡 Type at least 3 characters to see address suggestions
              </p>
            </div>

            {/* Vehicles Section */}
            <div className="flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                  <span className="text-2xl mr-2">🚗</span>
                  Vehicles
                </h2>
                <button
                  onClick={handleAddVehicle}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 flex items-center"
                >
                  <span className="mr-1">+</span> Add Vehicle
                </button>
              </div>

              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {vehicles.map((vehicle, index) => (
                  <div key={vehicle._reactId} data-vehicle-input>
                    <VehicleFormComponent
                      vehicle={vehicle}
                      index={index}
                      canRemove={vehicles.length > 1}
                      onRemove={handleRemoveVehicle}
                      onFieldChange={handleVehicleFieldChange}
                      onAddressChange={handleVehicleAddressChange}
                      onFocus={handleVehicleFocus}
                      onKeyDown={(e) => vehicleAutocomplete.handleKeyDown(e, handleSelectVehicleSuggestion)}
                      showStartSuggestions={
                        vehicleAutocomplete.showSuggestions &&
                        activeAddressField?.vehicleId === vehicle._reactId &&
                        activeAddressField?.field === 'start'
                      }
                      showEndSuggestions={
                        vehicleAutocomplete.showSuggestions &&
                        activeAddressField?.vehicleId === vehicle._reactId &&
                        activeAddressField?.field === 'end'
                      }
                      suggestions={vehicleAutocomplete.suggestions}
                      selectedIndex={vehicleAutocomplete.selectedIndex}
                      onSelectSuggestion={handleSelectVehicleSuggestion}
                    />
                  </div>
                ))}
              </div>

              <p className="mt-3 text-xs text-gray-500">
                💡 Type at least 3 characters to see address suggestions
              </p>
            </div>
          </div>

          <ValidationErrors errors={validationErrors} />

          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          <button
            onClick={handleGeocode}
            disabled={loading || deliveries.every(d => !d.address.trim()) || vehicles.every(v => !v.startAddress.trim())}
            className="w-full mt-6 bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium text-lg"
          >
            {loading ? 'Processing...' : '🚀 Generate Optimized Routes'}
          </button>

          {results && <ResultsDisplay results={results} onDownload={downloadJSON} />}
        </div>
      </div>
    </div>
  );
}