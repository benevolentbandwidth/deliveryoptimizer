"use client";

/**
 * Previous/next + numbered pages for the paged address list (state lives in useAddresses).
 */

import {
  PAGINATION_ICON_BUTTON,
  PAGINATION_PAGE_ACTIVE,
  PAGINATION_PAGE_IDLE,
  PAGINATION_ROW,
} from "../formStyles";

type AddressPaginationProps = {
  addressPage: number;
  setAddressPage: (page: number) => void;
  totalAddressPages: number;
};

export default function AddressPagination({
  addressPage,
  setAddressPage,
  totalAddressPages,
}: AddressPaginationProps) {
  return (
    <div className={PAGINATION_ROW}>
      {/* Step backward one page when not on the first page */}
      <button
        type="button"
        onClick={() => addressPage > 1 && setAddressPage(addressPage - 1)}
        className={PAGINATION_ICON_BUTTON}
      >
        <svg width="6" height="14" viewBox="0 0 6 14" fill="none">
          <path d="M5 1L1 7L5 13" stroke="black" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
      {/* Direct jump to any page in range */}
      <div className="flex items-center gap-6">
        {Array.from({ length: totalAddressPages }, (_, i) => i + 1).map((pageNum) => (
          <button
            key={pageNum}
            type="button"
            onClick={() => setAddressPage(pageNum)}
            className={addressPage === pageNum ? PAGINATION_PAGE_ACTIVE : PAGINATION_PAGE_IDLE}
          >
            {pageNum}
          </button>
        ))}
      </div>
      {/* Step forward when not on the last page */}
      <button
        type="button"
        onClick={() => addressPage < totalAddressPages && setAddressPage(addressPage + 1)}
        className={PAGINATION_ICON_BUTTON}
      >
        <svg width="6" height="14" viewBox="0 0 6 14" fill="none">
          <path d="M1 1L5 7L1 13" stroke="black" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}
