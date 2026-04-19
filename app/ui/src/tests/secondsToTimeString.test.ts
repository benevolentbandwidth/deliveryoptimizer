import { describe, it, expect } from "vitest";
import { secondsToTimeString } from "@/app/edit/utils/vroomToRoutes";

describe("secondsToTimeString", () => {
  it("0 → midnight", () => expect(secondsToTimeString(0)).toBe("12:00 AM"));
  it("32400 → 9:00 AM", () => expect(secondsToTimeString(32400)).toBe("9:00 AM"));
  it("39600 → 11:00 AM", () => expect(secondsToTimeString(39600)).toBe("11:00 AM"));
  it("43200 → noon", () => expect(secondsToTimeString(43200)).toBe("12:00 PM"));
  it("86399 → one second before midnight", () =>
    expect(secondsToTimeString(86399)).toBe("11:59 PM"));
});
