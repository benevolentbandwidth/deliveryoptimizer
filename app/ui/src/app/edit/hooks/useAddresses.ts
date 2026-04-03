/**
 * Address list state: paged stops, lock/edit workflow, and validation for "add next".
 */

import { useState, useCallback } from "react";
import type { AddressCard } from "../types/delivery";

const ADDRESSES_PER_PAGE = 7;

export function useAddresses() {
  // Seed with one editable row; IDs are monotonic as rows are added.
  const [addresses, setAddresses] = useState<AddressCard[]>([
    {
      id: 1,
      locked: false,
      editingExisting: false,
      recipientAddress: "",
      timeBuffer: "",
      deliveryTimeMode: "by",
      deliveryBy: "",
      deliveryBetween: "",
      deliveryQuantity: 0,
      notes: "",
    },
  ]);

  // Pagination: slice the flat list so the UI only renders one page of cards.
  const [addressPage, setAddressPage] = useState(1);
  const totalAddressPages = Math.max(1, Math.ceil(addresses.length / ADDRESSES_PER_PAGE));
  const addressesOnCurrentPage = addresses.slice(
    (addressPage - 1) * ADDRESSES_PER_PAGE,
    addressPage * ADDRESSES_PER_PAGE
  );

  // After submit attempts, drive inline error styling until the user fixes fields.
  const [addressTouched, setAddressTouched] = useState(false);

  // The single unlocked row must be complete before another "Add" is allowed.
  const activeAddress = addresses.find((a) => !a.locked);
  const activeAddressIsValid =
    !!activeAddress &&
    activeAddress.recipientAddress.trim() !== "" &&
    activeAddress.deliveryQuantity > 0;

  const allAddressesLocked = addresses.length > 0 && addresses.every((a) => a.locked);

  // Merge one field into the matching address by id.
  const updateAddress = useCallback(<K extends keyof AddressCard>(
    id: number,
    key: K,
    value: AddressCard[K]
  ) => {
    setAddresses((prev) =>
      prev.map((a) => (a.id === id ? { ...a, [key]: value } : a))
    );
  }, []);

  // Lock any in-progress row, append a new empty row, and jump to its page.
  // All logic runs inside the functional updater so IDs and page are always
  // computed from the latest state and the callback never needs to be recreated.
  const addAddress = useCallback(() => {
    setAddresses((prev) => {
      const active = prev.find((a) => !a.locked);
      const allLocked = prev.length > 0 && prev.every((a) => a.locked);
      const isValid =
        !!active &&
        active.recipientAddress.trim() !== "" &&
        active.deliveryQuantity > 0;

      if (!allLocked && !isValid) {
        setAddressTouched(true);
        return prev;
      }

      setAddressTouched(false);
      const newId = prev.reduce((max, a) => Math.max(max, a.id), 0) + 1;
      setAddressPage(Math.ceil((prev.length + 1) / ADDRESSES_PER_PAGE));

      return [
        ...prev.map((a) => (a.locked ? a : { ...a, locked: true, editingExisting: false })),
        {
          id: newId,
          locked: false,
          editingExisting: false,
          recipientAddress: "",
          timeBuffer: "",
          deliveryTimeMode: "by",
          deliveryBy: "",
          deliveryBetween: "",
          deliveryQuantity: 0,
          notes: "",
        },
      ];
    });
  }, []);

  // At least one address row must remain. Clamp current page synchronously so
  // there is no extra render from a useEffect.
  const deleteAddress = useCallback((id: number) => {
    setAddresses((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((a) => a.id !== id);
      const maxPage = Math.max(1, Math.ceil(next.length / ADDRESSES_PER_PAGE));
      setAddressPage((p) => Math.min(p, maxPage));
      return next;
    });
  }, []);

  // Re-open a saved row for editing (shows Confirm in the card).
  const unlockAddress = useCallback((id: number) => {
    setAddresses((prev) =>
      prev.map((a) => (a.id === id ? { ...a, locked: false, editingExisting: true } : a))
    );
  }, []);

  // Validate required fields, then lock the row back to read-only gray cells.
  const confirmAddress = useCallback((id: number) => {
    setAddresses((prev) => {
      const a = prev.find((x) => x.id === id);
      if (!a) return prev;
      const valid =
        a.recipientAddress.trim() !== "" &&
        a.deliveryQuantity > 0;
      if (!valid) {
        setAddressTouched(true);
        return prev;
      }
      setAddressTouched(false);
      return prev.map((x) => (x.id === id ? { ...x, locked: true, editingExisting: false } : x));
    });
  }, []);

  // Public API for the address section + pagination.
  return {
    addresses,
    updateAddress,
    addAddress,
    deleteAddress,
    unlockAddress,
    confirmAddress,
    addressTouched,
    addressPage,
    setAddressPage,
    totalAddressPages,
    addressesOnCurrentPage,
    addressesCount: addresses.length,
    activeAddressIsValid,
    allAddressesLocked,
  };
}
