import { useEffect, useState } from "react";
import { getLeadSuit } from "../../shared/legal.ts";
import type { Card, ClientView, TigressAs } from "../../shared/types.ts";
import { cardTitle, SUIT_META } from "../../shared/theme.ts";
import { SEAT_AVATARS } from "../assets/art.ts";
import { CardFace } from "./CardFace.tsx";

function MiniCard({ card }: { card: Card }) {
  return (
    <div className="mini-card" title={cardTitle(card)}>
      <CardFace card={card} small />
    </div>
  );
}

export function GameScreen({
  view,
  onBid,
  onPlay,
  onCollect,
  onNextRound,
  onLeave,
  onRules,
  onAlbum,
}: {
  view: ClientView;
  onBid: (amount: number) => void;
  onPlay: (cardId: string, tigressAs?: TigressAs) => void;
  onCollect: () => void;
  onNextRound: () => void;
  onLeave: () => void;
  onRules: () => void;
  onAlbum?: () => void;
}) {
  const you = view.players[view.you]!;
  const opponents = view.players
    .map((p, i) => ({ ...p, index: i }))
    .filter((p) => p.index !== view.you);
  const [bid, setBid] = useState(0);
  const [tigressId, setTigressId] = useState<string | null>(null);
  const [showScores, setShowScores] = useState(false);
  const thinker = view.thinkingPlayerIndex != null ? view.players[view.thinkingPlayerIndex] : null;

  useEffect(() => {
    setBid(0);
  }, [view.round, view.phase]);

  const yourTurn = view.phase === "playing" && view.currentPlayerIndex === view.you;
  const leadSuit = getLeadSuit(view.currentTrick);
  const leadMeta = leadSuit ? SUIT_META[leadSuit] : null;

  function tryPlay(card: Card) {
    if (!yourTurn || !view.legalCardIds.includes(card.id)) return;
    if (card.kind.type === "tigress") {
      setTigressId(card.id);
      return;
    }
    onPlay(card.id);
  }

  return (
    <div className={`game-screen${view.phase === "bidding" ? " has-bid-overlay" : ""}`}>
      <header className="topbar">
        <button className="text-btn" onClick={onLeave}>
          ← 离开
        </button>
        <div className="round-chip">
          第 {view.round} / 10 轮 · {view.cardsDealt} 张
        </div>
        <div className="topbar-actions">
          <button className="text-btn" onClick={() => setShowScores(true)}>
            记分
          </button>
          {onAlbum && (
            <button className="text-btn" onClick={onAlbum}>
              图鉴
            </button>
          )}
          <button className="text-btn" onClick={onRules}>
            规则
          </button>
        </div>
      </header>

      <div className="arena">
        <div className="opponents">
          {opponents.map((p) => (
            <Seat
              key={p.id}
              name={p.name}
              avatarIndex={p.index}
              bid={view.bidsRevealed ? p.bid : null}
              tricks={p.tricksWon}
              score={p.score}
              active={
                (view.phase === "playing" && view.currentPlayerIndex === p.index) ||
                view.thinkingPlayerIndex === p.index
              }
              thinking={view.thinkingPlayerIndex === p.index}
              collected={view.phase === "collecting" && p.collected}
              dealer={view.dealerIndex === p.index}
              type={p.type}
              connected={p.connected}
              handCount={p.handCount}
            />
          ))}
        </div>

        <div className="pond">
          <div className="pond-ring">
            {leadMeta && <div className="lead-pill">{leadMeta.emoji} 跟 {leadMeta.name}</div>}
            {view.phase === "playing" && view.currentTrick.length === 0 && (
              <div className="pond-hint">
                {yourTurn
                  ? "轮到你领出了"
                  : thinker
                    ? `${thinker.name} 正在想出哪张…`
                    : `等待 ${view.players[view.currentPlayerIndex]?.name} 出牌`}
              </div>
            )}
            {view.phase === "playing" && view.currentTrick.length > 0 && thinker && !yourTurn && (
              <div className="pond-hint">{thinker.name} 正在想…</div>
            )}
            {view.phase === "collecting" && view.pendingTrick && (
              <div className="pond-hint">
                {view.pendingTrick.destroyed
                  ? "这一墩被吞掉了，无人得分"
                  : `${view.players[view.pendingTrick.winnerIndex ?? 0]?.name} 赢了这一墩`}
              </div>
            )}
            <div className="trick-row">
              {view.currentTrick.map((play) => (
                <div
                  key={`${play.playerIndex}-${play.card.id}`}
                  className={`trick-item${
                    view.phase === "collecting" &&
                    view.pendingTrick &&
                    !view.pendingTrick.destroyed &&
                    play.playerIndex === view.pendingTrick.winnerIndex
                      ? " is-winner"
                      : ""
                  }`}
                >
                  <MiniCard card={play.card} />
                  <span>{view.players[play.playerIndex]?.name}</span>
                  {play.tigressAs && (
                    <em>{play.tigressAs === "pirate" ? "当探险" : "当滑走"}</em>
                  )}
                </div>
              ))}
            </div>
            {view.phase === "collecting" && (
              <div className="collect-bar">
                {view.youCollected ? (
                  <p className="waiting">
                    已确认收牌
                    {view.players.some((p, i) => p.type === "human" && i !== view.you && !p.collected)
                      ? `，还在看：${view.players
                          .filter((p, i) => p.type === "human" && i !== view.you && !p.collected)
                          .map((p) => p.name)
                          .join("、")}`
                      : ""}
                  </p>
                ) : (
                  <button className="btn primary" onClick={onCollect}>
                    收牌
                  </button>
                )}
              </div>
            )}
            {view.lastTrick && view.currentTrick.length === 0 && view.phase === "playing" && (
              <div className="last-trick">
                {view.lastTrick.destroyed
                  ? "上一墩被吞掉了，无人得分"
                  : `上一墩：${view.players[view.lastTrick.winnerIndex ?? 0]?.name} 赢了`}
                <div className="trick-row last">
                  {view.lastTrick.cards.map((play) => (
                    <div key={`last-${play.playerIndex}-${play.card.id}`} className="trick-item faded">
                      <MiniCard card={play.card} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="you-panel">
          <Seat
            name={`${you.name}（你）`}
            avatarIndex={view.you}
            bid={you.bid}
            tricks={you.tricksWon}
            score={you.score}
            active={yourTurn}
            dealer={view.dealerIndex === view.you}
            type="human"
            connected
            handCount={you.handCount}
            self
          />
          <div className="hand">
            {view.hand.map((card) => {
              const legal = view.legalCardIds.includes(card.id);
              const dim = yourTurn && !legal;
              return (
                <button
                  key={card.id}
                  className={`playing-card${dim ? " dim" : ""}${yourTurn && legal ? " playable" : ""}`}
                  onClick={() => tryPlay(card)}
                  disabled={!yourTurn || !legal}
                  title={cardTitle(card)}
                >
                  <CardFace card={card} />
                </button>
              );
            })}
            {view.hand.length === 0 && <div className="pond-hint">手牌已经出完啦</div>}
          </div>
        </div>
      </div>

      {view.phase === "bidding" && (
        <div className="modal-backdrop">
          <div className="modal bid-modal">
            <h2>这一轮要赢几墩？</h2>
            <p>看着手牌，喊出你的预测。大家同时亮标。</p>
            {thinker && (
              <p className="waiting think-status">
                {thinker.name} 正在琢磨要赢几墩
                <ThinkDots />
              </p>
            )}
            {you.bid !== null ? (
              <p className="waiting">你标了 {you.bid}，正在等其他企鹅……</p>
            ) : (
              <>
                <div className="bid-stepper">
                  <button onClick={() => setBid((n) => Math.max(0, n - 1))}>−</button>
                  <strong>{bid}</strong>
                  <button onClick={() => setBid((n) => Math.min(view.cardsDealt, n + 1))}>+</button>
                </div>
                <div className="bid-dots">
                  {Array.from({ length: view.cardsDealt + 1 }, (_, n) => (
                    <button
                      key={n}
                      className={n === bid ? "on" : ""}
                      onClick={() => setBid(n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <button className="btn primary" onClick={() => onBid(bid)}>
                  呱呱呱！标 {bid}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {tigressId && (
        <div className="modal-backdrop" onClick={() => setTigressId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>条纹企鹅要当谁？</h2>
            <p>她可以变成探险企鹅去抢墩，也可以肚皮滑走故意输掉。</p>
            <div className="row-btns">
              <button
                className="btn primary"
                onClick={() => {
                  onPlay(tigressId, "pirate");
                  setTigressId(null);
                }}
              >
                当探险企鹅
              </button>
              <button
                className="btn ghost"
                onClick={() => {
                  onPlay(tigressId, "escape");
                  setTigressId(null);
                }}
              >
                肚皮滑走
              </button>
            </div>
          </div>
        </div>
      )}

      {view.phase === "roundEnd" && view.yourLastRound && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>第 {view.round} 轮结束</h2>
            <ul className="score-list">
              {view.players.map((p) => (
                <li key={p.id}>
                  <span>{p.name}</span>
                  <span>
                    标 {p.lastRoundScore?.bid} / 赢 {p.lastRoundScore?.tricks}
                  </span>
                  <b className={(p.lastRoundScore?.total ?? 0) >= 0 ? "plus" : "minus"}>
                    {(p.lastRoundScore?.total ?? 0) > 0 ? "+" : ""}
                    {p.lastRoundScore?.total}
                  </b>
                </li>
              ))}
            </ul>
            <button className="btn primary" onClick={onNextRound}>
              下一轮
            </button>
          </div>
        </div>
      )}

      {view.phase === "gameEnd" && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>浮冰上的冠军</h2>
            <p className="lede">
              {view.winnerIndices.map((i) => view.players[i]?.name).join("、")} 成为企鹅王！
            </p>
            <ol className="score-list">
              {view.players
                .map((p, i) => ({ ...p, i }))
                .sort((a, b) => b.score - a.score)
                .map((p) => (
                  <li key={p.id}>
                    <span>{p.name}</span>
                    <b>{p.score} 分</b>
                  </li>
                ))}
            </ol>
            <button className="btn primary" onClick={onLeave}>
              回大厅
            </button>
          </div>
        </div>
      )}

      {showScores && (
        <div className="modal-backdrop" onClick={() => setShowScores(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>记分板</h2>
            <ul className="score-list">
              {view.players.map((p) => (
                <li key={p.id}>
                  <span>{p.name}</span>
                  <span>
                    标 {p.bid ?? "?"} / 墩 {p.tricksWon}
                  </span>
                  <b>{p.score}</b>
                </li>
              ))}
            </ul>
            <button className="btn ghost" onClick={() => setShowScores(false)}>
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ThinkDots() {
  return (
    <span className="think-dots" aria-hidden>
      <i />
      <i />
      <i />
    </span>
  );
}

function Seat({
  name,
  avatarIndex,
  bid,
  tricks,
  score,
  active,
  thinking,
  collected,
  dealer,
  type,
  connected,
  handCount,
  self,
}: {
  name: string;
  avatarIndex: number;
  bid: number | null;
  tricks: number;
  score: number;
  active: boolean;
  thinking?: boolean;
  collected?: boolean;
  dealer: boolean;
  type: string;
  connected: boolean;
  handCount: number;
  self?: boolean;
}) {
  return (
    <div className={`seat${active ? " active" : ""}${thinking ? " thinking" : ""}${self ? " self" : ""}`}>
      <div className="seat-avatar-wrap">
        <img
          className="seat-avatar"
          src={SEAT_AVATARS[avatarIndex % SEAT_AVATARS.length]}
          alt=""
          width={56}
          height={56}
        />
        {thinking && (
          <div className="think-bubble">
            <ThinkDots />
          </div>
        )}
      </div>
      <div className="seat-meta">
        <strong>
          {name}
          {dealer ? " · 庄" : ""}
          {type === "ai" ? " · 人机" : ""}
          {!connected ? " · 离开" : ""}
          {collected ? " · 已收" : ""}
        </strong>
        <span>
          {bid === null ? "未亮标" : `标 ${bid}`} · 赢 {tricks} · {score} 分
        </span>
        {thinking && <span className="think-line">想一想…</span>}
        {!self && (
          <div className="mini-backs">
            {Array.from({ length: Math.min(handCount, 10) }, (_, i) => (
              <span key={i} className="mini-back" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
