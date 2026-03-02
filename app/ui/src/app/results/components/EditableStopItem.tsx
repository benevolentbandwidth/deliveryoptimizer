 // A component that displays a single stop row in the route card showing the stop number, address, and notes, the stop's note
 // If the note is in read only mode, it displays as a static text, otherwise it provides a text area and save button
 "use client";
 
 import { useEffect, useState } from "react";
 import type { Stop } from "../types";
 
 type EditableStopItemProps = {
   stop: Stop;
   isEditMode: boolean;
   onSaveNote: (note: string) => void;
 };
 
 // Declaring the component with props (the stop data, whether we're in edit mode, and function to call when user saves)
 export default function EditableStopItem({ stop, isEditMode, onSaveNote }: EditableStopItemProps) { 
   const [draft, setDraft] = useState(stop.note ?? ""); // draft represents the current note text in the text area, starts as the stop's note or empty string if no note
 
   useEffect(() => {
     setDraft(stop.note ?? ""); // When the stop's note changes (e.g parents updates it), we update the draft state to match the new note
   }, [stop.note]);
 
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3"> {/* Outer container for the stop row (rounded border with white background) */}
      <div className="text-xs font-medium text-zinc-800"> {/* Inner container showing the stop's sequence number and address */}
        {stop.sequence}. {stop.address}
      </div>
      <div className="mt-1.5 space-y-0.5 text-xs text-zinc-600">
        <div><span className="font-medium text-zinc-700">Name of addressed to:</span> {stop.addresseeName ?? "—"}</div> {/* Displaying the name of the person addressed to */}
        <div><span className="font-medium text-zinc-700">Est time of arrival:</span> {stop.timeWindow?.time ?? "—"}</div> {/* Displaying the estimated time of arrival */}
        <div><span className="font-medium text-zinc-700">Packages:</span> {stop.capacityUsed ?? "—"}</div> {/* Displaying the number of packages */}
      </div>

       {/* Deciding what to show for the note depending on which mode we're in (read only or edit) */}
       {!isEditMode ? ( // If we're in read only mode, we show the note that's stored or a message if no notes
         <div className="mt-2 text-xs text-zinc-600">
           <span className="font-medium text-zinc-700">Notes:</span>{" "}
           {stop.note?.trim() ? stop.note : <span className="text-zinc-400">No notes</span>}
         </div>
       ) : ( // If we're in edit mode, we show the text area and save button
         <div className="mt-2">
           <label className="block text-xs font-medium text-zinc-700">Notes</label>
           <textarea // the box where the user can type in
             value={draft} // shows the current note text in the text area
             onChange={(e) => setDraft(e.target.value)} // every time the user types or deletes a character, onChange is ran and calls setDraft to update the draft state (here setDraft is only updating the local "working" note and this lives only in the component and isn't saved anywhere until they click save)
             rows={3}
             className="mt-1 w-full resize-none rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
             placeholder="Driver notes (e.g., Gate code is 1234)"
           />
           <div className="mt-2 flex justify-end">
             <button
               type="button"
               onClick={() => onSaveNote(draft)} // when the user clicks save, we call onSaveNote and send the current text up. Sidebar just passes that callback through. The page is the one that runs updateStopNote and updates the note in routes. Then the updated stop comes back down as stop.note, and useEffect runs setDraft so our draft matches what was saved
               className="inline-flex items-center rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-500"
             >
               Save
             </button>
           </div>
         </div>
       )}
     </div>
   );
 }
 
