import { describe, it, expect } from "vitest";
import { hasModule, entitlementList } from "../entitlements";

describe("entitlements fail-closed", () => {
  it("denies when entitlements are null or undefined", () => {
    expect(hasModule(null, "tracking_live")).toBe(false);
    expect(hasModule(undefined, "tracking_live")).toBe(false);
  });

  it("denies when list is empty", () => {
    expect(hasModule([], "tracking_live")).toBe(false);
  });

  it("allows when key present", () => {
    expect(hasModule(["tracking_live", "trips"], "tracking_live")).toBe(true);
  });

  it("entitlementList returns [] for missing policy", () => {
    expect(entitlementList(null)).toEqual([]);
    expect(entitlementList({})).toEqual([]);
    expect(entitlementList({ entitlements: ["trips"] })).toEqual(["trips"]);
  });
});
