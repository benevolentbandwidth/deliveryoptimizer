"use client";

/**
 * Addresses region: toolbar (find / add) and a stacked list of delivery cards for the current page.
 */

import AddressCard from "./AddressCard";
import type { AddressCard as AddressCardType } from "../types/delivery";
import {
  ADDRESS_ADD_PILL_DESKTOP_DISABLED,
  ADDRESS_ADD_PILL_DESKTOP_ENABLED,
  ADDRESS_ADD_PILL_MOBILE_DISABLED,
  ADDRESS_ADD_PILL_MOBILE_ENABLED,
  ADDRESS_FIND_PILL_DESKTOP,
  ADDRESS_FIND_PILL_MOBILE,
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
  addressTouched: boolean;
  allAddressesLocked: boolean;
  activeAddressIsValid: boolean;
};

export default function AddressSection({
  addressesOnCurrentPage,
  addressesCount,
  addAddress,
  updateAddress,
  deleteAddress,
  unlockAddress,
  confirmAddress,
  addressTouched,
  allAddressesLocked,
  activeAddressIsValid,
}: AddressSectionProps) {
  const addEnabled = allAddressesLocked || activeAddressIsValid;

  return (
    <section>
      <h2 className={ADDRESS_SECTION_TITLE}>Addresses</h2>

      {/* Mobile: Add first, then find full-width pills */}
      <div className={ADDRESS_TOOLBAR_MOBILE_WRAP}>
        <button
          type="button"
          onClick={addAddress}
          className={addEnabled ? ADDRESS_ADD_PILL_MOBILE_ENABLED : ADDRESS_ADD_PILL_MOBILE_DISABLED}
        >
          Add new address
        </button>
        <button type="button" className={ADDRESS_FIND_PILL_MOBILE}>
          Find address
        </button>
      </div>

      {/* Desktop: Find left, spacer, Add right type scales with viewport */}
      <div className={ADDRESS_TOOLBAR_DESKTOP}>
        <button type="button" className={ADDRESS_FIND_PILL_DESKTOP}>
          Find address
        </button>
        <div className="flex-1 min-w-0" />
        <button
          type="button"
          onClick={addAddress}
          className={addEnabled ? ADDRESS_ADD_PILL_DESKTOP_ENABLED : ADDRESS_ADD_PILL_DESKTOP_DISABLED}
        >
          Add new address
        </button>
      </div>

      {/* Mobile: spaced cards; desktop: single divided panel */}
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
            addressTouched={addressTouched}
          />
        ))}
      </div>
    </section>
  );
}
