import { describe, expect, it } from "vitest";
import { clampFrame, dragFrame, resizeFromCorner } from "./frame";

const viewport = { width: 800, height: 600 };

describe("dragFrame", () => {
  it("moves the card with the pointer", () => {
    expect(dragFrame({ x: 200, y: 150 }, { x: 20, y: 10 }, { width: 320, height: 180 }, viewport)).toEqual({
      left: 180,
      top: 140,
    });
  });

  it("keeps the card inside the viewport", () => {
    expect(dragFrame({ x: 900, y: 700 }, { x: 10, y: 10 }, { width: 320, height: 180 }, viewport)).toEqual({
      left: 472,
      top: 412,
    });
    expect(dragFrame({ x: 0, y: 0 }, { x: 40, y: 40 }, { width: 320, height: 180 }, viewport)).toEqual({
      left: 8,
      top: 8,
    });
  });
});

describe("resizeFromCorner", () => {
  const start = { left: 40, top: 80, width: 320, height: 180 };

  it("grows from the bottom-right corner", () => {
    expect(resizeFromCorner(start, 80, 40, viewport)).toEqual({ width: 400, height: 220 });
  });

  it("stops at the viewport edge and at the minimum size", () => {
    expect(resizeFromCorner(start, 900, 900, viewport)).toEqual({ width: 752, height: 512 });
    expect(resizeFromCorner(start, -300, -300, viewport)).toEqual({ width: 260, height: 160 });
  });
});

describe("clampFrame", () => {
  it("pulls an oversized card back into the viewport", () => {
    expect(clampFrame({ left: 700, top: 500, width: 400, height: 300 }, viewport)).toEqual({
      left: 392,
      top: 292,
      width: 400,
      height: 300,
    });
  });
});
