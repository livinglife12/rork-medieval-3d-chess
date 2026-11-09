import type { ArmySkinId } from "../assets/generated";
import type { Difficulty, Faction } from "./types";

/** Transport-neutral room description for a future WebRTC/WebSocket adapter. */
export interface MatchRoom {
  code: string;
  host: Faction;
  whiteArmy: ArmySkinId;
  blackArmy: ArmySkinId;
  difficulty: Difficulty;
  createdAt: number;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function createRoomCode(seed = Date.now()): string {
  let value = Math.max(1, Math.floor(seed));
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    value = (value * 1664525 + 1013904223) >>> 0;
    code += ALPHABET[value % ALPHABET.length];
  }
  return code;
}

export function encodeRoom(room: MatchRoom): string {
  const json = JSON.stringify(room);
  return typeof window === "undefined" ? json : window.btoa(encodeURIComponent(json));
}

export function decodeRoom(payload: string): MatchRoom | null {
  try {
    const json = typeof window === "undefined" ? payload : decodeURIComponent(window.atob(payload));
    const room = JSON.parse(json) as MatchRoom;
    if (!room.code || !room.whiteArmy || !room.blackArmy || !room.createdAt) return null;
    return room;
  } catch {
    return null;
  }
}

export function roomShareUrl(room: MatchRoom): string {
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  url.searchParams.set("room", encodeRoom(room));
  return url.toString();
}
