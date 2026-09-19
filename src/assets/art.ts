import type { Card, Suit } from "../../shared/types.ts";
import avatar0 from "./art/avatars/avatar-0.png";
import avatar1 from "./art/avatars/avatar-1.png";
import avatar2 from "./art/avatars/avatar-2.png";
import avatar3 from "./art/avatars/avatar-3.png";
import avatar4 from "./art/avatars/avatar-4.png";
import avatar5 from "./art/avatars/avatar-5.png";
import backArt from "./art/card-back.png";
import escapeArt from "./art/special-escape.png";
import kingArt from "./art/special-king.png";
import krakenArt from "./art/special-kraken.png";
import lootArt from "./art/special-loot.png";
import mermaid0 from "./art/mermaid-0.png";
import mermaid1 from "./art/mermaid-1.png";
import pirate0 from "./art/pirate-0.png";
import pirate1 from "./art/pirate-1.png";
import pirate2 from "./art/pirate-2.png";
import pirate3 from "./art/pirate-3.png";
import pirate4 from "./art/pirate-4.png";
import tigressArt from "./art/special-tigress.png";
import whaleArt from "./art/special-whale.png";

const PIRATES = [pirate0, pirate1, pirate2, pirate3, pirate4];
const MERMAIDS = [mermaid0, mermaid1];
export const SEAT_AVATARS = [avatar0, avatar1, avatar2, avatar3, avatar4, avatar5];

const numberedArts = import.meta.glob("./art/ranks/*.png", {
  eager: true,
  import: "default",
}) as Record<string, string>;

export const CARD_BACK_ART = backArt;

export function numberedArt(suit: Suit, rank: number): string {
  return numberedArts[`./art/ranks/${suit}-${rank}.png`] ?? numberedArts[`./art/ranks/${suit}-1.png`] ?? "";
}

export function artFor(card: Card): string {
  const { kind } = card;
  switch (kind.type) {
    case "suit":
      return numberedArt(kind.suit, kind.rank);
    case "pirate":
      return PIRATES[kind.index] ?? pirate0;
    case "mermaid":
      return MERMAIDS[kind.index] ?? mermaid0;
    case "king":
      return kingArt;
    case "tigress":
      return tigressArt;
    case "escape":
      return escapeArt;
    case "kraken":
      return krakenArt;
    case "whale":
      return whaleArt;
    case "loot":
      return lootArt;
  }
}
