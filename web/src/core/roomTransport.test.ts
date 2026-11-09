import { describe, expect, it } from "vitest";
import { openRoomTransport } from "./roomTransport";

describe("room transport", () => {
  it("is safely unavailable outside a browser", () => {
    expect(openRoomTransport({
      code: "ABC234",
      host: "w",
      whiteArmy: "viking",
      blackArmy: "sun",
      difficulty: "easy",
      createdAt: 1,
    })).toBeNull();
  });
});
