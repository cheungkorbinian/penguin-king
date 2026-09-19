import type { Card, GameConfig, Suit } from "./types.ts";

const SUITS: Suit[] = ["fish", "shell", "aurora", "ice"];

export function buildDeck(config: GameConfig): Card[] {
  const cards: Card[] = [];

  for (const suit of SUITS) {
    for (let rank = 1; rank <= 14; rank++) {
      cards.push({ id: `${suit}-${rank}`, kind: { type: "suit", suit, rank } });
    }
  }

  for (let i = 0; i < 5; i++) {
    cards.push({ id: `pirate-${i}`, kind: { type: "pirate", index: i } });
  }
  cards.push({ id: "tigress", kind: { type: "tigress" } });
  cards.push({ id: "king", kind: { type: "king" } });
  for (let i = 0; i < 2; i++) {
    cards.push({ id: `mermaid-${i}`, kind: { type: "mermaid", index: i } });
  }
  for (let i = 0; i < 5; i++) {
    cards.push({ id: `escape-${i}`, kind: { type: "escape", index: i } });
  }

  if (config.expansion) {
    cards.push({ id: "kraken", kind: { type: "kraken" } });
    cards.push({ id: "whale", kind: { type: "whale" } });
    for (let i = 0; i < 2; i++) {
      cards.push({ id: `loot-${i}`, kind: { type: "loot", index: i } });
    }
  }

  return cards;
}

export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const next = items.slice();
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = next[i]!;
    const b = next[j]!;
    next[i] = b;
    next[j] = a;
  }
  return next;
}
