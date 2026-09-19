import { buildDeck, shuffle } from "./deck.ts";
import { legalCards, needsTigressChoice } from "./legal.ts";
import { resolveTrick } from "./scoring.ts";
import type { Card, GameState, PlayedCard, TigressAs, TrickResult } from "./types.ts";

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

function asPlay(playerIndex: number, card: Card, tigressAs?: TigressAs): PlayedCard {
  return {
    playerIndex,
    card,
    tigressAs: card.kind.type === "tigress" ? tigressAs ?? "escape" : undefined,
  };
}

function winsNow(trick: PlayedCard[], candidate: PlayedCard): boolean {
  return resolveTrick([...trick, candidate]).winnerIndex === candidate.playerIndex;
}

function spendCost(card: Card): number {
  const { kind } = card;
  if (kind.type === "king") return 30;
  if (kind.type === "mermaid") return 22;
  if (kind.type === "pirate") return 18;
  if (kind.type === "tigress") return 16;
  if (kind.type === "kraken") return 15;
  if (kind.type === "whale") return 13;
  if (kind.type === "suit" && kind.suit === "ice") return kind.rank >= 12 ? 12 : 5 + kind.rank * 0.25;
  if (kind.type === "suit" && kind.rank === 14) return 12;
  if (kind.type === "suit") return kind.rank * 0.18;
  return 2;
}

function countKind(cards: Card[], type: Card["kind"]["type"]): number {
  return cards.filter((card) => card.kind.type === type).length;
}

export function expectedTricksInHand(hand: Card[], playerCount: number, unseen?: Card[]): number {
  const n = Math.max(2, playerCount);
  const crowd = Math.max(0, n - 3);
  const ice = hand
    .filter((card) => card.kind.type === "suit" && card.kind.suit === "ice")
    .map((card) => (card.kind.type === "suit" ? card.kind.rank : 0))
    .sort((a, b) => b - a);
  const suitRanks = {
    fish: [] as number[],
    shell: [] as number[],
    aurora: [] as number[],
  };
  for (const card of hand) {
    if (card.kind.type !== "suit" || card.kind.suit === "ice") continue;
    suitRanks[card.kind.suit].push(card.kind.rank);
  }
  const voids = (["fish", "shell", "aurora"] as const).filter((suit) => suitRanks[suit].length === 0).length;
  const king = countKind(hand, "king") > 0;
  const mermaids = countKind(hand, "mermaid");
  const pirates = countKind(hand, "pirate");
  const tigress = countKind(hand, "tigress") > 0;
  const unseenMermaids = unseen ? countKind(unseen, "mermaid") : Math.max(0, 2 - mermaids);
  const unseenPirates = unseen
    ? countKind(unseen, "pirate") + countKind(unseen, "tigress")
    : Math.max(0, 5 - pirates) + (tigress ? 0 : 1);
  const unseenKing = unseen ? countKind(unseen, "king") > 0 : !king;

  let expected = 0;
  if (king) {
    expected += Math.max(0.78, 0.98 - unseenMermaids * 0.08 - crowd * 0.02);
  }
  for (let i = 0; i < mermaids; i++) {
    expected += king && i === 0
      ? 0.22
      : Math.max(0.16, 0.48 - unseenPirates * 0.04 - crowd * 0.03);
  }
  const pirateLike = pirates + (tigress ? 1 : 0);
  for (let i = 0; i < pirateLike; i++) {
    const kingRisk = unseenKing ? 0.08 + crowd * 0.025 : 0;
    expected += Math.max(0.32, 0.84 - kingRisk - i * 0.07 - crowd * 0.04);
  }
  ice.forEach((rank, index) => {
    if (rank === 14) expected += Math.max(0.62, 0.9 - crowd * 0.04);
    else if (rank >= 12) expected += Math.max(0.22, 0.5 + (rank - 12) * 0.08 - index * 0.06 - crowd * 0.02);
    else if (rank >= 9) expected += Math.max(0.08, 0.24 + (rank - 9) * 0.03 - index * 0.03);
    else expected += Math.max(0.03, 0.09 - index * 0.012);
  });
  if (ice.length >= 4) expected += 0.28 * (ice.length - 3);
  if (voids > 0 && ice.length > 0) expected += 0.14 * voids * Math.min(ice.length, 3);

  for (const suit of ["fish", "shell", "aurora"] as const) {
    const ranks = suitRanks[suit];
    if (ranks.includes(14)) {
      expected += Math.max(0.14, 0.42 - crowd * 0.04);
    } else if (ranks.includes(13)) {
      expected += 0.08;
    }
  }
  if (countKind(hand, "whale") > 0) expected += 0.2;
  return expected;
}

function forcedWinners(hand: Card[]): number {
  let forced = 0;
  if (countKind(hand, "king") > 0) forced += 1;
  forced += countKind(hand, "pirate");
  if (countKind(hand, "tigress") > 0) forced += 0.45;
  forced += countKind(hand, "mermaid") * 0.25;
  for (const card of hand) {
    if (card.kind.type === "suit" && card.kind.suit === "ice" && card.kind.rank >= 13) forced += 0.7;
    else if (card.kind.type === "suit" && card.kind.rank === 14) forced += 0.2;
  }
  return forced;
}

export function chooseBidHard(state: GameState, playerIndex: number): number {
  const hand = state.hands[playerIndex] ?? [];
  const dealt = hand.length;
  const unseen = unseenCards(state, playerIndex);
  const expected = Math.max(
    forcedWinners(hand) * 0.85,
    expectedTricksInHand(hand, state.players.length, unseen),
  );
  if (dealt <= 1) return expected >= 0.5 ? 1 : 0;
  if (expected < 0.3) return 0;
  return Math.max(0, Math.min(dealt, Math.round(expected + 0.18)));
}

function unseenCards(state: GameState, me: number): Card[] {
  const seen = new Set((state.hands[me] ?? []).map((card) => card.id));
  for (const trick of state.completedTricks) {
    for (const play of trick.cards) seen.add(play.card.id);
  }
  for (const play of state.currentTrick) seen.add(play.card.id);
  return buildDeck(state.config).filter((card) => !seen.has(card.id));
}

function playersAfterMe(state: GameState, me: number): number[] {
  const left = state.players.length - state.currentTrick.length - 1;
  const after: number[] = [];
  for (let i = 1; i <= left; i++) after.push((me + i) % state.players.length);
  return after;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFor(state: GameState, me: number): number {
  let hash = 2166136261 ^ (state.round * 374761393) ^ (me * 668265263) ^ (state.completedTricks.length << 9);
  const mix = (text: string) => {
    for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  };
  for (const card of state.hands[me] ?? []) mix(card.id);
  for (const play of state.currentTrick) mix(play.card.id);
  return hash >>> 0;
}

function greedyPlay(
  hand: Card[],
  trick: PlayedCard[],
  bid: number,
  won: number,
  playerCount: number,
  playerIndex: number,
): PlayedCard {
  const legal = legalCards(hand, trick);
  const remaining = hand.length;
  const need = bid - won;
  const mustWinRest = need > 0 && need >= remaining;
  const avoidWin = need <= 0;
  const opportunistic = need > 0 && !mustWinRest;
  const lastToPlay = trick.length === playerCount - 1;
  const ranked = legal.slice().sort((a, b) => cardPower(a) - cardPower(b));
  const cheapestWinner = (wins: Card[]) => wins.find((card) => !isPrecious(card)) ?? wins[0]!;

  if (trick.length === 0) {
    if (avoidWin) {
      const escape = ranked.find((card) => card.kind.type === "escape" || card.kind.type === "loot");
      if (escape) return asPlay(playerIndex, escape, "escape");
      const tigress = ranked.find((card) => card.kind.type === "tigress");
      if (tigress) return asPlay(playerIndex, tigress, "escape");
      return asPlay(playerIndex, ranked[0]!, "escape");
    }
    if (mustWinRest) {
      const strong = [...ranked].reverse().find((card) => isPrecious(card)) ?? ranked[ranked.length - 1]!;
      return asPlay(playerIndex, strong, "pirate");
    }
    const lead = [...ranked].reverse().find((card) => !isPrecious(card)) ?? ranked[Math.floor(ranked.length / 2)] ?? ranked[0]!;
    return asPlay(playerIndex, lead, opportunistic ? "pirate" : "escape");
  }

  const winningPlays = ranked.filter((card) => winsNow(trick, asPlay(playerIndex, card, "pirate")));
  const losingPlays = ranked.filter((card) => !winsNow(trick, asPlay(playerIndex, card, "escape")));

  if (lastToPlay) {
    if (avoidWin) {
      const safe = losingPlays[losingPlays.length - 1] ?? ranked[0]!;
      return asPlay(playerIndex, safe, "escape");
    }
    if (winningPlays.length > 0) return asPlay(playerIndex, cheapestWinner(winningPlays), "pirate");
    return asPlay(playerIndex, ranked[0]!, "escape");
  }

  if (avoidWin) {
    const dump = (losingPlays.length ? losingPlays : ranked).at(-1) ?? ranked[0]!;
    return asPlay(playerIndex, dump, "escape");
  }

  if (winningPlays.length > 0) {
    const cheap = cheapestWinner(winningPlays);
    if (mustWinRest) return asPlay(playerIndex, cheap, "pirate");
    if (opportunistic && !isPrecious(cheap)) return asPlay(playerIndex, cheap, "pirate");
  }

  return asPlay(playerIndex, ranked[0]!, "escape");
}

function dealOpponentHands(unseen: Card[], state: GameState, me: number, rng: () => number): Card[][] {
  const pile = shuffle(unseen, rng);
  const hands: Card[][] = Array.from({ length: state.players.length }, () => []);
  let index = 0;
  for (let player = 0; player < state.players.length; player++) {
    if (player === me) continue;
    const need = state.hands[player]?.length ?? 0;
    hands[player] = pile.slice(index, index + need);
    index += need;
  }
  return hands;
}

function optionPenalty(card: Card, trick: PlayedCard[], unseen: Card[], slack: boolean): number {
  if (!slack) return 0;
  const kingOut = unseen.some((item) => item.kind.type === "king") || trick.some((play) => play.card.kind.type === "king");
  const kingInTrick = trick.some((play) => play.card.kind.type === "king");
  const pirateInTrick = trick.some(
    (play) => play.card.kind.type === "pirate" || play.tigressAs === "pirate",
  );
  const piratesOut = unseen.some((item) => item.kind.type === "pirate" || item.kind.type === "tigress");
  if (card.kind.type === "mermaid" && !kingInTrick && kingOut) return 22;
  if (card.kind.type === "king" && !pirateInTrick && piratesOut) return 20;
  return 0;
}

function scoreOutcome(
  result: TrickResult,
  me: number,
  card: Card,
  bid: number,
  won: number,
  remaining: number,
  restHand: Card[],
  playerCount: number,
  trick: PlayedCard[],
  unseen: Card[],
): number {
  const win = result.winnerIndex === me;
  const took = win ? 1 : 0;
  const needBefore = bid - won;
  const needAfter = bid - (won + took);
  const leftAfter = remaining - 1;
  const future = leftAfter > 0 ? expectedTricksInHand(restHand, playerCount, unseen) : 0;
  const avoid = needBefore <= 0;
  let score = 0;

  const forcedRest = forcedWinners(restHand);
  if (needAfter < 0) score -= 160 * (1 - needAfter);
  else if (leftAfter < needAfter) score -= 120 + 80 * (needAfter - leftAfter);
  else if (needAfter === 0) {
    score += 85;
    score -= Math.max(0, future - 0.2) * 16;
  } else {
    const extraFire = future - needAfter;
    score += extraFire >= 0 ? 22 : extraFire * 28;
    score += (leftAfter - needAfter) * 4;
    if (!win && forcedRest >= needAfter - 0.15) score += 72;
  }
  if (win && won + 1 + forcedRest > bid + 0.35) {
    score -= 150 + 45 * (won + 1 + forcedRest - bid);
  }

  if (result.destroyed) {
    if (avoid) score += 58;
    else if (needBefore >= remaining) score -= 55;
  }

  const bonus = result.winnerIndex === me ? result.bonuses.reduce((sum, item) => sum + item.points, 0) : 0;
  const canHit = needAfter >= 0 && needAfter <= leftAfter;
  score += bonus * (canHit ? 0.9 : 0.12);

  score -= spendCost(card) * (win ? 0.5 : avoid ? 0.15 : 0.85);
  if (avoid && !win) score += spendCost(card) * 0.4;
  if (!win && (card.kind.type === "escape" || card.kind.type === "loot")) score += 10;

  const slack = needAfter >= 0 && leftAfter > needAfter;
  score -= optionPenalty(card, trick, unseen, slack || avoid);

  if (card.kind.type === "mermaid" && trick.some((play) => play.card.kind.type === "king")) score += 36;
  if (card.kind.type === "king" && trick.some((play) => play.card.kind.type === "pirate" || play.tigressAs === "pirate")) {
    score += 28;
  }

  return score;
}

function evaluatePlay(
  state: GameState,
  me: number,
  card: Card,
  tigressAs: TigressAs | undefined,
): number {
  const hand = state.hands[me] ?? [];
  const restHand = hand.filter((item) => item.id !== card.id);
  const unseen = unseenCards(state, me).filter((item) => item.id !== card.id);
  const bid = state.bids[me] ?? 0;
  const won = state.tricksWon[me] ?? 0;
  const remaining = hand.length;
  const n = state.players.length;
  const after = playersAfterMe(state, me);
  const myPlay = asPlay(me, card, tigressAs);
  const startTrick = [...state.currentTrick, myPlay];

  if (after.length === 0) {
    return scoreOutcome(
      resolveTrick(startTrick),
      me,
      card,
      bid,
      won,
      remaining,
      restHand,
      n,
      state.currentTrick,
      unseen,
    );
  }

  const rng = mulberry32(seedFor(state, me) ^ card.id.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0));
  const sims = Math.min(40, 18 + after.length * 6);
  let total = 0;
  for (let i = 0; i < sims; i++) {
    const oppHands = dealOpponentHands(unseen, state, me, rng).map((cards) => cards.slice());
    const trick = startTrick.slice();
    for (const player of after) {
      const held = oppHands[player] ?? [];
      if (held.length === 0) continue;
      const play = greedyPlay(
        held,
        trick,
        state.bids[player] ?? 0,
        state.tricksWon[player] ?? 0,
        n,
        player,
      );
      trick.push(play);
      oppHands[player] = held.filter((item) => item.id !== play.card.id);
    }
    total += scoreOutcome(resolveTrick(trick), me, card, bid, won, remaining, restHand, n, state.currentTrick, unseen);
  }
  return total / sims;
}

export function choosePlayHard(
  state: GameState,
  playerIndex: number,
): { cardId: string; tigressAs?: TigressAs } {
  const hand = state.hands[playerIndex] ?? [];
  const legal = legalCards(hand, state.currentTrick);
  let best: { cardId: string; tigressAs?: TigressAs } | null = null;
  let bestScore = -Infinity;

  for (const card of legal) {
    const options: (TigressAs | undefined)[] = needsTigressChoice(card) ? ["pirate", "escape"] : [undefined];
    for (const tigressAs of options) {
      const score = evaluatePlay(state, playerIndex, card, tigressAs);
      if (score > bestScore) {
        bestScore = score;
        best = { cardId: card.id, tigressAs };
      }
    }
  }

  return best ?? { cardId: legal[0]!.id };
}
