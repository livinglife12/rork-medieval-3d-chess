import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";

import { Board } from "./board";
import { chooseMove, evaluate, pickEasyMove, positionKey, Search } from "./search";

describe("chess search", () => {
  it("delivers a back-rank mate in one", () => {
    // White rook a1 mates on a8; the black king is boxed in by its own pawns.
    const fen = "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1";
    for (const difficulty of ["easy", "medium", "hard"] as const) {
      const result = chooseMove(fen, difficulty, [], 1500);
      expect(result, difficulty).not.toBeNull();
      expect(`${result!.from}${result!.to}`, difficulty).toBe("a1a8");
    }
  });

  it("takes a hanging queen", () => {
    const fen = "4k3/8/8/3q4/8/8/3R4/4K3 w - - 0 1";
    const result = chooseMove(fen, "medium", [], 1500);
    expect(`${result!.from}${result!.to}`).toBe("d2d5");
  });

  it("finds a mate in two", () => {
    // 1.Nf6+ gxf6 2.Bxf7#
    const fen = "r2qkb1r/pp2nppp/3p4/2pNN1B1/2BnP3/3P4/PPP2PPP/R2bK2R w KQkq - 1 1";
    const result = chooseMove(fen, "hard", [], 3000)!;
    expect(`${result.from}${result.to}`).toBe("d5f6");
    expect(result.score).toBeGreaterThan(90000);
  }, 10000);

  it("reports quicker mates with a higher score", () => {
    const search = new Search("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", 1500);
    const result = search.run(3, true);
    expect(result!.score).toBeGreaterThan(90000);
  });

  it("avoids a move that would repeat the position when winning", () => {
    // King and queen against a lone king, nowhere near a forced mate at this depth.
    const fen = "8/8/8/4k3/8/8/8/3QK3 w - - 0 1";
    const first = chooseMove(fen, "medium", [], 1500)!;
    const chess = new Chess(fen);
    chess.move({ from: first.from, to: first.to });
    const after = chess.fen();
    // Pretend the position after that move has already occurred twice in this game.
    const second = chooseMove(fen, "medium", [after, after], 1500)!;
    expect(`${second.from}${second.to}`).not.toBe(`${first.from}${first.to}`);
    expect(second.score).toBeGreaterThan(500);
  });

  it("only returns legal moves from a busy middlegame", () => {
    const fen = "r1bq1rk1/pp2bppp/2n1pn2/2pp4/3P4/2PBPN2/PP1N1PPP/R1BQ1RK1 w - - 0 8";
    const result = chooseMove(fen, "hard", [], 800);
    const chess = new Chess(fen);
    expect(() => chess.move({ from: result!.from, to: result!.to, promotion: result!.promotion ?? undefined })).not.toThrow();
  });

  it("easy mode still takes a mate in one", () => {
    const move = pickEasyMove("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", () => 0.99);
    expect(`${move!.from}${move!.to}`).toBe("a1a8");
  });

  it("returns null with no legal moves", () => {
    // Black is checkmated.
    expect(chooseMove("R5k1/5ppp/8/8/8/8/8/6K1 b - - 1 1", "hard", [], 200)).toBeNull();
  });
});

describe("evaluation", () => {
  it("is symmetric for the starting position apart from tempo", () => {
    expect(Math.abs(evaluate(new Board(new Chess().fen())))).toBeLessThanOrEqual(10);
  });

  it("rewards the bishop pair", () => {
    const pair = evaluate(new Board("4k3/8/8/8/8/8/8/2B1KB2 w - - 0 1"));
    const single = evaluate(new Board("4k3/8/8/8/8/8/8/2N1KB2 w - - 0 1"));
    expect(pair).toBeGreaterThan(single);
  });

  it("keys positions without the move counters", () => {
    expect(positionKey("8/8/8/8/8/8/8/K6k w - - 12 40")).toBe("8/8/8/8/8/8/8/K6k w - -");
  });
});
