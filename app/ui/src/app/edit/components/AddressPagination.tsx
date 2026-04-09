"use client";

/**
 * Previous/next + numbered pages for the paged address list (state lives in useAddresses).
 */

import {
  PAGINATION_ICON_BUTTON,
  PAGINATION_ICON_BUTTON_DISABLED,
  PAGINATION_ICON_COLOR,
  PAGINATION_ICON_DISABLED_COLOR,
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
  const isFirst = addressPage <= 1;
  const isLast = addressPage >= totalAddressPages;

  return (
    <div className={PAGINATION_ROW}>
      {/* Step backward one page when not on the first page */}
      <button
        type="button"
        disabled={isFirst}
        onClick={() => setAddressPage(addressPage - 1)}
        className={isFirst ? PAGINATION_ICON_BUTTON_DISABLED : PAGINATION_ICON_BUTTON}
      >
        <svg width="6" height="14" viewBox="0 0 6 14" fill="none">
          <path d="M5 1L1 7L5 13" stroke={isFirst ? PAGINATION_ICON_DISABLED_COLOR : PAGINATION_ICON_COLOR} strokeWidth="1.5" strokeLinecap="round"/>
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
        disabled={isLast}
        onClick={() => setAddressPage(addressPage + 1)}
        className={isLast ? PAGINATION_ICON_BUTTON_DISABLED : PAGINATION_ICON_BUTTON}
      >
        <svg width="6" height="14" viewBox="0 0 6 14" fill="none">
          <path d="M1 1L5 7L1 13" stroke={isLast ? PAGINATION_ICON_DISABLED_COLOR : PAGINATION_ICON_COLOR} strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}
