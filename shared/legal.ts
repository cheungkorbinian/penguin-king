import type { Card, PlayedCard, Suit } from "./types.ts";

export type EffectiveKind =
  | { type: "suit"; suit: Suit; rank: number }
  | { type: "pirate" }
  | { type: "mermaid" }
  | { type: "king" }
  | { type: "escape" }
  | { type: "kraken" }
  | { type: "whale" }
  | { type: "loot" };

export function effectiveKind(play: PlayedCard): EffectiveKind {
  const { kind } = play.card;
  if (kind.type === "tigress") {
    return play.tigressAs === "pirate" ? { type: "pirate" } : { type: "escape" };
  }
  if (kind.type === "suit") return { type: "suit", suit: kind.suit, rank: kind.rank };
  if (kind.type === "pirate") return { type: "pirate" };
  if (kind.type === "mermaid") return { type: "mermaid" };
  if (kind.type === "king") return { type: "king" };
  if (kind.type === "escape") return { type: "escape" };
  if (kind.type === "kraken") return { type: "kraken" };
  if (kind.type === "whale") return { type: "whale" };
  return { type: "loot" };
}

export function isEscapeLike(kind: EffectiveKind): boolean {
  return kind.type === "escape" || kind.type === "loot";
}

export function isCharacterLead(kind: EffectiveKind): boolean {
  return (
    kind.type === "pirate" ||
    kind.type === "mermaid" ||
    kind.type === "king" ||
    kind.type === "kraken" ||
    kind.type === "whale"
  );
}

/** First numbered card after leading escapes/loot sets the suit. Characters mean no suit. */
export function getLeadSuit(trick: PlayedCard[]): Suit | null {
  for (const play of trick) {
    const kind = effectiveKind(play);
    if (isEscapeLike(kind)) continue;
    if (isCharacterLead(kind)) return null;
    if (kind.type === "suit") return kind.suit;
  }
  return null;
}

export function isSpecialCard(card: Card): boolean {
  return card.kind.type !== "suit";
}

export function legalCards(hand: Card[], trick: PlayedCard[]): Card[] {
  if (trick.length === 0) return hand.slice();
  const leadSuit = getLeadSuit(trick);
  if (leadSuit === null) return hand.slice();
  const matching = hand.filter((card) => card.kind.type === "suit" && card.kind.suit === leadSuit);
  if (matching.length === 0) return hand.slice();
  return hand.filter((card) => isSpecialCard(card) || (card.kind.type === "suit" && card.kind.suit === leadSuit));
}

export function needsTigressChoice(card: Card): boolean {
  return card.kind.type === "tigress";
}
