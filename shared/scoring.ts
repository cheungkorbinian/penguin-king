import { effectiveKind, getLeadSuit, isEscapeLike } from "./legal.ts";
import type { BonusDetail, PlayedCard, TrickResult } from "./types.ts";

function firstOf(
  plays: PlayedCard[],
  pred: (play: PlayedCard) => boolean,
): PlayedCard | undefined {
  return plays.find(pred);
}

function beastEffect(plays: PlayedCard[]): "kraken" | "whale" | null {
  let last: "kraken" | "whale" | null = null;
  for (const play of plays) {
    const kind = effectiveKind(play);
    if (kind.type === "kraken" || kind.type === "whale") last = kind.type;
  }
  return last;
}

function compareRank(a: number, b: number): number {
  return a - b;
}

function numberedWinner(plays: PlayedCard[]): PlayedCard | undefined {
  const leadSuit = getLeadSuit(plays);
  const numbered = plays.filter((play) => effectiveKind(play).type === "suit");
  if (numbered.length === 0) return undefined;

  const trumps = numbered.filter((play) => {
    const kind = effectiveKind(play);
    return kind.type === "suit" && kind.suit === "ice";
  });
  const pool = trumps.length > 0 ? trumps : numbered.filter((play) => {
    const kind = effectiveKind(play);
    return kind.type === "suit" && kind.suit === leadSuit;
  });
  if (pool.length === 0) return numbered[0];

  return pool.reduce((best, play) => {
    const bestKind = effectiveKind(best);
    const playKind = effectiveKind(play);
    const bestRank = bestKind.type === "suit" ? bestKind.rank : 0;
    const playRank = playKind.type === "suit" ? playKind.rank : 0;
    return compareRank(playRank, bestRank) > 0 ? play : best;
  });
}

function whaleWinner(plays: PlayedCard[]): { winner: PlayedCard | null; whalePlayer: number } {
  const whale = plays.find((play) => effectiveKind(play).type === "whale");
  const whalePlayer = whale?.playerIndex ?? 0;
  const numbered = plays.filter((play) => effectiveKind(play).type === "suit");
  if (numbered.length === 0) return { winner: null, whalePlayer };

  return {
    whalePlayer,
    winner: numbered.reduce((best, play) => {
      const bestKind = effectiveKind(best);
      const playKind = effectiveKind(play);
      const bestRank = bestKind.type === "suit" ? bestKind.rank : 0;
      const playRank = playKind.type === "suit" ? playKind.rank : 0;
      if (playRank > bestRank) return play;
      return best;
    }),
  };
}

function normalWinner(plays: PlayedCard[]): PlayedCard {
  const mermaid = firstOf(plays, (p) => effectiveKind(p).type === "mermaid");
  const king = firstOf(plays, (p) => effectiveKind(p).type === "king");
  const pirate = firstOf(plays, (p) => effectiveKind(p).type === "pirate");

  if (mermaid && king) return mermaid;
  if (king) return king;
  if (pirate) return pirate;
  if (mermaid) return mermaid;

  const numberWin = numberedWinner(plays);
  if (numberWin) return numberWin;
  return plays[0]!;
}

function bonusesForWinner(plays: PlayedCard[], winner: PlayedCard): BonusDetail[] {
  const bonuses: BonusDetail[] = [];
  const winKind = effectiveKind(winner);

  for (const play of plays) {
    const kind = effectiveKind(play);
    if (kind.type === "suit" && kind.rank === 14) {
      const points = kind.suit === "ice" ? 20 : 10;
      bonuses.push({
        kind: "fourteen",
        points,
        label: kind.suit === "ice" ? "冰山 14" : "花色 14",
      });
    }
  }

  if (winKind.type === "pirate") {
    const mermaids = plays.filter((p) => effectiveKind(p).type === "mermaid").length;
    for (let i = 0; i < mermaids; i++) {
      bonuses.push({ kind: "mermaidByPirate", points: 20, label: "探险企鹅俘获人鱼" });
    }
  }

  if (winKind.type === "king") {
    const pirates = plays.filter((p) => effectiveKind(p).type === "pirate").length;
    for (let i = 0; i < pirates; i++) {
      bonuses.push({ kind: "pirateByKing", points: 30, label: "企鹅王俘获探险企鹅" });
    }
  }

  if (winKind.type === "mermaid" && plays.some((p) => effectiveKind(p).type === "king")) {
    bonuses.push({ kind: "kingByMermaid", points: 40, label: "人鱼企鹅俘获企鹅王" });
  }

  return bonuses;
}

function lootAlliances(
  plays: PlayedCard[],
  winnerIndex: number | null,
): { lootPlayerIndex: number; capturerIndex: number }[] {
  if (winnerIndex === null) return [];
  const alliances: { lootPlayerIndex: number; capturerIndex: number }[] = [];
  for (const play of plays) {
    if (effectiveKind(play).type !== "loot") continue;
    if (play.playerIndex === winnerIndex) continue;
    alliances.push({ lootPlayerIndex: play.playerIndex, capturerIndex: winnerIndex });
  }
  return alliances;
}

export function resolveTrick(plays: PlayedCard[]): TrickResult {
  const beast = beastEffect(plays);

  if (beast === "kraken") {
    const without = plays.filter((p) => effectiveKind(p).type !== "kraken");
    const wouldWin = without.length === 0 ? plays[0]! : normalWinner(without);
    return {
      winnerIndex: null,
      nextLeaderIndex: wouldWin.playerIndex,
      bonuses: [],
      lootAlliances: [],
      destroyed: true,
      cards: plays,
    };
  }

  if (beast === "whale") {
    const { winner, whalePlayer } = whaleWinner(plays);
    if (!winner) {
      return {
        winnerIndex: null,
        nextLeaderIndex: whalePlayer,
        bonuses: [],
        lootAlliances: [],
        destroyed: true,
        cards: plays,
      };
    }
    return {
      winnerIndex: winner.playerIndex,
      nextLeaderIndex: winner.playerIndex,
      bonuses: bonusesForWinner(plays, winner),
      lootAlliances: lootAlliances(plays, winner.playerIndex),
      destroyed: false,
      cards: plays,
    };
  }

  const winner = normalWinner(plays);
  return {
    winnerIndex: winner.playerIndex,
    nextLeaderIndex: winner.playerIndex,
    bonuses: bonusesForWinner(plays, winner),
    lootAlliances: lootAlliances(plays, winner.playerIndex),
    destroyed: false,
    cards: plays,
  };
}

export function scoreRound(args: {
  round: number;
  cardsDealt: number;
  bid: number;
  tricks: number;
  capturedBonuses: BonusDetail[];
  lootBonus: number;
}): { bidPoints: number; bonus: number; total: number } {
  const { cardsDealt, bid, tricks, capturedBonuses, lootBonus } = args;
  const hit = bid === tricks;
  let bidPoints = 0;
  if (bid === 0) {
    bidPoints = tricks === 0 ? 10 * cardsDealt : -10 * cardsDealt;
  } else if (hit) {
    bidPoints = 20 * tricks;
  } else {
    bidPoints = -10 * Math.abs(bid - tricks);
  }

  const bonus = hit ? capturedBonuses.reduce((sum, b) => sum + b.points, 0) + lootBonus : 0;
  return { bidPoints, bonus, total: bidPoints + bonus };
}

export function isEscapeOnlyTrick(plays: PlayedCard[]): boolean {
  return plays.every((p) => isEscapeLike(effectiveKind(p)));
}
