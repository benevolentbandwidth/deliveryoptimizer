import { describe, it, expect } from "vitest";
import { deliveryTimeFilled } from "@/app/edit/utils/deliveryHelpers";

describe("deliveryTimeFilled", () => {
  it("both empty → false", () => {
    expect(deliveryTimeFilled({ deliveryTimeStart: "", deliveryTimeEnd: "" })).toBe(false);
  });

  it("whitespace-only fields → false", () => {
    expect(deliveryTimeFilled({ deliveryTimeStart: "   ", deliveryTimeEnd: "  " })).toBe(false);
  });

  it("start only → true", () => {
    expect(deliveryTimeFilled({ deliveryTimeStart: "9:00 AM", deliveryTimeEnd: "" })).toBe(true);
  });

  it("end only → true", () => {
    expect(deliveryTimeFilled({ deliveryTimeStart: "", deliveryTimeEnd: "5:00 PM" })).toBe(true);
  });

  it("both set → true", () => {
    expect(
      deliveryTimeFilled({ deliveryTimeStart: "9:00 AM", deliveryTimeEnd: "5:00 PM" })
    ).toBe(true);
  });
});
