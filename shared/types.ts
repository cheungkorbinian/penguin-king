export const SUITS = ["fish", "shell", "aurora", "ice"] as const;
export type Suit = (typeof SUITS)[number];

export const STANDARD_SUITS: Suit[] = ["fish", "shell", "aurora"];

export type CardKind =
  | { type: "suit"; suit: Suit; rank: number }
  | { type: "pirate"; index: number }
  | { type: "tigress" }
  | { type: "king" }
  | { type: "mermaid"; index: number }
  | { type: "escape"; index: number }
  | { type: "kraken" }
  | { type: "whale" }
  | { type: "loot"; index: number };

export interface Card {
  id: string;
  kind: CardKind;
}

export type TigressAs = "pirate" | "escape";

export interface PlayedCard {
  playerIndex: number;
  card: Card;
  tigressAs?: TigressAs;
}

export type PlayerType = "human" | "ai";

export interface Player {
  id: string;
  name: string;
  type: PlayerType;
  connected: boolean;
}

export type Phase = "bidding" | "playing" | "collecting" | "roundEnd" | "gameEnd";

export interface RoundScore {
  round: number;
  cardsDealt: number;
  bid: number;
  tricks: number;
  bidPoints: number;
  bonus: number;
  total: number;
}

export interface BonusDetail {
  kind: "fourteen" | "mermaidByPirate" | "pirateByKing" | "kingByMermaid" | "loot";
  points: number;
  label: string;
}

export interface TrickResult {
  winnerIndex: number | null;
  nextLeaderIndex: number;
  bonuses: BonusDetail[];
  lootAlliances: { lootPlayerIndex: number; capturerIndex: number }[];
  destroyed: boolean;
  cards: PlayedCard[];
}

export interface PublicPlayerView {
  id: string;
  name: string;
  type: PlayerType;
  connected: boolean;
  handCount: number;
  bid: number | null;
  tricksWon: number;
  score: number;
  lastRoundScore: RoundScore | null;
  collected: boolean;
}

export type AiDifficulty = "easy" | "sharp" | "hard";

export function normalizeAiDifficulty(value?: string | null): AiDifficulty {
  if (value === "hard" || value === "sharp") return value;
  return "easy";
}

export interface GameConfig {
  expansion: boolean;
  maxRounds: number;
  aiDifficulty?: AiDifficulty;
}

export interface GameState {
  config: GameConfig;
  players: Player[];
  phase: Phase;
  round: number;
  dealerIndex: number;
  leaderIndex: number;
  currentPlayerIndex: number;
  hands: Card[][];
  bids: (number | null)[];
  tricksWon: number[];
  currentTrick: PlayedCard[];
  completedTricks: TrickResult[];
  lootAlliances: { lootPlayerIndex: number; capturerIndex: number }[];
  history: RoundScore[][];
  scores: number[];
  lastTrick: TrickResult | null;
  pendingTrick: TrickResult | null;
  collectReady: boolean[];
  winnerIndices: number[];
}

export interface ClientView {
  you: number;
  config: GameConfig;
  players: PublicPlayerView[];
  phase: Phase;
  round: number;
  cardsDealt: number;
  dealerIndex: number;
  leaderIndex: number;
  currentPlayerIndex: number;
  hand: Card[];
  legalCardIds: string[];
  bidsRevealed: boolean;
  currentTrick: PlayedCard[];
  lastTrick: TrickResult | null;
  completedTrickCount: number;
  winnerIndices: number[];
  yourLastRound: RoundScore | null;
  thinkingPlayerIndex: number | null;
  pendingTrick: TrickResult | null;
  youCollected: boolean;
}

export type GameAction =
  | { type: "bid"; playerIndex: number; amount: number }
  | { type: "play"; playerIndex: number; cardId: string; tigressAs?: TigressAs }
  | { type: "collect"; playerIndex: number }
  | { type: "nextRound" };
