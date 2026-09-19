import type { Card, Suit } from "./types.ts";

export const SUIT_META: Record<
  Suit,
  { name: string; emoji: string; subtitle: string; color: string; ink: string; paper: string }
> = {
  fish: { name: "小鱼", emoji: "🐟", subtitle: "普通花色", color: "#3aa36a", ink: "#14532d", paper: "#e9fbf2" },
  shell: { name: "贝壳", emoji: "🐚", subtitle: "普通花色", color: "#e0a106", ink: "#854d0e", paper: "#fff6e0" },
  aurora: { name: "极光", emoji: "💜", subtitle: "普通花色", color: "#8b6cc9", ink: "#4c1d95", paper: "#f4eefe" },
  ice: { name: "冰山", emoji: "🧊", subtitle: "王牌花色", color: "#1f3b57", ink: "#e8f4ff", paper: "#16324f" },
};

export const PIRATE_NAMES = ["露露", "班班", "淘淘", "翠翠", "夯夯"] as const;
export const PIRATE_TITLES = ["糕点船长", "蒙面旅者", "幸运赌徒", "占卜花仙", "大力水手"] as const;
export const ESCAPE_NAMES = ["滑滑", "滚滚", "躲躲", "冰刀", "扑通"] as const;
export const LOOT_NAMES = ["沙丁鱼罐", "珍珠匣"] as const;

export const SUIT_CARD_NAMES: Record<Suit, readonly string[]> = {
  fish: [
    "鱼苗出壳",
    "双鱼拍鳍",
    "三连抛鱼",
    "珊瑚鱼塔",
    "星鱼跳跃",
    "海边野餐",
    "好运鱼钩",
    "浪里滑行",
    "鱼堆午睡",
    "飞鱼侠",
    "潮汐法师",
    "渔歌会",
    "礁石守卫",
    "鱼群之王",
  ],
  shell: [
    "第一只螺",
    "双胞胎贝",
    "抛贝杂技",
    "沙堡四贝",
    "五彩珍珠",
    "沙滩午餐",
    "捞宝钩",
    "贝壳滑梯",
    "金沙小憩",
    "珍珠侠",
    "螺号法师",
    "海螺合唱",
    "沙洲骑士",
    "金贝王冠",
  ],
  aurora: [
    "第一道光",
    "双星私语",
    "三星杂技",
    "叠起极光",
    "五芒跳",
    "星空野餐",
    "许愿钩",
    "光带滑行",
    "枕着星星睡",
    "极光侠",
    "夜空法师",
    "星歌会",
    "北境骑士",
    "极光女神",
  ],
  ice: [
    "小冰碴",
    "两块浮冰",
    "冰晶杂技",
    "冰砖塔",
    "五棱跳",
    "雪地野餐",
    "冰钓钩",
    "肚皮溜冰",
    "雪窝午休",
    "冰山侠",
    "霜雪法师",
    "冰原合唱",
    "冰川骑士",
    "冰山帝",
  ],
};

export function cardTitle(card: Card): string {
  const { kind } = card;
  switch (kind.type) {
    case "suit":
      return `${SUIT_META[kind.suit].name}${kind.rank} · ${SUIT_CARD_NAMES[kind.suit][kind.rank - 1]}`;
    case "pirate":
      return `探险企鹅 · ${PIRATE_NAMES[kind.index] ?? "无名"}`;
    case "tigress":
      return "条纹企鹅 · 选择者";
    case "king":
      return "企鹅王";
    case "mermaid":
      return kind.index === 0 ? "人鱼企鹅 · 珍珠" : "人鱼企鹅 · 珊瑚";
    case "escape":
      return `肚皮滑行 · ${ESCAPE_NAMES[kind.index] ?? "滑走"}`;
    case "kraken":
      return "深海巨妖";
    case "whale":
      return "白鲸";
    case "loot":
      return `小鱼宝藏 · ${LOOT_NAMES[kind.index] ?? "宝藏"}`;
  }
}

export function cardBlurb(card: Card): string {
  const { kind } = card;
  switch (kind.type) {
    case "suit":
      return kind.suit === "ice" ? "王牌，压过其它数字牌" : "必须跟牌时要出同花色";
    case "pirate":
      return `${PIRATE_TITLES[kind.index] ?? "探险家"} · 压过数字牌和人鱼`;
    case "tigress":
      return "打出时选择：当探险企鹅，或当滑行";
    case "king":
      return "压过探险企鹅；只怕人鱼企鹅";
    case "mermaid":
      return "压过数字牌；能俘获企鹅王";
    case "escape":
      return "专门用来输掉墩";
    case "kraken":
      return "吞掉这一墩，无人得分";
    case "whale":
      return "特殊牌失效，比最大数字";
    case "loot":
      return "与赢走宝藏的玩家结成同盟";
  }
}

export const AI_NAMES = ["圆圆", "冰冰", "波波", "朵朵", "团团", "咕咕", "果果", "点点"];
