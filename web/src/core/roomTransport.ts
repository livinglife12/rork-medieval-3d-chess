import type { MatchRoom } from "./multiplayer";

export type RoomMessage =
  | { type: "hello"; room: MatchRoom; peerId: string }
  | { type: "leave"; peerId: string }
  | { type: "state"; peerId: string; payload: unknown };

export interface RoomTransport {
  readonly peerId: string;
  send(message: RoomMessage): void;
  close(): void;
  onMessage(listener: (message: RoomMessage) => void): () => void;
}

/**
 * Same-origin tab transport. It is intentionally tiny and transport-shaped:
 * replace this with a WebSocket/WebRTC implementation without changing the
 * match controller or message schema.
 */
export function openRoomTransport(room: MatchRoom): RoomTransport | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null;
  const channel = new BroadcastChannel(`kings-gambit-room:${room.code}`);
  const peerId = `${room.code}-${Math.random().toString(36).slice(2, 10)}`;
  const listeners = new Set<(message: RoomMessage) => void>();
  const receive = (event: MessageEvent<RoomMessage>): void => {
    if (!event.data || event.data.peerId === peerId) return;
    for (const listener of listeners) listener(event.data);
  };
  channel.addEventListener("message", receive);

  const transport: RoomTransport = {
    peerId,
    send(message) {
      channel.postMessage(message);
    },
    close() {
      channel.postMessage({ type: "leave", peerId } satisfies RoomMessage);
      channel.removeEventListener("message", receive);
      channel.close();
      listeners.clear();
    },
    onMessage(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  transport.send({ type: "hello", room, peerId });
  return transport;
}
