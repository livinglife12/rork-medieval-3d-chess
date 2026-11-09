import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";

import { Board, perft } from "./board";

// Reference counts from the Chess Programming Wiki's perft results page.
const CASES: { name: string; fen: string; depths: number[] }[] = [
  {
    name: "start position",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    depths: [20, 400, 8902, 197281],
  },
  {
    name: "kiwipete (castling, pins, en passant, promotions)",
    fen: "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
    depths: [48, 2039, 97862],
  },
  {
    name: "position 3 (en passant discovered checks)",
    fen: "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1",
    depths: [14, 191, 2812, 43238],
  },
  {
    name: "position 4 (promotions and checks)",
    fen: "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1",
    depths: [6, 264, 9467],
  },
  {
    name: "position 5",
    fen: "rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8",
    depths: [44, 1486, 62379],
  },
];

describe("0x88 board move generation", () => {
  for (const { name, fen, depths } of CASES) {
    it(`matches perft for ${name}`, () => {
      const board = new Board(fen);
      depths.forEach((expected, index) => {
        expect(perft(board, index + 1), `depth ${index + 1}`).toBe(expected);
      });
    }, 30000);
  }

  it("restores the position and hash after make/unmake", () => {
    const board = new Board(CASES[1].fen);
    const before = board.key();
    const snapshot = Array.from(board.squares);
    for (const move of board.moves()) {
      board.make(move);
      board.unmake();
    }
    expect(board.key()).toBe(before);
    expect(Array.from(board.squares)).toEqual(snapshot);
  });

  it("gives the same key to a position however it was reached", () => {
    const chess = new Chess();
    for (const san of ["Nf3", "Nf6", "Ng1", "Ng8"]) chess.move(san);
    expect(new Board(chess.fen()).key()).toBe(new Board(new Chess().fen()).key());

    const board = new Board(new Chess().fen());
    const start = board.key();
    for (const text of ["g1f3", "g8f6", "f3g1", "f6g8"]) {
      const move = board.moves().find((candidate) => Board.moveText(candidate) === text)!;
      board.make(move);
    }
    expect(board.key()).toBe(start);
  });

  it("agrees with chess.js on legal moves in a sample of positions", () => {
    const chess = new Chess();
    let seed = 7;
    for (let ply = 0; ply < 120 && !chess.isGameOver(); ply += 1) {
      const expected = chess
        .moves({ verbose: true })
        .map((move) => move.from + move.to + (move.promotion ?? ""))
        .sort();
      const actual = new Board(chess.fen()).moves().map(Board.moveText).sort();
      expect(actual, chess.fen()).toEqual(expected);
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      chess.move(expected[seed % expected.length]);
    }
  });
});
