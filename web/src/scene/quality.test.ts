import { describe, expect, it } from "vitest";
import { renderPixelRatio } from "./quality";

describe("render resolution", () => {
  it("supersamples Ultra on a standard-density monitor", () => {
    expect(renderPixelRatio("ultra", 1)).toBe(1.5);
  });
  it("caps high-DPI cost and restores cheaper resolution after downgrade", () => {
    expect(renderPixelRatio("ultra", 3)).toBe(2);
    expect(renderPixelRatio("medium", 3)).toBe(1.5);
    expect(renderPixelRatio("low", 3)).toBe(1);
    expect(renderPixelRatio("high", 1)).toBe(1);
  });
});
