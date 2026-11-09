/**
 * A compact 0x88 chess board for the search.
 *
 * chess.js is the source of truth for the game itself, but its verbose move objects build
 * two FEN strings per generated move, which caps a search at a few hundred nodes per second.
 * This board makes and unmakes integer-encoded moves in place and keeps a Zobrist hash for
 * repetition detection, which is fast enough for a real search. `perft` tests pin its move
 * generation to published reference counts.
 */

export const PAWN = 1;
export const KNIGHT = 2;
export const BISHOP = 3;
export const ROOK = 4;
export const QUEEN = 5;
export const KING = 6;

export const WHITE = 1;
export const BLACK = -1;

const FLAG_CAPTURE = 1;
const FLAG_DOUBLE = 2;
const FLAG_EP = 4;
const FLAG_CASTLE = 8;

const CASTLE_WK = 1;
const CASTLE_WQ = 2;
const CASTLE_BK = 4;
const CASTLE_BQ = 8;

const KNIGHT_STEPS = [33, 31, 18, 14, -33, -31, -18, -14];
const KING_STEPS = [1, -1, 16, -16, 17, 15, -17, -15];
const BISHOP_STEPS = [17, 15, -17, -15];
const ROOK_STEPS = [1, -1, 16, -16];

const PIECE_CHARS = " pnbrqk";
const FILES = "abcdefgh";

/** Move layout: from (7 bits) | to (7 bits) << 7 | promotion piece (3 bits) << 14 | flags << 17. */
export type MoveCode = number;

export function moveFrom(move: MoveCode): number {
  return move & 0x7f;
}
export function moveTo(move: MoveCode): number {
  return (move >> 7) & 0x7f;
}
export function movePromotion(move: MoveCode): number {
  return (move >> 14) & 0x7;
}
export function moveFlags(move: MoveCode): number {
  return move >> 17;
}
export function isCaptureMove(move: MoveCode): boolean {
  return (moveFlags(move) & (FLAG_CAPTURE | FLAG_EP)) !== 0;
}

function encode(from: number, to: number, promotion: number, flags: number): MoveCode {
  return from | (to << 7) | (promotion << 14) | (flags << 17);
}

export function squareName(square: number): string {
  return FILES[square & 7] + String((square >> 4) + 1);
}

export function parseSquare(name: string): number {
  return FILES.indexOf(name[0]) + (Number(name[1]) - 1) * 16;
}

// Deterministic Zobrist keys: two 32-bit halves combined into one safe integer.
function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state;
  };
}
const random = makeRandom(0x9e3779b9);
const ZOBRIST_PIECE_LO = new Uint32Array(13 * 128);
const ZOBRIST_PIECE_HI = new Uint32Array(13 * 128);
for (let index = 0; index < ZOBRIST_PIECE_LO.length; index += 1) {
  ZOBRIST_PIECE_LO[index] = random();
  ZOBRIST_PIECE_HI[index] = random() & 0x1fffff;
}
const ZOBRIST_SIDE_LO = random();
const ZOBRIST_SIDE_HI = random() & 0x1fffff;
const ZOBRIST_CASTLE_LO = Array.from({ length: 16 }, () => random());
const ZOBRIST_CASTLE_HI = Array.from({ length: 16 }, () => random() & 0x1fffff);
const ZOBRIST_EP_LO = Array.from({ length: 8 }, () => random());
const ZOBRIST_EP_HI = Array.from({ length: 8 }, () => random() & 0x1fffff);

function pieceIndex(piece: number, square: number): number {
  return (piece + 6) * 128 + square;
}

/** Castling rights that survive a move touching `square` (king or rook moving or being captured). */
const CASTLE_MASK = new Uint8Array(128).fill(15);
CASTLE_MASK[parseSquare("e1")] = 15 & ~(CASTLE_WK | CASTLE_WQ);
CASTLE_MASK[parseSquare("h1")] = 15 & ~CASTLE_WK;
CASTLE_MASK[parseSquare("a1")] = 15 & ~CASTLE_WQ;
CASTLE_MASK[parseSquare("e8")] = 15 & ~(CASTLE_BK | CASTLE_BQ);
CASTLE_MASK[parseSquare("h8")] = 15 & ~CASTLE_BK;
CASTLE_MASK[parseSquare("a8")] = 15 & ~CASTLE_BQ;

interface Undo {
  move: MoveCode;
  captured: number;
  castling: number;
  ep: number;
  halfmove: number;
  hashLo: number;
  hashHi: number;
}

export class Board {
  /** Signed piece codes: positive for white, negative for black, 0 for empty. */
  readonly squares = new Int8Array(128);
  side = WHITE;
  castling = 0;
  /** En-passant target square, or -1. */
  ep = -1;
  halfmove = 0;
  fullmove = 1;
  kings = { w: -1, b: -1 };
  private hashLo = 0;
  private hashHi = 0;
  private stack: Undo[] = [];

  constructor(fen?: string) {
    if (fen) this.load(fen);
  }

  load(fen: string): void {
    const [placement, side, castling, ep, halfmove, fullmove] = fen.trim().split(/\s+/);
    this.squares.fill(0);
    this.stack = [];
    const rows = placement.split("/");
    for (let row = 0; row < 8; row += 1) {
      let file = 0;
      for (const char of rows[row]) {
        if (char >= "1" && char <= "8") {
          file += Number(char);
          continue;
        }
        const type = PIECE_CHARS.indexOf(char.toLowerCase());
        const square = (7 - row) * 16 + file;
        const piece = char === char.toLowerCase() ? -type : type;
        this.squares[square] = piece;
        if (type === KING) {
          if (piece > 0) this.kings.w = square;
          else this.kings.b = square;
        }
        file += 1;
      }
    }
    this.side = side === "b" ? BLACK : WHITE;
    this.castling =
      (castling?.includes("K") ? CASTLE_WK : 0) |
      (castling?.includes("Q") ? CASTLE_WQ : 0) |
      (castling?.includes("k") ? CASTLE_BK : 0) |
      (castling?.includes("q") ? CASTLE_BQ : 0);
    this.ep = ep && ep !== "-" ? parseSquare(ep) : -1;
    this.halfmove = Number(halfmove ?? 0) || 0;
    this.fullmove = Number(fullmove ?? 1) || 1;
    this.recomputeHash();
  }

  /** Repetition key. En passant counts only when a pawn could actually take, as chess.js does. */
  key(): number {
    let lo = this.hashLo;
    let hi = this.hashHi;
    if (this.ep >= 0 && this.epCapturable()) {
      lo ^= ZOBRIST_EP_LO[this.ep & 7];
      hi ^= ZOBRIST_EP_HI[this.ep & 7];
    }
    return (lo >>> 0) + hi * 4294967296;
  }

  private epCapturable(): boolean {
    const pawn = this.side * PAWN;
    const from = this.ep - this.side * 16;
    return (
      (((from - 1) & 0x88) === 0 && this.squares[from - 1] === pawn) ||
      (((from + 1) & 0x88) === 0 && this.squares[from + 1] === pawn)
    );
  }

  private recomputeHash(): void {
    let lo = 0;
    let hi = 0;
    for (let square = 0; square < 128; square += 1) {
      if (square & 0x88) continue;
      const piece = this.squares[square];
      if (!piece) continue;
      lo ^= ZOBRIST_PIECE_LO[pieceIndex(piece, square)];
      hi ^= ZOBRIST_PIECE_HI[pieceIndex(piece, square)];
    }
    if (this.side === BLACK) {
      lo ^= ZOBRIST_SIDE_LO;
      hi ^= ZOBRIST_SIDE_HI;
    }
    lo ^= ZOBRIST_CASTLE_LO[this.castling];
    hi ^= ZOBRIST_CASTLE_HI[this.castling];
    this.hashLo = lo >>> 0;
    this.hashHi = hi;
  }

  private toggle(piece: number, square: number): void {
    this.hashLo = (this.hashLo ^ ZOBRIST_PIECE_LO[pieceIndex(piece, square)]) >>> 0;
    this.hashHi ^= ZOBRIST_PIECE_HI[pieceIndex(piece, square)];
  }

  /** True when `square` is attacked by a piece of `by` (WHITE or BLACK). */
  isAttacked(square: number, by: number): boolean {
    const squares = this.squares;
    // Pawns attack diagonally forward, so look diagonally backward from the target.
    const pawn = by * PAWN;
    const back = -by * 16;
    if (((square + back - 1) & 0x88) === 0 && squares[square + back - 1] === pawn) return true;
    if (((square + back + 1) & 0x88) === 0 && squares[square + back + 1] === pawn) return true;

    const knight = by * KNIGHT;
    for (const step of KNIGHT_STEPS) {
      const target = square + step;
      if ((target & 0x88) === 0 && squares[target] === knight) return true;
    }
    const king = by * KING;
    for (const step of KING_STEPS) {
      const target = square + step;
      if ((target & 0x88) === 0 && squares[target] === king) return true;
    }
    const bishop = by * BISHOP;
    const rook = by * ROOK;
    const queen = by * QUEEN;
    for (const step of BISHOP_STEPS) {
      let target = square + step;
      while ((target & 0x88) === 0) {
        const piece = squares[target];
        if (piece) {
          if (piece === bishop || piece === queen) return true;
          break;
        }
        target += step;
      }
    }
    for (const step of ROOK_STEPS) {
      let target = square + step;
      while ((target & 0x88) === 0) {
        const piece = squares[target];
        if (piece) {
          if (piece === rook || piece === queen) return true;
          break;
        }
        target += step;
      }
    }
    return false;
  }

  inCheck(side = this.side): boolean {
    return this.isAttacked(side === WHITE ? this.kings.w : this.kings.b, -side);
  }

  private pushPawnMove(moves: MoveCode[], from: number, to: number, flags: number): void {
    const rank = to >> 4;
    if (rank === 7 || rank === 0) {
      for (const promotion of [QUEEN, KNIGHT, ROOK, BISHOP]) moves.push(encode(from, to, promotion, flags));
    } else {
      moves.push(encode(from, to, 0, flags));
    }
  }

  /** Pseudo-legal moves: may leave the mover's own king in check. */
  private pseudoMoves(capturesOnly: boolean): MoveCode[] {
    const moves: MoveCode[] = [];
    const squares = this.squares;
    const us = this.side;

    for (let from = 0; from < 128; from += 1) {
      if (from & 0x88) {
        from += 7;
        continue;
      }
      const piece = squares[from];
      if (!piece || Math.sign(piece) !== us) continue;
      const type = piece * us;

      if (type === PAWN) {
        const forward = us * 16;
        const startRank = us === WHITE ? 1 : 6;
        const one = from + forward;
        if (!capturesOnly && (one & 0x88) === 0 && !squares[one]) {
          this.pushPawnMove(moves, from, one, 0);
          const two = one + forward;
          if (from >> 4 === startRank && !squares[two]) moves.push(encode(from, two, 0, FLAG_DOUBLE));
        } else if (capturesOnly && (one & 0x88) === 0 && !squares[one] && (one >> 4 === 7 || one >> 4 === 0)) {
          // Promotions are "noisy" enough to belong in the capture search.
          this.pushPawnMove(moves, from, one, 0);
        }
        for (const side of [-1, 1]) {
          const to = one + side;
          if (to & 0x88) continue;
          const target = squares[to];
          if (target && Math.sign(target) === -us) this.pushPawnMove(moves, from, to, FLAG_CAPTURE);
          else if (to === this.ep) moves.push(encode(from, to, 0, FLAG_EP));
        }
        continue;
      }

      if (type === KNIGHT || type === KING) {
        for (const step of type === KNIGHT ? KNIGHT_STEPS : KING_STEPS) {
          const to = from + step;
          if (to & 0x88) continue;
          const target = squares[to];
          if (!target) {
            if (!capturesOnly) moves.push(encode(from, to, 0, 0));
          } else if (Math.sign(target) === -us) {
            moves.push(encode(from, to, 0, FLAG_CAPTURE));
          }
        }
        if (type === KING && !capturesOnly) this.castleMoves(moves, from);
        continue;
      }

      const steps = type === BISHOP ? BISHOP_STEPS : type === ROOK ? ROOK_STEPS : KING_STEPS;
      for (const step of steps) {
        let to = from + step;
        while ((to & 0x88) === 0) {
          const target = squares[to];
          if (!target) {
            if (!capturesOnly) moves.push(encode(from, to, 0, 0));
          } else {
            if (Math.sign(target) === -us) moves.push(encode(from, to, 0, FLAG_CAPTURE));
            break;
          }
          to += step;
        }
      }
    }
    return moves;
  }

  private castleMoves(moves: MoveCode[], from: number): void {
    const us = this.side;
    const squares = this.squares;
    const kingSide = us === WHITE ? CASTLE_WK : CASTLE_BK;
    const queenSide = us === WHITE ? CASTLE_WQ : CASTLE_BQ;
    if (!(this.castling & (kingSide | queenSide))) return;
    if (this.isAttacked(from, -us)) return;
    if (
      this.castling & kingSide &&
      !squares[from + 1] &&
      !squares[from + 2] &&
      squares[from + 3] === us * ROOK &&
      !this.isAttacked(from + 1, -us) &&
      !this.isAttacked(from + 2, -us)
    ) {
      moves.push(encode(from, from + 2, 0, FLAG_CASTLE));
    }
    if (
      this.castling & queenSide &&
      !squares[from - 1] &&
      !squares[from - 2] &&
      !squares[from - 3] &&
      squares[from - 4] === us * ROOK &&
      !this.isAttacked(from - 1, -us) &&
      !this.isAttacked(from - 2, -us)
    ) {
      moves.push(encode(from, from - 2, 0, FLAG_CASTLE));
    }
  }

  /** Legal moves; `capturesOnly` keeps captures, en passant and promotions. */
  moves(capturesOnly = false): MoveCode[] {
    const legal: MoveCode[] = [];
    const us = this.side;
    for (const move of this.pseudoMoves(capturesOnly)) {
      this.make(move);
      if (!this.inCheck(us)) legal.push(move);
      this.unmake();
    }
    return legal;
  }

  hasLegalMove(): boolean {
    const us = this.side;
    for (const move of this.pseudoMoves(false)) {
      this.make(move);
      const ok = !this.inCheck(us);
      this.unmake();
      if (ok) return true;
    }
    return false;
  }

  /** The piece a move takes (signed), or 0. */
  capturedBy(move: MoveCode): number {
    if (moveFlags(move) & FLAG_EP) return -this.side * PAWN;
    return this.squares[moveTo(move)];
  }

  make(move: MoveCode): void {
    const squares = this.squares;
    const from = moveFrom(move);
    const to = moveTo(move);
    const flags = moveFlags(move);
    const promotion = movePromotion(move);
    const piece = squares[from];
    const us = this.side;
    let captured = squares[to];

    this.stack.push({
      move,
      captured,
      castling: this.castling,
      ep: this.ep,
      halfmove: this.halfmove,
      hashLo: this.hashLo,
      hashHi: this.hashHi,
    });

    if (flags & FLAG_EP) {
      const victim = to - us * 16;
      captured = squares[victim];
      this.toggle(captured, victim);
      squares[victim] = 0;
      this.stack[this.stack.length - 1].captured = captured;
    } else if (captured) {
      this.toggle(captured, to);
    }

    this.toggle(piece, from);
    squares[from] = 0;
    const placed = promotion ? us * promotion : piece;
    squares[to] = placed;
    this.toggle(placed, to);

    if (flags & FLAG_CASTLE) {
      const rookFrom = to > from ? from + 3 : from - 4;
      const rookTo = to > from ? from + 1 : from - 1;
      const rook = squares[rookFrom];
      this.toggle(rook, rookFrom);
      squares[rookFrom] = 0;
      squares[rookTo] = rook;
      this.toggle(rook, rookTo);
    }

    if (piece === KING) this.kings.w = to;
    else if (piece === -KING) this.kings.b = to;

    this.hashLo = (this.hashLo ^ ZOBRIST_CASTLE_LO[this.castling]) >>> 0;
    this.hashHi ^= ZOBRIST_CASTLE_HI[this.castling];
    this.castling &= CASTLE_MASK[from] & CASTLE_MASK[to];
    this.hashLo = (this.hashLo ^ ZOBRIST_CASTLE_LO[this.castling]) >>> 0;
    this.hashHi ^= ZOBRIST_CASTLE_HI[this.castling];

    this.ep = flags & FLAG_DOUBLE ? from + us * 16 : -1;
    this.halfmove = piece * us === PAWN || captured ? 0 : this.halfmove + 1;
    if (us === BLACK) this.fullmove += 1;
    this.side = -us;
    this.hashLo = (this.hashLo ^ ZOBRIST_SIDE_LO) >>> 0;
    this.hashHi ^= ZOBRIST_SIDE_HI;
  }

  unmake(): void {
    const undo = this.stack.pop();
    if (!undo) return;
    const squares = this.squares;
    const { move } = undo;
    const from = moveFrom(move);
    const to = moveTo(move);
    const flags = moveFlags(move);
    this.side = -this.side;
    const us = this.side;
    const moved = movePromotion(move) ? us * PAWN : squares[to];

    squares[from] = moved;
    if (flags & FLAG_EP) {
      squares[to] = 0;
      squares[to - us * 16] = undo.captured;
    } else {
      squares[to] = undo.captured;
    }
    if (flags & FLAG_CASTLE) {
      const rookFrom = to > from ? from + 3 : from - 4;
      const rookTo = to > from ? from + 1 : from - 1;
      squares[rookFrom] = squares[rookTo];
      squares[rookTo] = 0;
    }
    if (moved === KING) this.kings.w = from;
    else if (moved === -KING) this.kings.b = from;

    if (us === BLACK) this.fullmove -= 1;
    this.castling = undo.castling;
    this.ep = undo.ep;
    this.halfmove = undo.halfmove;
    this.hashLo = undo.hashLo;
    this.hashHi = undo.hashHi;
  }

  /** No pawns, rooks or queens, and at most one minor piece on the board. */
  insufficientMaterial(): boolean {
    let minors = 0;
    for (let square = 0; square < 128; square += 1) {
      if (square & 0x88) continue;
      const type = Math.abs(this.squares[square]);
      if (type === PAWN || type === ROOK || type === QUEEN) return false;
      if (type === KNIGHT || type === BISHOP) minors += 1;
      if (minors > 1) return false;
    }
    return true;
  }

  /** UCI-style move text, e.g. "e7e8q". */
  static moveText(move: MoveCode): string {
    const promotion = movePromotion(move);
    return squareName(moveFrom(move)) + squareName(moveTo(move)) + (promotion ? PIECE_CHARS[promotion] : "");
  }

  static promotionChar(move: MoveCode): string | null {
    const promotion = movePromotion(move);
    return promotion ? PIECE_CHARS[promotion] : null;
  }
}

/** Counts leaf nodes at `depth`, for checking move generation against reference numbers. */
export function perft(board: Board, depth: number): number {
  if (depth === 0) return 1;
  const moves = board.moves();
  if (depth === 1) return moves.length;
  let total = 0;
  for (const move of moves) {
    board.make(move);
    total += perft(board, depth - 1);
    board.unmake();
  }
  return total;
}
