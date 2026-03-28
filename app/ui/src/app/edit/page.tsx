"use client";

/**
 * Delivery edit screen: wires vehicle state into the vehicle section.
 */

import Navbar from "./components/Navbar";
import VehicleSection from "./components/VehicleSection";
import { useVehicles } from "./hooks/useVehicles";

export default function Page() {
  const vehicleState = useVehicles();

  return (
    <div className="min-h-screen bg-white font-sans-manrope">
      <Navbar />

      <main className="px-4 sm:px-6 md:px-8 py-6 md:py-8 space-y-8 md:space-y-10 max-w-[1480px] mx-auto">
        <VehicleSection {...vehicleState} />
      </main>
    </div>
  );
}
