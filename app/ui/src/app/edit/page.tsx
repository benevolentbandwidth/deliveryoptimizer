"use client";

/**
 * Delivery edit screen: wires vehicle and address state into sections and pagination.
 */

import Navbar from "./components/Navbar";
import VehicleSection from "./components/VehicleSection";
import AddressSection from "./components/AddressSection";
import AddressPagination from "./components/AddressPagination";
import { useVehicles } from "./hooks/useVehicles";
import { useAddresses } from "./hooks/useAddresses";
import { useOptimize } from "./hooks/useOptimize";

export default function Page() {
  // Local UI state for vehicles and addresses (no persistence in this page yet).
  const vehicleState = useVehicles();
  const addressState = useAddresses();
  const { optimize, isOptimizing, optimizeError, clearOptimizeError } = useOptimize(
    vehicleState.vehicles,
    addressState.addresses
  );

  return (
    <div className="min-h-screen bg-white font-sans-manrope">
      <Navbar
        onOptimize={optimize}
        isOptimizing={isOptimizing}
        optimizeError={optimizeError}
        onClearOptimizeError={clearOptimizeError}
      />

      <main className="px-4 sm:px-6 md:px-8 py-6 md:py-8 space-y-8 md:space-y-10 max-w-[1480px] mx-auto">
        <VehicleSection {...vehicleState} />
        <AddressSection {...addressState} />
        <AddressPagination {...addressState} />
      </main>
    </div>
  );
}
