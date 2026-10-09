import { describe, expect, it } from "vitest";
import { placeCard } from "./place";

const viewport = { width: 800, height: 600 };

describe("placeCard", () => {
  it("prefers sitting just below the selection", () => {
    expect(placeCard({ left: 40, top: 80, bottom: 100, width: 20, height: 20 }, { width: 320, height: 180 }, viewport)).toEqual({
      top: 108,
      left: 40,
    });
  });

  it("flips above and clamps to the viewport", () => {
    const placed = placeCard({ left: 700, top: 520, bottom: 540, width: 20, height: 20 }, { width: 320, height: 180 }, viewport);
    expect(placed.left).toBe(472);
    expect(placed.top).toBe(332);
  });
});
