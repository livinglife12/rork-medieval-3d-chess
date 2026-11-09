import { describe, expect, it } from "vitest";
import { createRoomCode, decodeRoom, encodeRoom, type MatchRoom } from "./multiplayer";

describe("multiplayer room foundation", () => {
  it("creates deterministic six-character room codes", () => {
    expect(createRoomCode(42)).toBe(createRoomCode(42));
    expect(createRoomCode(42)).toHaveLength(6);
  });

  it("round-trips a room payload", () => {
    const room: MatchRoom = {
      code: createRoomCode(7),
      host: "w",
      whiteArmy: "viking",
      blackArmy: "sun",
      difficulty: "medium",
      createdAt: 123,
    };
    expect(decodeRoom(encodeRoom(room))).toEqual(room);
  });

  it("rejects malformed room payloads", () => {
    expect(decodeRoom("not-a-room")).toBeNull();
  });
});
