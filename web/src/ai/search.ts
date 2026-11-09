import { Chess, type Move } from "chess.js";

import {
  BISHOP,
  Board,
  isCaptureMove,
  KING,
  moveFrom,
  movePromotion,
  moveTo,
  PAWN,
  squareName,
  WHITE,
  type MoveCode,
} from "./board";

/**
 * Pure chess search, shared by the worker and the tests.
 *
 * Runs on the fast 0x88 `Board` (chess.js stays the rules authority for the game itself).
 * Principal-variation negamax + alpha-beta under iterative deepening, with:
 * - best-move-first ordering from a hash table, MVV-LVA captures, killer moves and a
 *   history heuristic for quiet moves;
 * - a one-ply check extension, so forcing lines are not cut off at the horizon;
 * - quiescence on captures and promotions that searches every evasion when in check;
 * - mate scores that prefer the quickest mate (and the slowest loss);
 * - repetition awareness: a position already seen in the game or on the current search
 *   path scores as a draw, so a winning engine stops shuffling into threefold repetition.
 */

export type Difficulty = "easy" | "medium" | "hard";

export interface SearchResult {
  from: string;
  to: string;
  promotion: string | null;
  score: number;
  depth: number;
}

/** Piece values indexed by the board's piece codes (1 = pawn .. 6 = king). */
const PIECE_VALUE = [0, 100, 320, 330, 500, 900, 20000];
const PIECE_LETTER = " pnbrqk";
const MATE = 100000;
const MAX_PLY = 64;

// Piece-square tables from white's point of view, index 0 = a8 .. 63 = h1.
const PST: Record<string, number[]> = {
  p: [
    0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  n: [
    -50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15,
    20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  b: [
    -20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10,
    5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10,
    -10, -10, -10, -10, -10, -20,
  ],
  r: [
    0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0,
    0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0,
  ],
  q: [
    -20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0,
    -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10,
    -10, -20,
  ],
  k: [
    -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40,
    -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20,
    -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20,
  ],
  kEnd: [
    -50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30,
    -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0,
    0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50,
  ],
};

/** Board, side to move, castling and en-passant: the part of a FEN that defines repetition. */
export function positionKey(fen: string): string {
  return fen.split(" ").slice(0, 4).join(" ");
}

/** Static evaluation in centipawns, positive = good for white. */
export function evaluate(board: Board): number {
  const squares = board.squares;
  let material = 0;
  let whiteBishops = 0;
  let blackBishops = 0;
  for (let square = 0; square < 128; square += 1) {
    if (square & 0x88) continue;
    const piece = squares[square];
    if (!piece) continue;
    const type = Math.abs(piece);
    if (type !== PAWN && type !== KING) material += PIECE_VALUE[type];
    if (type === BISHOP) {
      if (piece > 0) whiteBishops += 1;
      else blackBishops += 1;
    }
  }
  const endgame = material < 1500;

  let score = 0;
  for (let square = 0; square < 128; square += 1) {
    if (square & 0x88) continue;
    const piece = squares[square];
    if (!piece) continue;
    const type = Math.abs(piece);
    const rank = square >> 4;
    const file = square & 7;
    // Tables are written from white's side with a8 first; black reads them mirrored.
    const tableIndex = piece > 0 ? (7 - rank) * 8 + file : rank * 8 + file;
    const table = type === KING ? (endgame ? PST.kEnd : PST.k) : PST[PIECE_LETTER[type]];
    const value = PIECE_VALUE[type] + table[tableIndex];
    score += piece > 0 ? value : -value;
  }

  // The bishop pair is worth about a third of a pawn, and a small tempo bonus
  // keeps quiet positions from evaluating as dead level.
  if (whiteBishops >= 2) score += 30;
  if (blackBishops >= 2) score -= 30;
  score += board.side === WHITE ? 10 : -10;
  return score;
}

export interface RootResult {
  move: MoveCode;
  score: number;
  depth: number;
}

const BEST_MOVE_TABLE_LIMIT = 1 << 20;

export class Search {
  private board: Board;
  private deadline: number;
  private nodes = 0;
  private aborted = false;
  /** Positions that occurred earlier in the game, plus the current search path. */
  private seen = new Map<number, number>();
  private killers = new Int32Array(MAX_PLY * 2).fill(-1);
  private history = new Int32Array(128 * 128);
  /** Best move found per position, used only for move ordering (never for cutoffs). */
  private bestMoves = new Map<number, MoveCode>();

  constructor(fen: string, budgetMs: number, gameHistory: readonly string[] = []) {
    this.board = new Board(fen);
    this.deadline = performance.now() + budgetMs;
    const scratch = new Board();
    for (const past of gameHistory) {
      scratch.load(past);
      this.count(scratch.key(), 1);
    }
    this.count(this.board.key(), 1);
  }

  getNodes(): number {
    return this.nodes;
  }

  private count(key: number, delta: number): void {
    const next = (this.seen.get(key) ?? 0) + delta;
    if (next <= 0) this.seen.delete(key);
    else this.seen.set(key, next);
  }

  private outOfTime(): boolean {
    if (this.aborted) return true;
    if ((this.nodes & 1023) === 0 && performance.now() > this.deadline) this.aborted = true;
    return this.aborted;
  }

  private orderScore(move: MoveCode, ply: number): number {
    if (isCaptureMove(move)) {
      const victim = Math.abs(this.board.capturedBy(move));
      const attacker = Math.abs(this.board.squares[moveFrom(move)]);
      return 1_000_000 + 10 * PIECE_VALUE[victim] - PIECE_VALUE[attacker];
    }
    const promotion = movePromotion(move);
    if (promotion) return 900_000 + PIECE_VALUE[promotion];
    if (ply < MAX_PLY) {
      if (this.killers[ply * 2] === move) return 800_000;
      if (this.killers[ply * 2 + 1] === move) return 790_000;
    }
    return this.history[moveFrom(move) * 128 + moveTo(move)];
  }

  private order(moves: MoveCode[], ply: number, first: MoveCode = -1): MoveCode[] {
    const scored = moves.map((move) => ({ move, score: move === first ? 10_000_000 : this.orderScore(move, ply) }));
    scored.sort((a, b) => b.score - a.score);
    return scored.map((entry) => entry.move);
  }

  private rememberCutoff(move: MoveCode, depth: number, ply: number): void {
    if (isCaptureMove(move) || movePromotion(move) || ply >= MAX_PLY) return;
    if (this.killers[ply * 2] !== move) {
      this.killers[ply * 2 + 1] = this.killers[ply * 2];
      this.killers[ply * 2] = move;
    }
    const index = moveFrom(move) * 128 + moveTo(move);
    this.history[index] = Math.min(this.history[index] + depth * depth, 700_000);
  }

  private rememberBest(key: number, move: MoveCode): void {
    if (this.bestMoves.size > BEST_MOVE_TABLE_LIMIT) this.bestMoves.clear();
    this.bestMoves.set(key, move);
  }

  private play(move: MoveCode): void {
    this.board.make(move);
    this.count(this.board.key(), 1);
  }

  private unplay(): void {
    this.count(this.board.key(), -1);
    this.board.unmake();
  }

  private sign(): number {
    return this.board.side === WHITE ? 1 : -1;
  }

  private quiescence(alpha: number, beta: number, depth: number, ply: number): number {
    this.nodes += 1;
    if (this.outOfTime()) return this.sign() * evaluate(this.board);

    // In check there is no "stand pat": every evasion must be searched or a mate is missed.
    if (this.board.inCheck()) {
      const evasions = this.board.moves();
      if (evasions.length === 0) return -(MATE - ply);
      if (depth <= -4) return this.sign() * evaluate(this.board);
      for (const move of this.order(evasions, ply)) {
        this.board.make(move);
        const score = -this.quiescence(-beta, -alpha, depth - 1, ply + 1);
        this.board.unmake();
        if (this.aborted) return alpha;
        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
      }
      return alpha;
    }

    const standPat = this.sign() * evaluate(this.board);
    if (standPat >= beta) return beta;
    if (standPat > alpha) alpha = standPat;
    if (depth <= 0) return alpha;

    for (const move of this.order(this.board.moves(true), ply)) {
      this.board.make(move);
      const score = -this.quiescence(-beta, -alpha, depth - 1, ply + 1);
      this.board.unmake();
      if (this.aborted) return alpha;
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  private negamax(depth: number, alpha: number, beta: number, ply: number, useQuiescence: boolean): number {
    this.nodes += 1;
    if (this.outOfTime()) return this.sign() * evaluate(this.board);

    const board = this.board;
    const key = board.key();
    if ((this.seen.get(key) ?? 0) > 1 || board.halfmove >= 100 || board.insufficientMaterial()) return 0;

    const moves = board.moves();
    const inCheck = board.inCheck();
    if (moves.length === 0) return inCheck ? -(MATE - ply) : 0;

    // Check extension: a side in check gets one more ply to find its way out.
    if (inCheck && ply < MAX_PLY / 2) depth += 1;
    if (depth <= 0) {
      return useQuiescence ? this.quiescence(alpha, beta, 6, ply) : this.sign() * evaluate(board);
    }

    let best = -Infinity;
    let bestMove: MoveCode = moves[0];
    let first = true;
    for (const move of this.order(moves, ply, this.bestMoves.get(key))) {
      this.play(move);
      let score: number;
      if (first) {
        score = -this.negamax(depth - 1, -beta, -alpha, ply + 1, useQuiescence);
      } else {
        // Principal-variation search: prove the move is no better with a null window,
        // and re-search with the full window only if it is.
        score = -this.negamax(depth - 1, -alpha - 1, -alpha, ply + 1, useQuiescence);
        if (score > alpha && score < beta && !this.aborted) {
          score = -this.negamax(depth - 1, -beta, -alpha, ply + 1, useQuiescence);
        }
      }
      this.unplay();
      first = false;
      if (this.aborted) return best === -Infinity ? this.sign() * evaluate(board) : best;
      if (score > best) {
        best = score;
        bestMove = move;
      }
      if (best > alpha) alpha = best;
      if (alpha >= beta) {
        this.rememberCutoff(move, depth, ply);
        break;
      }
    }
    this.rememberBest(key, bestMove);
    return best;
  }

  /** Iterative deepening; returns the best move found before the budget ran out. */
  run(maxDepth: number, useQuiescence: boolean): RootResult | null {
    const legal = this.board.moves();
    if (legal.length === 0) return null;

    let rootMoves = this.order(legal, 0);
    let bestMove = rootMoves[0];
    let bestScore = -Infinity;
    let reachedDepth = 0;

    for (let depth = 1; depth <= maxDepth; depth += 1) {
      let alpha = -Infinity;
      let localBest = rootMoves[0];
      let localScore = -Infinity;

      for (const move of rootMoves) {
        this.play(move);
        const score = -this.negamax(depth - 1, -Infinity, -alpha, 1, useQuiescence);
        this.unplay();
        if (this.aborted) break;
        if (score > localScore) {
          localScore = score;
          localBest = move;
        }
        if (score > alpha) alpha = score;
      }

      // An interrupted iteration is only trusted if it already overturned the previous
      // best, which is always searched first.
      if (this.aborted) {
        if (reachedDepth > 0 && localScore > bestScore) {
          bestMove = localBest;
          bestScore = localScore;
        }
        break;
      }
      bestMove = localBest;
      bestScore = localScore;
      reachedDepth = depth;
      rootMoves = this.order(legal, 0, bestMove);
      // A forced mate was found: deeper search cannot improve on it.
      if (Math.abs(bestScore) > MATE - MAX_PLY) break;
    }

    return { move: bestMove, score: bestScore, depth: Math.max(1, reachedDepth) };
  }
}

/** Random legal move that still takes a mate in one, and usually grabs a capture. */
export function pickEasyMove(fen: string, random: () => number = Math.random): Move | null {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true }) as Move[];
  if (moves.length === 0) return null;

  for (const move of moves) {
    chess.move(move as unknown as { from: string; to: string; promotion?: string });
    const mate = chess.isCheckmate();
    chess.undo();
    if (mate) return move;
  }
  const captures = moves.filter((move) => Boolean(move.captured));
  if (captures.length > 0 && random() < 0.6) {
    return captures[Math.floor(random() * captures.length)];
  }
  return moves[Math.floor(random() * moves.length)];
}

const BUDGET: Record<Exclude<Difficulty, "easy">, { ms: number; depth: number; quiescence: boolean }> = {
  // Medium keeps its fixed shallow horizon so it still misses deeper tactics.
  medium: { ms: 700, depth: 3, quiescence: false },
  // Hard searches as deep as its time allows.
  hard: { ms: 3200, depth: 32, quiescence: true },
};

/**
 * Chooses a move for `fen`. `gameHistory` lists the FENs of earlier positions in the game
 * so the engine can see repetitions; `budgetMs` overrides the difficulty's think time.
 */
export function chooseMove(
  fen: string,
  difficulty: Difficulty,
  gameHistory: readonly string[] = [],
  budgetMs?: number,
): SearchResult | null {
  if (difficulty === "easy") {
    const move = pickEasyMove(fen);
    return move ? { from: move.from, to: move.to, promotion: move.promotion ?? null, score: 0, depth: 1 } : null;
  }
  const budget = BUDGET[difficulty];
  const search = new Search(fen, budgetMs ?? budget.ms, gameHistory);
  const result = search.run(budget.depth, budget.quiescence);
  if (!result) return null;
  return {
    from: squareName(moveFrom(result.move)),
    to: squareName(moveTo(result.move)),
    promotion: Board.promotionChar(result.move),
    score: result.score,
    depth: result.depth,
  };
}
