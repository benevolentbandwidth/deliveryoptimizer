// Sidebar component that takes routes as a prop and renders each route's driver name and its stope in sequence order (including address)
// If no routes, it shows a message saying "no routes yet"

import type { Route } from "../types";

type SidebarProps = {
  routes: Route[]; // Declaring SidebarProp has a routes prop that is an array of Route objects
};

export default function Sidebar({ routes }: SidebarProps) { // Defining Sidebar component receiving routes as a prop
  return (
    <aside className="w-full border-r border-zinc-200 bg-white p-4"> {/* w-full so sidebar fills its container, the page wrapper owns the width (w-72 when open) */}
      <h2 className="text-lg font-semibold text-zinc-800">Route list</h2>
      {routes.length === 0 ? ( 
        <p className="mt-2 text-sm text-zinc-500">No routes yet</p> // If no routes, show message saying "no routes yet"
      ) : ( 
        <ul className="mt-3 space-y-2"> {/* Rendering the list when there are routes */}
          {routes.map((route) => ( // Iterating over each route in the routes array
            <li key={route.vehicleId} className="text-sm"> 
              <span className="font-medium text-zinc-800">{route.driverName}</span> {/* Route/driver name: dark so it reads as a heading */}
              <ul className="ml-2 mt-1 space-y-1 text-zinc-600">
                {[...route.stops] // Before each time Sidebar renders the array is sorted in place, mutating the original, so we make a copy leaving route.stops unchanged (similar to Map.tsx)
                  .sort((a, b) => a.sequence - b.sequence) // Sorting the stops by sequence number
                  .map((stop) => (
                    <li key={stop.id}>
                      {stop.sequence}. {stop.address} {/* Showing stop sequence number and address */}
                    </li>
                  ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
