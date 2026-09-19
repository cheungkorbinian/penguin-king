import { useMemo, useState } from "react";
import { buildDeck } from "../../shared/deck.ts";
import { cardBlurb, cardTitle, SUIT_META } from "../../shared/theme.ts";
import type { Card } from "../../shared/types.ts";
import { CardBack, CardFace } from "./CardFace.tsx";

type Tab = "fish" | "shell" | "aurora" | "ice" | "special" | "expansion" | "back";

const TABS: { id: Tab; label: string }[] = [
  { id: "fish", label: "小鱼 1–14" },
  { id: "shell", label: "贝壳 1–14" },
  { id: "aurora", label: "极光 1–14" },
  { id: "ice", label: "冰山王牌" },
  { id: "special", label: "特殊牌" },
  { id: "expansion", label: "进阶牌" },
  { id: "back", label: "牌背" },
];

export function CardAlbum({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("fish");
  const [picked, setPicked] = useState<Card | null>(null);
  const deck = useMemo(() => buildDeck({ expansion: true, maxRounds: 10 }), []);

  const cards = deck.filter((card) => {
    if (tab === "back") return false;
    if (tab === "special") {
      return ["pirate", "tigress", "king", "mermaid", "escape"].includes(card.kind.type);
    }
    if (tab === "expansion") {
      return ["kraken", "whale", "loot"].includes(card.kind.type);
    }
    return card.kind.type === "suit" && card.kind.suit === tab;
  });

  return (
    <div className="album">
      <header className="album-bar">
        <button className="text-btn" onClick={onClose}>
          ← 返回
        </button>
        <h1>企鹅卡牌图鉴</h1>
        <span>{tab === "back" ? 1 : cards.length} 张</span>
      </header>
      <nav className="album-tabs">
        {TABS.map((t) => (
          <button key={t.id} className={t.id === tab ? "on" : ""} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
      <p className="album-lead">
        {tab === "fish" && "薄荷绿企鹅，1–14 每张立绘都不同：出壳、双胞胎、抛鱼……一直到鱼群之王。"}
        {tab === "shell" && "蜜桃黄企鹅，1–14 每张立绘都不同：螺里宝宝、沙堡、金贝王冠。"}
        {tab === "aurora" && "粉紫极光企鹅，1–14 每张立绘都不同：星泡、许愿、极光女神。"}
        {tab === "ice" && "炭灰王牌企鹅，1–14 每张立绘都不同。再小的冰山也压过其它数字牌。"}
        {tab === "special" && "特殊牌随时可出。人鱼克企鹅王，企鹅王克探险企鹅，探险企鹅克数字牌。"}
        {tab === "expansion" && "开局时可加入。巨妖吞墩，白鲸只比数字，宝藏结盟加分。"}
        {tab === "back" && "牌背：打盹的小企鹅王。"}
      </p>
      <div className="album-grid">
        {tab === "back" ? (
          <div className="album-card">
            <CardBack />
            <strong>牌背</strong>
          </div>
        ) : (
          cards.map((card) => (
            <button key={card.id} className="album-card" onClick={() => setPicked(card)} title={cardTitle(card)}>
              <CardFace card={card} />
              <strong>{cardTitle(card)}</strong>
            </button>
          ))
        )}
      </div>
      {picked && (
        <div className="modal-backdrop" onClick={() => setPicked(null)}>
          <div className="modal album-zoom" onClick={(e) => e.stopPropagation()}>
            <div className="zoom-card">
              <CardFace card={picked} />
            </div>
            <div>
              <h2>{cardTitle(picked)}</h2>
              <p className="lede">{cardBlurb(picked)}</p>
              {picked.kind.type === "suit" && (
                <p>
                  {SUIT_META[picked.kind.suit].name}
                  {picked.kind.suit === "ice" ? " · 王牌" : " · 普通花色"} · 点数 {picked.kind.rank}
                  {picked.kind.rank === 14
                    ? picked.kind.suit === "ice"
                      ? " · 赢走 +20"
                      : " · 赢走 +10"
                    : ""}
                </p>
              )}
              <button className="btn ghost" onClick={() => setPicked(null)}>
                收起来
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
