import { useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { aiThinkMs, stepAi } from "../shared/ai.ts";
import { applyAction, createGame, nextAiActorIndex, toClientView } from "../shared/engine.ts";
import { AI_NAMES } from "../shared/theme.ts";
import type { AiDifficulty, ClientView, GameState, TigressAs } from "../shared/types.ts";
import { CardAlbum } from "./components/CardAlbum.tsx";
import { GameScreen } from "./components/GameScreen.tsx";
import { Rules } from "./components/Rules.tsx";
import heroArt from "./assets/home-hero.jpg";
import gameArt from "./assets/game-bg.jpg";

type Screen = "home" | "online-lobby" | "online-game" | "solo-game";

interface LobbyPlayer {
  id: string;
  name: string;
  type: "human" | "ai";
  connected: boolean;
  isHost: boolean;
}

interface LobbyState {
  code: string;
  hostId: string;
  expansion: boolean;
  aiDifficulty: AiDifficulty;
  started: boolean;
  players: LobbyPlayer[];
}

function loadName(): string {
  return localStorage.getItem("penguin-king-name") || "圆圆";
}

function loadDifficulty(): AiDifficulty {
  return localStorage.getItem("penguin-king-ai") === "sharp" ? "sharp" : "easy";
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [name, setName] = useState(loadName);
  const [aiCount, setAiCount] = useState(3);
  const [expansion, setExpansion] = useState(false);
  const [aiDifficulty, setAiDifficulty] = useState<AiDifficulty>(loadDifficulty);
  const [showRules, setShowRules] = useState(false);
  const [showAlbum, setShowAlbum] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [solo, setSolo] = useState<GameState | null>(null);
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [onlineView, setOnlineView] = useState<ClientView | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    localStorage.setItem("penguin-king-name", name);
  }, [name]);

  useEffect(() => {
    localStorage.setItem("penguin-king-ai", aiDifficulty);
  }, [aiDifficulty]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!solo) return;
    if (nextAiActorIndex(solo) === null) return;
    const timer = setTimeout(() => {
      setSolo((s) => (s ? stepAi(s) : s));
    }, aiThinkMs(solo));
    return () => clearTimeout(timer);
  }, [solo]);

  const soloView = useMemo(() => (solo ? toClientView(solo, 0) : null), [solo]);

  function soloAct(action: Parameters<typeof applyAction>[1]) {
    setSolo((s) => {
      if (!s) return s;
      try {
        return applyAction(s, action);
      } catch (err) {
        setTimeout(() => setToast(err instanceof Error ? err.message : "这一手出不了"), 0);
        return s;
      }
    });
  }

  function startSolo() {
    const players = [
      { id: "you", name: name.slice(0, 12) || "圆圆", type: "human" as const, connected: true },
      ...Array.from({ length: aiCount }, (_, i) => ({
        id: `ai-${i}`,
        name: AI_NAMES[i] ?? `企鹅${i + 1}`,
        type: "ai" as const,
        connected: true,
      })),
    ];
    const game = createGame(players, { expansion, maxRounds: 10, aiDifficulty });
    setSolo(game);
    setScreen("solo-game");
  }

  function ensureSocket(): Socket {
    if (socketRef.current) return socketRef.current;
    const socket = io({ autoConnect: true });
    socket.on("joined", ({ playerId: id, code }: { playerId: string; code: string }) => {
      setPlayerId(id);
      setLobby((prev) => prev ?? { code, hostId: id, expansion, aiDifficulty, started: false, players: [] });
      setScreen("online-lobby");
    });
    socket.on("lobby", (next: LobbyState) => {
      setLobby(next);
    });
    socket.on("view", (view: ClientView) => {
      setOnlineView(view);
      setScreen("online-game");
    });
    socket.on("errorMsg", (msg: string) => setToast(msg));
    socket.on("disconnect", () => setToast("和浮冰断开连接了"));
    socketRef.current = socket;
    return socket;
  }

  function createRoom() {
    ensureSocket().emit("createRoom", { name, expansion, aiDifficulty });
  }

  function joinRoom() {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) return setToast("请输入 4 位房间号");
    ensureSocket().emit("joinRoom", { code, name });
  }

  function leaveOnline() {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setLobby(null);
    setOnlineView(null);
    setPlayerId(null);
    setScreen("home");
  }

  return (
    <div className={`app${screen === "home" || screen === "online-lobby" ? " is-home" : ""}${screen === "solo-game" || screen === "online-game" ? " is-game" : ""}`}>
      {(screen === "home" || screen === "online-lobby") && (
        <img className="home-bg" src={heroArt} alt="" />
      )}
      {(screen === "solo-game" || screen === "online-game") && (
        <img className="game-bg" src={gameArt} alt="" />
      )}
      {screen !== "home" && screen !== "online-lobby" && screen !== "solo-game" && screen !== "online-game" && (
        <div className="aurora" />
      )}
      {screen === "home" && (
        <Home
          name={name}
          setName={setName}
          aiCount={aiCount}
          setAiCount={setAiCount}
          expansion={expansion}
          setExpansion={setExpansion}
          aiDifficulty={aiDifficulty}
          setAiDifficulty={setAiDifficulty}
          joinCode={joinCode}
          setJoinCode={setJoinCode}
          onSolo={startSolo}
          onCreate={createRoom}
          onJoin={joinRoom}
          onRules={() => setShowRules(true)}
          onAlbum={() => setShowAlbum(true)}
        />
      )}

      {screen === "solo-game" && soloView && (
        <GameScreen
          view={soloView}
          onBid={(amount) => soloAct({ type: "bid", playerIndex: 0, amount })}
          onPlay={(cardId, tigressAs) => soloAct({ type: "play", playerIndex: 0, cardId, tigressAs })}
          onNextRound={() => soloAct({ type: "nextRound" })}
          onLeave={() => {
            setSolo(null);
            setScreen("home");
          }}
          onRules={() => setShowRules(true)}
          onAlbum={() => setShowAlbum(true)}
        />
      )}

      {screen === "online-lobby" && lobby && (
        <OnlineLobby
          lobby={lobby}
          playerId={playerId}
          onAddAi={() => ensureSocket().emit("addAi", { aiDifficulty: lobby.aiDifficulty })}
          onSetAiDifficulty={(next) => ensureSocket().emit("setAiDifficulty", { aiDifficulty: next })}
          onRemove={(id) => ensureSocket().emit("removeSeat", { id })}
          onStart={() => ensureSocket().emit("startGame")}
          onLeave={leaveOnline}
        />
      )}

      {screen === "online-game" && onlineView && (
        <GameScreen
          view={onlineView}
          onBid={(amount) => ensureSocket().emit("bid", { amount })}
          onPlay={(cardId, tigressAs?: TigressAs) => ensureSocket().emit("play", { cardId, tigressAs })}
          onNextRound={() => ensureSocket().emit("nextRound")}
          onLeave={leaveOnline}
          onRules={() => setShowRules(true)}
          onAlbum={() => setShowAlbum(true)}
        />
      )}

      {showRules && <Rules onClose={() => setShowRules(false)} />}
      {showAlbum && <CardAlbum onClose={() => setShowAlbum(false)} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function Home({
  name,
  setName,
  aiCount,
  setAiCount,
  expansion,
  setExpansion,
  aiDifficulty,
  setAiDifficulty,
  joinCode,
  setJoinCode,
  onSolo,
  onCreate,
  onJoin,
  onRules,
  onAlbum,
}: {
  name: string;
  setName: (v: string) => void;
  aiCount: number;
  setAiCount: (n: number) => void;
  expansion: boolean;
  setExpansion: (v: boolean) => void;
  aiDifficulty: AiDifficulty;
  setAiDifficulty: (v: AiDifficulty) => void;
  joinCode: string;
  setJoinCode: (v: string) => void;
  onSolo: () => void;
  onCreate: () => void;
  onJoin: () => void;
  onRules: () => void;
  onAlbum: () => void;
}) {
  return (
    <main className="home home-stage">
      <header className="home-title">
        <p className="hero-kicker">爱我的小企鹅</p>
        <h1>企鹅王</h1>
        <div className="hero-links">
          <button className="text-btn" onClick={onRules}>
            先看一眼规则
          </button>
          <button className="text-btn" onClick={onAlbum}>
            翻开全部卡牌
          </button>
        </div>
      </header>

      <div className="home-dock">
        <div className="home-identity">
          <label className="field paper-chip home-name">
            你的名字
            <input value={name} maxLength={12} onChange={(e) => setName(e.target.value)} placeholder="圆圆" />
          </label>
          <label className="toggle home-expand">
            <input type="checkbox" checked={expansion} onChange={(e) => setExpansion(e.target.checked)} />
            进阶牌（巨妖、白鲸、宝藏）
          </label>
          <label className="field paper-chip home-diff">
            人机
            <select value={aiDifficulty} onChange={(e) => setAiDifficulty(e.target.value as AiDifficulty)}>
              <option value="easy">轻松</option>
              <option value="sharp">认真</option>
            </select>
          </label>
        </div>

        <section className="panel home-mode">
          <h2>单人</h2>
          <div className="home-mode-controls">
            <select value={aiCount} onChange={(e) => setAiCount(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} 只人机
                </option>
              ))}
            </select>
            <button className="btn primary" onClick={onSolo}>
              开始单人局
            </button>
          </div>
        </section>

        <section className="panel home-mode">
          <h2>线上</h2>
          <div className="home-mode-controls">
            <button className="btn primary" onClick={onCreate}>
              创建房间
            </button>
            <div className="join-row">
              <input
                value={joinCode}
                maxLength={6}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="房间号"
              />
              <button className="btn ghost" onClick={onJoin}>
                加入
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function OnlineLobby({
  lobby,
  playerId,
  onAddAi,
  onSetAiDifficulty,
  onRemove,
  onStart,
  onLeave,
}: {
  lobby: LobbyState;
  playerId: string | null;
  onAddAi: () => void;
  onSetAiDifficulty: (v: AiDifficulty) => void;
  onRemove: (id: string) => void;
  onStart: () => void;
  onLeave: () => void;
}) {
  const isHost = lobby.hostId === playerId;
  return (
    <main className="home lobby-page">
      <button className="text-btn" onClick={onLeave}>
        ← 离开房间
      </button>
      <header className="hero">
        <p className="sub">房间号</p>
        <h1 className="room-code">{lobby.code}</h1>
        <button
          className="text-btn"
          onClick={() => {
            void navigator.clipboard.writeText(lobby.code);
          }}
        >
          复制房间号
        </button>
        <p>把这个号发给朋友，2–6 只企鹅就能开打。</p>
        <p>把这个网址发给朋友，输入房间号就能加入，不在同一个地方也可以。</p>
        <p className="sub">{window.location.origin}</p>
        <button
          className="text-btn"
          onClick={() => {
            void navigator.clipboard.writeText(window.location.origin);
          }}
        >
          复制网址
        </button>
      </header>
      <section className="panel">
        <h2>这一桌</h2>
        <ul className="seat-list">
          {lobby.players.map((p) => (
            <li key={p.id}>
              <span>
                {p.name}
                {p.isHost ? " · 房主" : ""}
                {p.type === "ai" ? " · 人机" : ""}
              </span>
              {isHost && !p.isHost && (
                <button className="text-btn" onClick={() => onRemove(p.id)}>
                  请离
                </button>
              )}
            </li>
          ))}
        </ul>
        {isHost && (
          <div className="row-btns lobby-ai-row">
            <label className="lobby-diff">
              人机
              <select
                value={lobby.aiDifficulty ?? "easy"}
                onChange={(e) => onSetAiDifficulty(e.target.value as AiDifficulty)}
              >
                <option value="easy">轻松</option>
                <option value="sharp">认真</option>
              </select>
            </label>
            <button className="btn ghost" onClick={onAddAi} disabled={lobby.players.length >= 6}>
              加人机
            </button>
            <button className="btn primary" onClick={onStart} disabled={lobby.players.length < 2}>
              开打！
            </button>
          </div>
        )}
        {!isHost && (
          <p className="waiting">
            等房主开打……人机是{lobby.aiDifficulty === "sharp" ? "认真" : "轻松"}档。
          </p>
        )}
      </section>
    </main>
  );
}
