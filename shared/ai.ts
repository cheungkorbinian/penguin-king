import { applyAction, nextAiActorIndex } from "./engine.ts";
import { getLeadSuit, legalCards, needsTigressChoice } from "./legal.ts";
import { resolveTrick } from "./scoring.ts";
import { chooseBidHard, choosePlayHard } from "./aiHard.ts";
import type { AiDifficulty, Card, GameState, PlayedCard, TigressAs } from "./types.ts";
import { normalizeAiDifficulty } from "./types.ts";

function difficultyOf(state: GameState): AiDifficulty {
  return normalizeAiDifficulty(state.config.aiDifficulty);
}

function cardPower(card: Card): number {
  const { kind } = card;
  if (kind.type === "king") return 96;
  if (kind.type === "pirate") return 82;
  if (kind.type === "tigress") return 80;
  if (kind.type === "mermaid") return 70;
  if (kind.type === "kraken") return 40;
  if (kind.type === "whale") return 38;
  if (kind.type === "loot") return 4;
  if (kind.type === "escape") return 2;
  if (kind.type === "suit") {
    if (kind.suit === "ice") return 50 + kind.rank;
    return 10 + kind.rank + (kind.rank >= 12 ? 6 : 0);
  }
  return 10;
}

function isPrecious(card: Card): boolean {
  const { kind } = card;
  if (kind.type === "king" || kind.type === "pirate" || kind.type === "tigress" || kind.type === "mermaid") return true;
  if (kind.type === "suit" && kind.suit === "ice" && kind.rank >= 12) return true;
  if (kind.type === "suit" && kind.rank === 14) return true;
  return false;
}

export function chooseBid(state: GameState, playerIndex: number): number {
  const difficulty = difficultyOf(state);
  if (difficulty === "hard") return chooseBidHard(state, playerIndex);
  if (difficulty === "sharp") return chooseBidSharp(state, playerIndex);
  return chooseBidEasy(state, playerIndex);
}

function chooseBidEasy(state: GameState, playerIndex: number): number {
  const hand = state.hands[playerIndex] ?? [];
  const n = state.players.length;
  let expected = 0;
  for (const card of hand) {
    const p = cardPower(card);
    if (p >= 90) expected += 0.92;
    else if (p >= 80) expected += 0.72 - n * 0.04;
    else if (p >= 70) expected += 0.48;
    else if (p >= 60) expected += 0.55;
    else if (p >= 50) expected += 0.28 + (p - 50) * 0.03;
    else if (p >= 22) expected += 0.08;
  }
  const dealt = hand.length;
  return Math.max(0, Math.min(dealt, Math.round(expected)));
}

function chooseBidSharp(state: GameState, playerIndex: number): number {
  const hand = state.hands[playerIndex] ?? [];
  const n = state.players.length;
  let expected = 0;
  for (const card of hand) {
    const { kind } = card;
    if (kind.type === "king") expected += 0.94;
    else if (kind.type === "pirate") expected += Math.max(0.4, 0.76 - n * 0.05);
    else if (kind.type === "tigress") expected += Math.max(0.36, 0.68 - n * 0.05);
    else if (kind.type === "mermaid") expected += 0.36;
    else if (kind.type === "suit" && kind.suit === "ice") {
      if (kind.rank === 14) expected += 0.7;
      else if (kind.rank >= 10) expected += 0.34 + (kind.rank - 10) * 0.06;
      else expected += 0.1 + kind.rank * 0.018;
    } else if (kind.type === "suit") {
      if (kind.rank === 14) expected += 0.3;
      else if (kind.rank >= 12) expected += 0.12;
      else expected += 0.02;
    }
  }
  const dealt = hand.length;
  if (expected < 0.42) return 0;
  return Math.max(0, Math.min(dealt, Math.round(expected)));
}

function tigressChoice(wantWin: boolean): TigressAs {
  return wantWin ? "pirate" : "escape";
}

function asPlay(playerIndex: number, card: Card, wantWin: boolean): PlayedCard {
  return {
    playerIndex,
    card,
    tigressAs: needsTigressChoice(card) ? tigressChoice(wantWin) : undefined,
  };
}

function winsNow(trick: PlayedCard[], candidate: PlayedCard): boolean {
  const result = resolveTrick([...trick, candidate]);
  return result.winnerIndex === candidate.playerIndex;
}

function pickCard(card: Card, win: boolean): { cardId: string; tigressAs?: TigressAs } {
  return {
    cardId: card.id,
    tigressAs: needsTigressChoice(card) ? tigressChoice(win) : undefined,
  };
}

export function choosePlay(
  state: GameState,
  playerIndex: number,
): { cardId: string; tigressAs?: TigressAs } {
  const difficulty = difficultyOf(state);
  if (difficulty === "hard") return choosePlayHard(state, playerIndex);
  if (difficulty === "sharp") return choosePlaySharp(state, playerIndex);
  return choosePlayEasy(state, playerIndex);
}

function choosePlayEasy(
  state: GameState,
  playerIndex: number,
): { cardId: string; tigressAs?: TigressAs } {
  const hand = state.hands[playerIndex] ?? [];
  const legal = legalCards(hand, state.currentTrick);
  const bid = state.bids[playerIndex] ?? 0;
  const won = state.tricksWon[playerIndex] ?? 0;
  const remaining = hand.length;
  const need = bid - won;
  const wantWin = need > 0 && need >= remaining - 0.01;
  const avoidWin = need <= 0;
  const opportunistic = need > 0 && !wantWin;

  const trick = state.currentTrick;
  const lastToPlay = trick.length === state.players.length - 1;
  const leadSuit = getLeadSuit(trick);
  const ranked = legal.slice().sort((a, b) => cardPower(a) - cardPower(b));

  if (trick.length === 0) {
    if (avoidWin) {
      const escape = ranked.find((c) => c.kind.type === "escape" || c.kind.type === "loot" || c.kind.type === "tigress");
      if (escape) return pickCard(escape, false);
      return pickCard(ranked[0]!, false);
    }
    if (wantWin) {
      const king = ranked.find((c) => c.kind.type === "king");
      if (king) return pickCard(king, true);
      const pirate = ranked.find((c) => c.kind.type === "pirate" || c.kind.type === "tigress");
      if (pirate) return pickCard(pirate, true);
      return pickCard(ranked[ranked.length - 1]!, true);
    }
    const mid = ranked[Math.floor(ranked.length / 2)] ?? ranked[0]!;
    return pickCard(mid, opportunistic);
  }

  const winningPlays = ranked.filter((card) => winsNow(trick, asPlay(playerIndex, card, true)));
  const losingPlays = ranked.filter((card) => !winsNow(trick, asPlay(playerIndex, card, false)));

  if (lastToPlay) {
    if (avoidWin) {
      const safe = losingPlays[losingPlays.length - 1] ?? ranked[0]!;
      return pickCard(safe, false);
    }
    if (winningPlays.length > 0) return pickCard(winningPlays[0]!, true);
    return pickCard(ranked[0]!, false);
  }

  if (avoidWin) {
    const dump = (losingPlays.length ? losingPlays : ranked).at(-1) ?? ranked[0]!;
    return pickCard(dump, false);
  }

  if (winningPlays.length > 0 && (wantWin || opportunistic)) {
    const cheap = winningPlays[0]!;
    if (leadSuit && cheap.kind.type === "suit" && cheap.kind.suit === leadSuit && cheap.kind.rank <= 10 && !wantWin) {
      return pickCard(cheap, true);
    }
    if (wantWin) return pickCard(winningPlays[0]!, true);
    if (cheap.kind.type === "suit") return pickCard(cheap, true);
  }

  return pickCard(ranked[0]!, false);
}

function choosePlaySharp(
  state: GameState,
  playerIndex: number,
): { cardId: string; tigressAs?: TigressAs } {
  const hand = state.hands[playerIndex] ?? [];
  const legal = legalCards(hand, state.currentTrick);
  const bid = state.bids[playerIndex] ?? 0;
  const won = state.tricksWon[playerIndex] ?? 0;
  const remaining = hand.length;
  const need = bid - won;
  const mustWinRest = need > 0 && need >= remaining;
  const avoidWin = need <= 0;
  const opportunistic = need > 0 && !mustWinRest;

  const trick = state.currentTrick;
  const lastToPlay = trick.length === state.players.length - 1;
  const ranked = legal.slice().sort((a, b) => cardPower(a) - cardPower(b));
  const cheapestWinner = (wins: Card[]) => wins.find((c) => !isPrecious(c)) ?? wins[0]!;

  if (trick.length === 0) {
    if (avoidWin) {
      const escape = ranked.find((c) => c.kind.type === "escape" || c.kind.type === "loot");
      if (escape) return pickCard(escape, false);
      const tigress = ranked.find((c) => c.kind.type === "tigress");
      if (tigress) return pickCard(tigress, false);
      return pickCard(ranked[0]!, false);
    }
    if (mustWinRest) {
      const strong = [...ranked].reverse().find((c) => isPrecious(c)) ?? ranked[ranked.length - 1]!;
      return pickCard(strong, true);
    }
    const lead = [...ranked].reverse().find((c) => !isPrecious(c)) ?? ranked[Math.floor(ranked.length / 2)] ?? ranked[0]!;
    return pickCard(lead, opportunistic);
  }

  const winningPlays = ranked.filter((card) => winsNow(trick, asPlay(playerIndex, card, true)));
  const losingPlays = ranked.filter((card) => !winsNow(trick, asPlay(playerIndex, card, false)));

  if (lastToPlay) {
    if (avoidWin) {
      const safe = losingPlays[losingPlays.length - 1] ?? ranked[0]!;
      return pickCard(safe, false);
    }
    if (winningPlays.length > 0) return pickCard(cheapestWinner(winningPlays), true);
    return pickCard(ranked[0]!, false);
  }

  if (avoidWin) {
    const dump = (losingPlays.length ? losingPlays : ranked).at(-1) ?? ranked[0]!;
    return pickCard(dump, false);
  }

  if (winningPlays.length > 0) {
    const cheap = cheapestWinner(winningPlays);
    if (mustWinRest) return pickCard(cheap, true);
    if (opportunistic && !isPrecious(cheap)) return pickCard(cheap, true);
  }

  return pickCard(ranked[0]!, false);
}

export function aiThinkMs(state: GameState, rand = Math.random): number {
  const idx = nextAiActorIndex(state);
  if (idx === null) return 0;
  const difficulty = difficultyOf(state);
  if (state.phase === "bidding") {
    if (difficulty === "hard") return Math.round(1080 + rand() * 920);
    if (difficulty === "sharp") return Math.round(820 + rand() * 680);
    return Math.round(520 + rand() * 380);
  }
  const cards = state.hands[idx]?.length ?? 1;
  if (difficulty === "hard") {
    return Math.round(1180 + Math.min(cards, 10) * 90 + rand() * 720);
  }
  const scan = Math.min(cards, 10) * (difficulty === "sharp" ? 70 : 45);
  const base = difficulty === "sharp" ? 980 : 680;
  const jitter = rand() * (difficulty === "sharp" ? 520 : 360);
  return Math.round(base + scan + jitter);
}

export function stepAi(state: GameState, rng?: () => number): GameState {
  const idx = nextAiActorIndex(state);
  if (idx === null) return state;
  if (state.phase === "bidding") {
    return applyAction(state, { type: "bid", playerIndex: idx, amount: chooseBid(state, idx) }, rng);
  }
  if (state.phase === "playing") {
    const choice = choosePlay(state, idx);
    return applyAction(state, {
      type: "play",
      playerIndex: idx,
      cardId: choice.cardId,
      tigressAs: choice.tigressAs,
    }, rng);
  }
  return state;
}

export function runAiUntilHuman(state: GameState, rng?: () => number): GameState {
  let current = state;
  for (let guard = 0; guard < 400; guard++) {
    if (current.phase === "bidding") {
      const pending = current.bids
        .map((b, i) => (b === null && current.players[i]?.type === "ai" ? i : -1))
        .filter((i) => i >= 0);
      if (pending.length === 0) break;
      for (const i of pending) {
        current = applyAction(current, { type: "bid", playerIndex: i, amount: chooseBid(current, i) }, rng);
      }
      continue;
    }
    if (current.phase === "playing") {
      const actor = current.players[current.currentPlayerIndex];
      if (!actor || actor.type !== "ai") break;
      const choice = choosePlay(current, current.currentPlayerIndex);
      current = applyAction(
        current,
        {
          type: "play",
          playerIndex: current.currentPlayerIndex,
          cardId: choice.cardId,
          tigressAs: choice.tigressAs,
        },
        rng,
      );
      continue;
    }
    if (current.phase === "collecting") break;
    break;
  }
  return current;
}

export function currentLeadSuitLabel(trick: PlayedCard[]): string | null {
  return getLeadSuit(trick);
}
