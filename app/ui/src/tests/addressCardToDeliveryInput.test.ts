import { describe, it, expect } from "vitest";
import { addressCardToDeliveryInput } from "@/app/edit/utils/optimizeMapper";
import type { AddressCard } from "@/app/edit/types/delivery";
import type { Location } from "@/lib/types/common.types";

const LOC: Location = { lat: 40.7128, lng: -74.006 };

function makeAddress(overrides: Partial<AddressCard> = {}): AddressCard {
  return {
    id: 1,
    locked: true,
    editingExisting: false,
    recipientAddress: "123 Main St",
    timeBuffer: "",
    deliveryTimeStart: "",
    deliveryTimeEnd: "",
    deliveryQuantity: 3,
    notes: "",
    ...overrides,
  };
}

describe("addressCardToDeliveryInput", () => {
  it("no time constraint → no timeWindows", () => {
    expect(addressCardToDeliveryInput(makeAddress(), LOC, "units").timeWindows).toBeUndefined();
  });

  it("start + end → [[startSecs, endSecs]]", () => {
    const result = addressCardToDeliveryInput(
      makeAddress({ deliveryTimeStart: "9:00 AM", deliveryTimeEnd: "5:00 PM" }),
      LOC,
      "units"
    );
    expect(result.timeWindows).toEqual([[32400, 61200]]);
  });

  it("start only → [[startSecs, 86400]]", () => {
    const result = addressCardToDeliveryInput(
      makeAddress({ deliveryTimeStart: "9:00 AM" }),
      LOC,
      "units"
    );
    expect(result.timeWindows).toEqual([[32400, 86400]]);
  });

  it("end only → [[0, endSecs]]", () => {
    const result = addressCardToDeliveryInput(
      makeAddress({ deliveryTimeEnd: "5:00 PM" }),
      LOC,
      "units"
    );
    expect(result.timeWindows).toEqual([[0, 61200]]);
  });

  it('"5 min" buffer → bufferTime 300', () => {
    expect(
      addressCardToDeliveryInput(makeAddress({ timeBuffer: "5 min" }), LOC, "units").bufferTime
    ).toBe(300);
  });

  it("empty buffer → bufferTime 0", () => {
    expect(addressCardToDeliveryInput(makeAddress(), LOC, "units").bufferTime).toBe(0);
  });

  it("demand type and value passed through", () => {
    expect(
      addressCardToDeliveryInput(makeAddress({ deliveryQuantity: 7 }), LOC, "lbs").demand
    ).toEqual({ type: "lbs", value: 7 });
  });

  it("location passed through", () => {
    expect(addressCardToDeliveryInput(makeAddress(), LOC, "units").location).toEqual(LOC);
  });
});
