"use client";

/**
 * Addresses region: toolbar (find / add / import) and a stacked list of delivery cards for the current page.
 */

import { useRef } from "react";
import AddressCard from "./AddressCard";
import type { AddressCard as AddressCardType } from "../types/delivery";
import {
  ADDRESS_ADD_PILL_DESKTOP_DISABLED,
  ADDRESS_ADD_PILL_DESKTOP_ENABLED,
  ADDRESS_ADD_PILL_MOBILE_DISABLED,
  ADDRESS_ADD_PILL_MOBILE_ENABLED,
  ADDRESS_SEARCH_INPUT_DESKTOP,
  ADDRESS_SEARCH_INPUT_MOBILE,
  ADDRESS_EMPTY_STATE,
  ADDRESS_LIST_WRAP,
  ADDRESS_SECTION_TITLE,
  ADDRESS_TOOLBAR_DESKTOP,
  ADDRESS_TOOLBAR_MOBILE_WRAP,
} from "../formStyles";

type AddressSectionProps = {
  addressesOnCurrentPage: AddressCardType[];
  addressesCount: number;
  addAddress: () => void;
  updateAddress: <K extends keyof AddressCardType>(id: number, key: K, value: AddressCardType[K]) => void;
  deleteAddress: (id: number) => void;
  unlockAddress: (id: number) => void;
  confirmAddress: (id: number) => void;
  touchedIds: Set<number>;
  allAddressesLocked: boolean;
  activeAddressIsValid: boolean;
  geocodeFailedIds: number[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  outOfRegionIds: number[];
  onCSVUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

export default function AddressSection({
  addressesOnCurrentPage,
  addressesCount,
  addAddress,
  updateAddress,
  deleteAddress,
  unlockAddress,
  confirmAddress,
  touchedIds,
  allAddressesLocked,
  activeAddressIsValid,
  geocodeFailedIds,
  searchQuery,
  setSearchQuery,
  outOfRegionIds,
  onCSVUpload,
}: AddressSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addEnabled = allAddressesLocked || activeAddressIsValid;

  return (
    <section>
      <h2 className={ADDRESS_SECTION_TITLE}>Addresses</h2>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => {
          onCSVUpload(e);
          e.target.value = "";
        }}
        className="hidden"
        aria-hidden
      />

      {/* Mobile: Add first, then Import, then search full-width */}
      <div className={ADDRESS_TOOLBAR_MOBILE_WRAP}>
        <button
          type="button"
          disabled={!addEnabled}
          onClick={addAddress}
          className={addEnabled ? ADDRESS_ADD_PILL_MOBILE_ENABLED : ADDRESS_ADD_PILL_MOBILE_DISABLED}
        >
          Add new address
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={ADDRESS_ADD_PILL_MOBILE_ENABLED}
        >
          Import
        </button>
        <input
          type="search"
          value={searchQuery}
          aria-label="Search addresses"
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Find address"
          className={ADDRESS_SEARCH_INPUT_MOBILE}
        />
      </div>

      {/* Desktop: Search left, spacer, Add right */}
      <div className={ADDRESS_TOOLBAR_DESKTOP}>
        <input
          type="search"
          value={searchQuery}
          aria-label="Search addresses"
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Find address"
          className={ADDRESS_SEARCH_INPUT_DESKTOP}
        />
        <div className="flex-1 min-w-0" />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={ADDRESS_ADD_PILL_DESKTOP_ENABLED}
        >
          Import
        </button>
        <button
          type="button"
          disabled={!addEnabled}
          onClick={addAddress}
          className={addEnabled ? ADDRESS_ADD_PILL_DESKTOP_ENABLED : ADDRESS_ADD_PILL_DESKTOP_DISABLED}
        >
          Add new address
        </button>
      </div>

      {/* Mobile: spaced cards; desktop: single divided panel */}
      {searchQuery.trim() !== "" && addressesOnCurrentPage.length === 0 ? (
        <div className={ADDRESS_EMPTY_STATE}>
          No Addresses Found
        </div>
      ) : (
        <div className={ADDRESS_LIST_WRAP}>
          {addressesOnCurrentPage.map((a) => (
            <AddressCard
              key={`address-${a.id}`}
              address={a}
              addressesCount={addressesCount}
              updateAddress={updateAddress}
              deleteAddress={deleteAddress}
              unlockAddress={unlockAddress}
              confirmAddress={confirmAddress}
              addressTouched={touchedIds.has(a.id)}
              geocodeFailed={geocodeFailedIds.includes(a.id)}
              outOfRegionFailed={outOfRegionIds.includes(a.id)}
          />
          ))}
        </div>
      )}
    </section>
  );
}
