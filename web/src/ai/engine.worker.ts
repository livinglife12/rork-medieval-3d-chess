/// <reference lib="webworker" />
import { chooseMove, type Difficulty, type SearchResult } from "./search";

/**
 * Chess engine worker: runs the search in `search.ts` off the main thread so the
 * render loop never stalls.
 */

interface SearchRequest {
  id: number;
  fen: string;
  difficulty: Difficulty;
  /** FENs of earlier positions in the game, oldest first, for repetition detection. */
  history?: string[];
}

type SearchResponse = SearchResult & { id: number };

self.onmessage = (event: MessageEvent<SearchRequest>) => {
  const { id, fen, difficulty, history } = event.data;
  try {
    const result = chooseMove(fen, difficulty, history ?? []);
    if (!result) {
      self.postMessage(null);
      return;
    }
    const response: SearchResponse = { id, ...result };
    self.postMessage(response);
  } catch (error) {
    console.error("[engine] search failed", error);
    self.postMessage(null);
  }
};
