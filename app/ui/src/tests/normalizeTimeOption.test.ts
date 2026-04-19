import { describe, it, expect } from "vitest";
import { normalizeTimeOption } from "@/app/edit/utils/csvParserUtils";

describe("normalizeTimeOption", () => {
  it("empty string → ''", () => expect(normalizeTimeOption("")).toBe(""));
  it("whitespace only → ''", () => expect(normalizeTimeOption("   ")).toBe(""));
  it("unrecognised format → ''", () => expect(normalizeTimeOption("garbage")).toBe(""));

  it("pure-integer seconds → snapped time", () => {
    // 32400 s = 540 min = 9:00 AM, already on boundary
    expect(normalizeTimeOption("32400")).toBe("9:00 AM");
  });

  it("already-snapped H:MM AM/PM → unchanged", () => {
    expect(normalizeTimeOption("9:00 AM")).toBe("9:00 AM");
  });

  it("2:07 AM snaps down to 2:00 AM (127 min → nearest 15 = 120)", () => {
    expect(normalizeTimeOption("2:07 AM")).toBe("2:00 AM");
  });

  it("2:08 AM snaps up to 2:15 AM (128 min → nearest 15 = 135)", () => {
    expect(normalizeTimeOption("2:08 AM")).toBe("2:15 AM");
  });

  it("12:00 PM → noon", () => expect(normalizeTimeOption("12:00 PM")).toBe("12:00 PM"));
  it("12:00 AM → midnight", () => expect(normalizeTimeOption("12:00 AM")).toBe("12:00 AM"));
  it("5:00 PM → 5:00 PM", () => expect(normalizeTimeOption("5:00 PM")).toBe("5:00 PM"));
});
