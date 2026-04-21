/**
 * Address list state: paged stops, lock/edit workflow, and validation for "add next".
 */

import { useState, useCallback, useMemo } from "react";
import type { AddressCard } from "../types/delivery";
import Fuse from "fuse.js";

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
      deliveryTimeStart: "",
      deliveryTimeEnd: "",
      deliveryQuantity: 0,
      notes: "",
    },
  ]);

  // Search: fuzzy filter across address and notes fields.
  const [searchQuery, _setSearchQuery] = useState("");

  // Fuse.js is a fuzzy search library that allows us to search for addresses and notes.
  const fuse = useMemo(() => new Fuse(addresses, {
    keys: ["recipientAddress", "notes"],
    threshold: 0.3,         // 0.0 = exact, 1.0 = match anything
    ignoreLocation: true,   // don't penalize matches far from string start
  }), [addresses]);

  const filteredAddresses = useMemo(
    () =>
      searchQuery.trim() === ""
        ? addresses
        : fuse.search(searchQuery).map((result) => result.item),
    [addresses, fuse, searchQuery]
  );

  const isSearchActive = searchQuery.trim() !== "";

  // Pagination: slice the flat list so the UI only renders one page of cards.
  const [addressPage, setAddressPage] = useState(1);
  const totalAddressPages = Math.max(1, Math.ceil(filteredAddresses.length / ADDRESSES_PER_PAGE));
  const addressesOnCurrentPage = filteredAddresses.slice(
    (addressPage - 1) * ADDRESSES_PER_PAGE,
    addressPage * ADDRESSES_PER_PAGE
  );

  const setSearchQuery = useCallback((q: string) => {
    _setSearchQuery(q);
    setAddressPage(1);
  }, []);

  // Set of address IDs whose fields should show validation errors.
  const [touchedIds, setTouchedIds] = useState<Set<number>>(new Set());

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
        if (active) setTouchedIds((t) => new Set([...t, active.id]));
        return prev;
      }

      setTouchedIds(new Set());
      _setSearchQuery("");
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
          deliveryTimeStart: "",
          deliveryTimeEnd: "",
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
    setTouchedIds((t) => {
      const next = new Set(t);
      next.delete(id);
      return next;
    });
  }, []);

  // Re-open a saved row for editing (shows Confirm in the card).
  const unlockAddress = useCallback((id: number) => {
    setAddresses((prev) =>
      prev.map((a) => (a.id === id ? { ...a, locked: false, editingExisting: true } : a))
    );
    setTouchedIds((t) => {
      const next = new Set(t);
      next.delete(id);
      return next;
    });
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
        setTouchedIds((t) => new Set([...t, id]));
        return prev;
      }
      setTouchedIds((t) => {
        const next = new Set(t);
        next.delete(id);
        return next;
      });
      return prev.map((x) => (x.id === id ? { ...x, locked: true, editingExisting: false } : x));
    });
  }, []);

  const importAddresses = useCallback((incoming: AddressCard[]) => {
    if (incoming.length === 0) return;
    setAddresses(incoming);
    setAddressPage(1);
    setTouchedIds(new Set());
    _setSearchQuery("");
  }, []);
  return {
    addresses,
    updateAddress,
    addAddress,
    deleteAddress,
    unlockAddress,
    confirmAddress,
    importAddresses,
    touchedIds,
    addressPage,
    setAddressPage,
    totalAddressPages,
    addressesOnCurrentPage,
    addressesCount: addresses.length,
    activeAddressIsValid,
    allAddressesLocked,
    searchQuery,
    setSearchQuery,
    isSearchActive,
  };
}
