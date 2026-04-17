// app/components/AddressGeocoder/index.tsx
'use client';
import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Papa from 'papaparse';
import type { OptimizedResponse } from '@/app/types/geocoding';
import { DeliveryFormComponent } from './DeliveryForm';
import { VehicleFormComponent } from './VehicleForm';
import { CSVUploader } from './CSVUploader';
import { ResultsDisplay } from './ResultsDisplay';
import { ValidationErrors } from './ValidationErrors';
import { useAddressAutocomplete } from './utils/useAddressAutocomplete';
import { useGeocodingValidation } from './utils/validateGeocodingForms';
import { timeToSeconds, secondsToTimeAMPM } from './utils/timeConversion';
import { geocodeAddress } from './utils/nominatim';
import { hasAtLeastOneLetter, generateDeliveryDefaults, generateVehicleDefaults } from './utils';
import type { DeliveryForm, VehicleForm, AddressSuggestion, ActiveAddressField } from './types';

export default function AddressGeocoder() {
  // State: Deliveries
  const [deliveries, setDeliveries] = useState<DeliveryForm[]>([
    { _reactId: uuidv4(), ...generateDeliveryDefaults() }
  ]);
  const [activeDeliveryId, setActiveDeliveryId] = useState<string | null>(null);

  // State: Vehicles
  const [vehicles, setVehicles] = useState<VehicleForm[]>([
    { _reactId: uuidv4(), ...generateVehicleDefaults(0) }
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
      _reactId: uuidv4(),
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
      _reactId: uuidv4(),
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
                let timeWindowStart = '';
                if (row.time_window_start) {
                  const rawStart = String(row.time_window_start).trim();
                  if (/^\d+$/.test(rawStart)) {
                    timeWindowStart = secondsToTimeAMPM(parseInt(rawStart));
                  } else {
                    timeWindowStart = rawStart;
                  }
                }

                let timeWindowEnd = '';
                if (row.time_window_end) {
                  const rawEnd = String(row.time_window_end).trim();
                  if (/^\d+$/.test(rawEnd)) {
                    timeWindowEnd = secondsToTimeAMPM(parseInt(rawEnd));
                  } else {
                    timeWindowEnd = rawEnd;
                  }
                }

                deliveriesData.push({
                  _reactId: uuidv4(),
                  address,
                  bufferTime: row.buffer_time || '300',
                  demandValue: row.demand_value || '1',
                  timeWindowStart,
                  timeWindowEnd,
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
                _reactId: uuidv4(),
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

      // Geocode all addresses client-side through the shared nominatim utility.
      // This guarantees the 1 req/s clock is shared with autocomplete — no
      // separate server module that could race and trigger 429s.
      const failedAddresses: Array<{ entryId: string; address: string; field: string }> = [];

      const geocodedDeliveries = await Promise.all(
        validDeliveries.map(async (d, index) => {
          const entryId = `delivery_${index + 1}`;
          const location = await geocodeAddress(d.address);
          if (!location) failedAddresses.push({ entryId, address: d.address, field: 'address' });

          const startSeconds = d.timeWindowStart && d.timeWindowStart.trim().length > 0
            ? timeToSeconds(d.timeWindowStart)
            : undefined;
          const endSeconds = d.timeWindowEnd && d.timeWindowEnd.trim().length > 0
            ? timeToSeconds(d.timeWindowEnd)
            : undefined;

          const timeWindows: number[][] = [];
          if (startSeconds !== undefined && endSeconds !== undefined) {
            timeWindows.push([startSeconds, endSeconds]);
          }

          return {
            id: entryId,
            address: d.address,
            location: location!,
            bufferTime: parseInt(d.bufferTime) || 300,
            demand: { type: 'units', value: parseInt(d.demandValue) || 1 },
            timeWindows,
          };
        })
      );

      const geocodedVehicles = await Promise.all(
        validVehicles.map(async (v) => {
          const startLocation = await geocodeAddress(v.startAddress);
          const endLocation = await geocodeAddress(v.endAddress);
          if (!startLocation) failedAddresses.push({ entryId: v.id, address: v.startAddress, field: 'startAddress' });
          if (!endLocation) failedAddresses.push({ entryId: v.id, address: v.endAddress, field: 'endAddress' });

          return {
            id: v.id,
            vehicleType: v.vehicleType,
            startLocation: startLocation!,
            endLocation: endLocation!,
            capacity: { type: 'units', value: parseInt(v.capacity) || 100 },
          };
        })
      );

      if (failedAddresses.length > 0) {
        const list = failedAddresses.map(f => `${f.entryId} (${f.address})`).join(', ');
        throw new Error(`Geocoding failed for ${failedAddresses.length} address(es): ${list}. Please correct them and try again.`);
      }

      const data: OptimizedResponse = {
        vehicles: geocodedVehicles,
        deliveries: geocodedDeliveries,
        metadata: {
          generatedAt: new Date().toISOString(),
          totalDeliveries: geocodedDeliveries.length,
          totalVehicles: geocodedVehicles.length,
          successfulGeocoding: geocodedDeliveries.length + geocodedVehicles.length,
          failedGeocoding: 0,
        },
      };
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

  // Click outside to close dropdowns
  // Extract individual values so the linter sees stable primitive/function
  // references in the dep array — using whole hook objects would cause
  // the effect to re-run on every render (objects are new refs each time).
  const deliveryShowSuggestions = deliveryAutocomplete.showSuggestions;
  const deliveryClearSuggestions = deliveryAutocomplete.clearSuggestions;
  const vehicleShowSuggestions = vehicleAutocomplete.showSuggestions;
  const vehicleClearSuggestions = vehicleAutocomplete.clearSuggestions;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (deliveryShowSuggestions) {
        const clickedInside = Array.from(document.querySelectorAll('[data-delivery-input]'))
          .some(el => el.contains(target));
        if (!clickedInside) {
          deliveryClearSuggestions();
          setActiveDeliveryId(null);
        }
      }

      if (vehicleShowSuggestions) {
        const clickedInside = Array.from(document.querySelectorAll('[data-vehicle-input]'))
          .some(el => el.contains(target));
        if (!clickedInside) {
          vehicleClearSuggestions();
          setActiveAddressField(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [
    deliveryShowSuggestions,
    deliveryClearSuggestions,
    vehicleShowSuggestions,
    vehicleClearSuggestions,
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