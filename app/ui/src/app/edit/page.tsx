// app/edit/page.tsx
"use client";

/**
 * Delivery edit screen: wires vehicle and address state into sections and pagination.
 */

import Navbar from "./components/Navbar";
import OptimizingModal from "./components/OptimizingModal";
import VehicleSection from "./components/VehicleSection";
import AddressSection from "./components/AddressSection";
import AddressPagination from "./components/AddressPagination";
import { useVehicles } from "./hooks/useVehicles";
import { useAddresses } from "./hooks/useAddresses";
import { useOptimize } from "./hooks/useOptimize";
import { useCSVUpload } from "./hooks/useCSVUpload";

export default function Page() {
  const vehicleState = useVehicles();
  const addressState = useAddresses();
  const {
    optimize,
    isOptimizing,
    optimizeError,
    clearOptimizeError,
    geocodeFailedAddressIds,
    geocodeFailedVehicleIds,
    outOfRegionAddressIds,
    outOfRegionVehicleIds,
  } = useOptimize(vehicleState.vehicles, addressState.addresses);

  const { handleCSVUpload, csvError, clearCsvError } = useCSVUpload({
    importAddresses: addressState.importAddresses,
  });

  return (
    <div className="min-h-screen bg-white font-sans-manrope">
      <OptimizingModal isOpen={isOptimizing} />
      <Navbar
        onOptimize={optimize}
        isOptimizing={isOptimizing}
        error={optimizeError ?? csvError}
        onClearError={() => { clearOptimizeError(); clearCsvError(); }}
      />
      <main className="px-4 sm:px-6 md:px-8 py-6 md:py-8 space-y-8 md:space-y-10 max-w-[1480px] mx-auto">
        <VehicleSection {...vehicleState} geocodeFailedVehicleIds={geocodeFailedVehicleIds} outOfRegionVehicleIds={outOfRegionVehicleIds} />
        <AddressSection {...addressState} geocodeFailedIds={geocodeFailedAddressIds} outOfRegionIds={outOfRegionAddressIds} onCSVUpload={handleCSVUpload} />
        <AddressPagination {...addressState} />
      </main>
    </div>
  );
}
