import { buildDeck, shuffle } from "./deck.ts";
import { legalCards, needsTigressChoice } from "./legal.ts";
import { resolveTrick, scoreRound } from "./scoring.ts";
import type {
  BonusDetail,
  Card,
  ClientView,
  GameAction,
  GameConfig,
  GameState,
  Player,
  PublicPlayerView,
  RoundScore,
  TigressAs,
} from "./types.ts";

export function cardsDealtForRound(round: number, maxRounds: number): number {
  return Math.min(round, maxRounds);
}

export function createGame(players: Player[], config: GameConfig, rng?: () => number): GameState {
  if (players.length < 2 || players.length > 6) {
    throw new Error("企鹅王支持 2–6 名玩家");
  }
  const state: GameState = {
    config: {
      ...config,
      aiDifficulty: config.aiDifficulty === "sharp" ? "sharp" : "easy",
    },
    players: players.map((p) => ({ ...p })),
    phase: "bidding",
    round: 1,
    dealerIndex: 0,
    leaderIndex: 1 % players.length,
    currentPlayerIndex: 0,
    hands: players.map(() => []),
    bids: players.map(() => null),
    tricksWon: players.map(() => 0),
    currentTrick: [],
    completedTricks: [],
    lootAlliances: [],
    history: players.map(() => []),
    scores: players.map(() => 0),
    lastTrick: null,
    winnerIndices: [],
  };
  dealRound(state, rng);
  return state;
}

function dealRound(state: GameState, rng?: () => number): void {
  const n = state.players.length;
  const dealt = cardsDealtForRound(state.round, state.config.maxRounds);
  const deck = shuffle(buildDeck(state.config), rng);
  state.hands = Array.from({ length: n }, () => []);
  let i = 0;
  for (let c = 0; c < dealt; c++) {
    for (let p = 0; p < n; p++) {
      const card = deck[i++];
      if (card) state.hands[p]!.push(card);
    }
  }
  for (const hand of state.hands) {
    hand.sort(compareCards);
  }
  state.bids = Array.from({ length: n }, () => null);
  state.tricksWon = Array.from({ length: n }, () => 0);
  state.currentTrick = [];
  state.completedTricks = [];
  state.lootAlliances = [];
  state.lastTrick = null;
  state.phase = "bidding";
  state.leaderIndex = (state.dealerIndex + 1) % n;
  state.currentPlayerIndex = state.leaderIndex;
}

function compareCards(a: Card, b: Card): number {
  const order = (card: Card): [number, number, number] => {
    if (card.kind.type === "suit") {
      const suitOrder = { fish: 0, shell: 1, aurora: 2, ice: 3 };
      return [0, suitOrder[card.kind.suit], card.kind.rank];
    }
    const special: Record<string, number> = {
      escape: 1,
      loot: 2,
      mermaid: 3,
      pirate: 4,
      tigress: 5,
      king: 6,
      kraken: 7,
      whale: 8,
    };
    const idx = "index" in card.kind ? card.kind.index : 0;
    return [1, special[card.kind.type] ?? 9, idx];
  };
  const aa = order(a);
  const bb = order(b);
  return aa[0] - bb[0] || aa[1] - bb[1] || aa[2] - bb[2];
}

export function applyAction(state: GameState, action: GameAction, rng?: () => number): GameState {
  const next: GameState = structuredClone(state);
  if (action.type === "bid") bid(next, action.playerIndex, action.amount);
  else if (action.type === "play") play(next, action.playerIndex, action.cardId, action.tigressAs);
  else if (action.type === "nextRound") advanceRound(next, rng);
  return next;
}

function bid(state: GameState, playerIndex: number, amount: number): void {
  if (state.phase !== "bidding") throw new Error("现在不是竞标阶段");
  const dealt = cardsDealtForRound(state.round, state.config.maxRounds);
  if (amount < 0 || amount > dealt || !Number.isInteger(amount)) {
    throw new Error("竞标数量不合法");
  }
  if (state.bids[playerIndex] !== null) throw new Error("已经出过标了");
  state.bids[playerIndex] = amount;
  if (state.bids.every((b) => b !== null)) {
    state.phase = "playing";
    state.currentPlayerIndex = state.leaderIndex;
  }
}

function play(state: GameState, playerIndex: number, cardId: string, tigressAs?: TigressAs): void {
  if (state.phase !== "playing") throw new Error("现在不是出牌阶段");
  if (playerIndex !== state.currentPlayerIndex) throw new Error("还没轮到你");
  const hand = state.hands[playerIndex]!;
  const card = hand.find((c) => c.id === cardId);
  if (!card) throw new Error("手里没有这张牌");
  const legal = legalCards(hand, state.currentTrick);
  if (!legal.some((c) => c.id === cardId)) throw new Error("必须跟牌");
  if (needsTigressChoice(card) && tigressAs !== "pirate" && tigressAs !== "escape") {
    throw new Error("条纹企鹅需要选择探险或滑走");
  }

  state.hands[playerIndex] = hand.filter((c) => c.id !== cardId);
  state.currentTrick.push({
    playerIndex,
    card,
    tigressAs: card.kind.type === "tigress" ? tigressAs : undefined,
  });

  if (state.currentTrick.length < state.players.length) {
    state.currentPlayerIndex = (playerIndex + 1) % state.players.length;
    return;
  }

  const result = resolveTrick(state.currentTrick);
  state.completedTricks.push(result);
  state.lastTrick = result;
  state.lootAlliances.push(...result.lootAlliances);
  if (result.winnerIndex !== null) {
    state.tricksWon[result.winnerIndex]! += 1;
  }
  state.currentTrick = [];

  const cardsLeft = state.hands[0]!.length;
  if (cardsLeft === 0) {
    finishRound(state);
    return;
  }
  state.leaderIndex = result.nextLeaderIndex;
  state.currentPlayerIndex = result.nextLeaderIndex;
}

function finishRound(state: GameState): void {
  const dealt = cardsDealtForRound(state.round, state.config.maxRounds);
  const captured: BonusDetail[][] = state.players.map(() => []);
  for (const trick of state.completedTricks) {
    if (trick.winnerIndex === null) continue;
    captured[trick.winnerIndex]!.push(...trick.bonuses);
  }

  for (let i = 0; i < state.players.length; i++) {
    const bidAmt = state.bids[i] ?? 0;
    const tricks = state.tricksWon[i] ?? 0;
    let lootBonus = 0;
    if (bidAmt === tricks) {
      for (const alliance of state.lootAlliances) {
        const partner =
          alliance.capturerIndex === i ? alliance.lootPlayerIndex : alliance.lootPlayerIndex === i ? alliance.capturerIndex : -1;
        if (partner < 0) continue;
        if (state.bids[partner] === state.tricksWon[partner]) lootBonus += 20;
      }
    }
    const scored = scoreRound({
      round: state.round,
      cardsDealt: dealt,
      bid: bidAmt,
      tricks,
      capturedBonuses: captured[i]!,
      lootBonus,
    });
    const row: RoundScore = {
      round: state.round,
      cardsDealt: dealt,
      bid: bidAmt,
      tricks,
      bidPoints: scored.bidPoints,
      bonus: scored.bonus,
      total: scored.total,
    };
    state.history[i]!.push(row);
    state.scores[i] = (state.scores[i] ?? 0) + scored.total;
  }

  if (state.round >= state.config.maxRounds) {
    state.phase = "gameEnd";
    const best = Math.max(...state.scores);
    state.winnerIndices = state.scores
      .map((score, i) => (score === best ? i : -1))
      .filter((i) => i >= 0);
  } else {
    state.phase = "roundEnd";
  }
}

function advanceRound(state: GameState, rng?: () => number): void {
  if (state.phase !== "roundEnd") throw new Error("这一轮还没结束");
  state.round += 1;
  state.dealerIndex = (state.dealerIndex + 1) % state.players.length;
  dealRound(state, rng);
}

export function nextAiActorIndex(state: GameState): number | null {
  if (state.phase === "bidding") {
    const i = state.bids.findIndex((b, idx) => b === null && state.players[idx]?.type === "ai");
    return i >= 0 ? i : null;
  }
  if (state.phase === "playing") {
    return state.players[state.currentPlayerIndex]?.type === "ai" ? state.currentPlayerIndex : null;
  }
  return null;
}

export function toClientView(state: GameState, you: number): ClientView {
  const bidsRevealed = state.phase !== "bidding" || state.bids.every((b) => b !== null);
  const hand = state.hands[you] ?? [];
  const legal = state.phase === "playing" && you === state.currentPlayerIndex
    ? legalCards(hand, state.currentTrick)
    : [];

  const players: PublicPlayerView[] = state.players.map((player, i) => ({
    id: player.id,
    name: player.name,
    type: player.type,
    connected: player.connected,
    handCount: state.hands[i]!.length,
    bid: bidsRevealed ? state.bids[i] ?? null : i === you ? state.bids[i] ?? null : null,
    tricksWon: state.tricksWon[i] ?? 0,
    score: state.scores[i] ?? 0,
    lastRoundScore: state.history[i]?.at(-1) ?? null,
  }));

  return {
    you,
    config: state.config,
    players,
    phase: state.phase,
    round: state.round,
    cardsDealt: cardsDealtForRound(state.round, state.config.maxRounds),
    dealerIndex: state.dealerIndex,
    leaderIndex: state.leaderIndex,
    currentPlayerIndex: state.currentPlayerIndex,
    hand,
    legalCardIds: legal.map((c) => c.id),
    bidsRevealed,
    currentTrick: state.currentTrick,
    lastTrick: state.lastTrick,
    completedTrickCount: state.completedTricks.length,
    winnerIndices: state.winnerIndices,
    yourLastRound: state.history[you]?.at(-1) ?? null,
    thinkingPlayerIndex: nextAiActorIndex(state),
  };
}
