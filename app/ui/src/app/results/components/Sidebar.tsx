// Sidebar component that takes routes as a prop and renders each route's driver name and its stope in sequence order (including address)
// If no routes, it shows a message saying "no routes yet"

import type { Route } from "../types";

type SidebarProps = {
  routes: Route[]; // Declaring SidebarProp receives routes prop that is an array of Route objects
  isEditMode: boolean; // Declaring SidebarProp receives a isEditMode prop that is a boolean
  onEditModeChange: (value: boolean) => void; // Declaring SidebarProp receives an onEditModeChange prop that is a function that's called to update the edit mode state (true/false) when user clicks the edit mode toggle button
};

export default function Sidebar({ routes, isEditMode, onEditModeChange }: SidebarProps) { // Sidebar component receiving routes, edit mode state, and onEditModeChange from when <Sidebar> is rendered in page.tsx
  return (
    <aside
      className={`w-72 shrink-0 border-r-2 bg-white p-4 ${isEditMode ? "border-amber-500" : "border-zinc-200"}`} // Sidebar container with width 288px, fixed width and doesn't shrink, white background, and padding. If edit mode is true, border color is amber, otherwise it's zinc
    >
      {isEditMode && ( // If edit mode is true, show the message saying "Edit Mode On"
        <p className="mb-2 text-xs font-medium text-amber-700 bg-amber-50 rounded px-2 py-1">Edit Mode Active</p> 
      )}
      <div className="flex items-center justify-between gap-2 mb-4"> {/* Placing the text "Edit mode" and the switch on the same row, text is left and switch is right */}
        <span className="text-sm font-medium text-zinc-700">Edit mode</span>
        <button 
          type="button" 
          role="switch" // The button is a switch that can be toggled on and off
          aria-checked={isEditMode} // Telling whether the switch is on or off
          onClick={() => onEditModeChange(!isEditMode)} // When use clicks the button, call onEditModeChange with the opposite of the current edit mode state (true -> false or false -> true)
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-500 ${isEditMode ? "border-amber-500 bg-amber-500" : "border-zinc-200 bg-zinc-100"}`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${isEditMode ? "translate-x-5" : "translate-x-0.5"}`}
          />
        </button>
      </div>
      <h2 className="text-lg font-semibold text-zinc-800">Route list</h2>
      {routes.length === 0 ? ( 
        <p className="mt-2 text-sm text-zinc-500">No routes yet</p> // If no routes, show message saying "no routes yet"
      ) : ( 
        <ul className="mt-3 space-y-2"> {/* Rendering the list when there are routes */}
          {routes.map((route) => ( // Iterating over each route in the routes array
            <li key={route.vehicleId} className="text-sm"> 
              <span className="font-medium text-zinc-800">{route.driverName}</span> {/* Route/driver name: dark so it reads as a heading */}
              <ul className="ml-2 mt-1 space-y-1 text-zinc-600">
                {route.stops // Using the stops of the current route
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
