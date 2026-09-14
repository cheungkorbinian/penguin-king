import type { CSSProperties } from "react";
import type { Card, Suit } from "../../shared/types.ts";
import { artFor, CARD_BACK_ART } from "../assets/art.ts";
import {
  cardTitle,
  ESCAPE_NAMES,
  LOOT_NAMES,
  PIRATE_NAMES,
  SUIT_CARD_NAMES,
  SUIT_META,
} from "../../shared/theme.ts";

const THEME: Record<Suit, { paper: string; edge: string; ink: string }> = {
  fish: { paper: "#fffdf8", edge: "#7ec8a3", ink: "#2a5c46" },
  shell: { paper: "#fffaf1", edge: "#e8b86d", ink: "#7a4e10" },
  aurora: { paper: "#fff8fc", edge: "#d4a8d8", ink: "#5c3378" },
  ice: { paper: "#f4f6f8", edge: "#111111", ink: "#111111" },
};

export function CardFace({
  card,
  small,
  tigressAs,
}: {
  card: Card;
  small?: boolean;
  tigressAs?: "pirate" | "escape";
}) {
  const title = cardTitle(card);
  const art = artFor(card);
  const { kind } = card;

  if (kind.type === "suit") {
    const theme = THEME[kind.suit];
    const name = SUIT_CARD_NAMES[kind.suit][kind.rank - 1] ?? SUIT_META[kind.suit].name;
    return (
      <article
        className={`sk-card${small ? " is-small" : ""}${kind.rank === 14 ? " is-fourteen" : ""}${kind.suit === "ice" ? " is-ice" : ""}`}
        style={{ "--paper": theme.paper, "--edge": theme.edge, "--ink": theme.ink } as CSSProperties}
        aria-label={title}
      >
        <header className="sk-head">
          <span className="sk-chip">{kind.rank}</span>
          <span className="sk-tag">{SUIT_META[kind.suit].name}</span>
        </header>
        <div className="sk-window">
          <img src={art} alt="" draggable={false} />
        </div>
        <footer className="sk-foot">{name}</footer>
      </article>
    );
  }

  const banner = specialBanner(card, tigressAs);
  const edge =
    kind.type === "pirate"
      ? "#e08a7a"
      : kind.type === "king"
        ? "#e4b84a"
        : kind.type === "mermaid"
          ? "#7ec8c4"
          : kind.type === "tigress"
            ? "#e0a06a"
            : kind.type === "kraken"
              ? "#e09aaa"
              : kind.type === "whale"
                ? "#8bb8d4"
                : kind.type === "loot"
                  ? "#e4c46a"
                  : "#b8c0c8";

  return (
    <article
      className={`sk-card is-special${small ? " is-small" : ""}`}
      style={{ "--paper": "#fffdf8", "--edge": edge, "--ink": "#4a3728" } as CSSProperties}
      aria-label={title}
    >
      <div className="sk-window">
        <img src={art} alt="" draggable={false} />
      </div>
      <footer className="sk-foot">
        <strong>{banner.title}</strong>
        {banner.sub ? <em>{banner.sub}</em> : null}
      </footer>
    </article>
  );
}

function specialBanner(card: Card, tigressAs?: "pirate" | "escape"): { title: string; sub?: string } {
  const { kind } = card;
  if (kind.type === "pirate") return { title: PIRATE_NAMES[kind.index] ?? "探险", sub: "探险企鹅" };
  if (kind.type === "king") return { title: "企鹅王", sub: "最强特殊牌" };
  if (kind.type === "mermaid") return { title: kind.index === 0 ? "珍珠" : "珊瑚", sub: "人鱼企鹅" };
  if (kind.type === "tigress") {
    if (tigressAs === "pirate") return { title: "条纹企鹅", sub: "当探险" };
    if (tigressAs === "escape") return { title: "条纹企鹅", sub: "当滑走" };
    return { title: "条纹企鹅", sub: "探险或滑走" };
  }
  if (kind.type === "escape") return { title: "滑走", sub: ESCAPE_NAMES[kind.index] };
  if (kind.type === "kraken") return { title: "深海巨妖", sub: "吞掉这一墩" };
  if (kind.type === "whale") return { title: "白鲸", sub: "只比数字" };
  if (kind.type === "loot") return { title: "宝藏", sub: LOOT_NAMES[kind.index] };
  return { title: cardTitle(card) };
}

export function CardBack() {
  return (
    <article className="sk-card is-back" aria-hidden>
      <img src={CARD_BACK_ART} alt="" draggable={false} />
    </article>
  );
}
