import { aiThinkMs, runAiUntilHuman, stepAi } from "../shared/ai.ts";
import { applyAction, createGame, nextAiActorIndex, toClientView } from "../shared/engine.ts";
import { AI_NAMES } from "../shared/theme.ts";
import type { AiDifficulty, GameState, Player, TigressAs } from "../shared/types.ts";
import { normalizeAiDifficulty } from "../shared/types.ts";
import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { customAlphabet } from "nanoid";
import { Server } from "socket.io";

const nanoid = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 4);
const PORT = Number(process.env.PORT ?? 3001);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface Seat {
  id: string;
  name: string;
  type: "human" | "ai";
  socketId: string | null;
  connected: boolean;
  human: boolean;
}

interface Room {
  code: string;
  hostId: string;
  expansion: boolean;
  aiDifficulty: AiDifficulty;
  seats: Seat[];
  game: GameState | null;
  aiTimer: ReturnType<typeof setTimeout> | null;
}

const rooms = new Map<string, Room>();
const socketRoom = new Map<string, string>();
const dropTimers = new Map<string, ReturnType<typeof setTimeout>>();

function dropKey(code: string, seatId: string): string {
  return `${code}:${seatId}`;
}

function clearDropTimer(code: string, seatId: string): void {
  const key = dropKey(code, seatId);
  const timer = dropTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    dropTimers.delete(key);
  }
}

function clientId(raw: unknown, fallback: string): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  return /^[A-Za-z0-9_-]{8,64}$/.test(value) ? value : fallback;
}

function seatBySocket(room: Room, socketId: string): Seat | undefined {
  return room.seats.find((s) => s.socketId === socketId);
}

function isHostSocket(room: Room, socketId: string): boolean {
  return seatBySocket(room, socketId)?.id === room.hostId;
}

function lobbyPayload(room: Room) {
  return {
    code: room.code,
    hostId: room.hostId,
    expansion: room.expansion,
    aiDifficulty: room.aiDifficulty,
    started: room.game !== null,
    players: room.seats.map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type,
      connected: s.connected,
      isHost: s.id === room.hostId,
    })),
  };
}

function toPlayers(room: Room): Player[] {
  return room.seats.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type,
    connected: s.connected,
  }));
}

function broadcastLobby(io: Server, room: Room): void {
  io.to(room.code).emit("lobby", lobbyPayload(room));
}

function broadcastGame(io: Server, room: Room): void {
  if (!room.game) return;
  for (const seat of room.seats) {
    if (!seat.socketId || seat.type !== "human") continue;
    const index = room.seats.findIndex((s) => s.id === seat.id);
    io.to(seat.socketId).emit("view", toClientView(room.game, index));
  }
}

function stopAi(room: Room): void {
  if (room.aiTimer) {
    clearTimeout(room.aiTimer);
    room.aiTimer = null;
  }
}

function scheduleAi(io: Server, room: Room): void {
  stopAi(room);
  if (!room.game || nextAiActorIndex(room.game) === null) return;
  const wait = aiThinkMs(room.game);
  room.aiTimer = setTimeout(() => {
    if (!room.game || nextAiActorIndex(room.game) === null) return;
    room.game = room.game.phase === "bidding" ? runAiUntilHuman(room.game) : stepAi(room.game);
    syncPlayers(room);
    broadcastGame(io, room);
    scheduleAi(io, room);
  }, wait);
}

function syncPlayers(room: Room): void {
  if (!room.game) return;
  room.game.players = toPlayers(room);
}

const app = express();
app.use(cors());
app.get("/health", (_req, res) => res.json({ ok: true }));

if (process.env.NODE_ENV === "production") {
  const dist = path.join(__dirname, "../dist");
  app.use(express.static(dist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(dist, "index.html"));
  });
}

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: true, methods: ["GET", "POST"] },
  pingInterval: 15000,
  pingTimeout: 20000,
  transports: ["websocket", "polling"],
});

io.on("connection", (socket) => {
  socket.on("createRoom", ({ name, expansion, aiDifficulty, playerId }: { name: string; expansion?: boolean; aiDifficulty?: AiDifficulty; playerId?: string }) => {
    leaveSocketRoom(io, socket.id, true);
    const id = clientId(playerId, socket.id);
    const seat: Seat = {
      id,
      name: (name || "企鹅").slice(0, 12),
      type: "human",
      socketId: socket.id,
      connected: true,
      human: true,
    };
    const room: Room = {
      code: nanoid(),
      hostId: seat.id,
      expansion: Boolean(expansion),
      aiDifficulty: normalizeAiDifficulty(aiDifficulty),
      seats: [seat],
      game: null,
      aiTimer: null,
    };
    rooms.set(room.code, room);
    attachSeat(socket, room, seat);
    socket.emit("joined", { playerId: seat.id, code: room.code });
    broadcastLobby(io, room);
  });

  socket.on("joinRoom", ({ code, name, playerId }: { code: string; name: string; playerId?: string }) => {
    const room = rooms.get(code.trim().toUpperCase());
    if (!room) return socket.emit("errorMsg", "找不到这桌企鹅，检查房间号？");
    const id = clientId(playerId, socket.id);
    const displayName = (name || "企鹅").slice(0, 12);
    const existing =
      room.seats.find((s) => s.id === id) ??
      room.seats.find((s) => s.human && !s.connected && s.name === displayName);
    if (existing) {
      if (existing.socketId && existing.socketId !== socket.id) {
        socketRoom.delete(existing.socketId);
      }
      leaveSocketRoom(io, socket.id, false);
      existing.name = displayName || existing.name;
      attachSeat(socket, room, existing);
      socket.emit("joined", { playerId: existing.id, code: room.code });
      broadcastLobby(io, room);
      if (room.game) {
        const index = room.seats.findIndex((s) => s.id === existing.id);
        socket.emit("view", toClientView(room.game, index));
        scheduleAi(io, room);
      }
      return;
    }
    if (room.game) return socket.emit("errorMsg", "这局已经开始啦。刚才进来过的话，用同一个名字再加入一次。");
    if (room.seats.filter((s) => s.connected || s.human).length >= 6) {
      return socket.emit("errorMsg", "这桌已经坐满 6 只企鹅");
    }
    leaveSocketRoom(io, socket.id, true);
    const seat: Seat = {
      id,
      name: displayName,
      type: "human",
      socketId: socket.id,
      connected: true,
      human: true,
    };
    room.seats.push(seat);
    attachSeat(socket, room, seat);
    socket.emit("joined", { playerId: seat.id, code: room.code });
    broadcastLobby(io, room);
  });

  socket.on("setAiDifficulty", ({ aiDifficulty }: { aiDifficulty?: AiDifficulty }) => {
    const room = roomOf(socket.id);
    if (!room || !isHostSocket(room, socket.id) || room.game) return;
    room.aiDifficulty = normalizeAiDifficulty(aiDifficulty);
    broadcastLobby(io, room);
  });

  socket.on("setExpansion", ({ expansion }: { expansion?: boolean }) => {
    const room = roomOf(socket.id);
    if (!room || !isHostSocket(room, socket.id) || room.game) return;
    room.expansion = Boolean(expansion);
    broadcastLobby(io, room);
  });

  socket.on("addAi", ({ aiDifficulty }: { aiDifficulty?: AiDifficulty } = {}) => {
    const room = roomOf(socket.id);
    if (!room || !isHostSocket(room, socket.id)) return;
    if (room.game) return;
    if (room.seats.length >= 6) return socket.emit("errorMsg", "已经满员");
    if (aiDifficulty) room.aiDifficulty = normalizeAiDifficulty(aiDifficulty);
    const used = new Set(room.seats.map((s) => s.name));
    const botName = AI_NAMES.find((n) => !used.has(n)) ?? `机器人${room.seats.length}`;
    room.seats.push({
      id: `ai-${nanoid()}`,
      name: botName,
      type: "ai",
      socketId: null,
      connected: true,
      human: false,
    });
    broadcastLobby(io, room);
  });

  socket.on("removeSeat", ({ id }: { id: string }) => {
    const room = roomOf(socket.id);
    if (!room || !isHostSocket(room, socket.id) || room.game) return;
    const seat = room.seats.find((s) => s.id === id);
    if (!seat || seat.id === room.hostId) return;
    clearDropTimer(room.code, seat.id);
    room.seats = room.seats.filter((s) => s.id !== id);
    broadcastLobby(io, room);
  });

  socket.on("startGame", () => {
    const room = roomOf(socket.id);
    if (!room || !isHostSocket(room, socket.id)) return;
    if (room.seats.length < 2) return socket.emit("errorMsg", "至少要两只企鹅才能开打");
    if (room.game) return;
    room.game = createGame(toPlayers(room), {
      expansion: room.expansion,
      maxRounds: 10,
      aiDifficulty: room.aiDifficulty,
    });
    broadcastLobby(io, room);
    broadcastGame(io, room);
    scheduleAi(io, room);
  });

  socket.on("bid", ({ amount }: { amount: number }) => {
    act(socket.id, { type: "bid", amount });
  });

  socket.on("play", ({ cardId, tigressAs }: { cardId: string; tigressAs?: TigressAs }) => {
    act(socket.id, { type: "play", cardId, tigressAs });
  });

  socket.on("collect", () => {
    act(socket.id, { type: "collect" });
  });

  socket.on("nextRound", () => {
    act(socket.id, { type: "nextRound" });
  });

  socket.on("disconnect", () => {
    leaveSocketRoom(io, socket.id, false);
  });
});

function roomOf(socketId: string): Room | undefined {
  const code = socketRoom.get(socketId);
  return code ? rooms.get(code) : undefined;
}

function leaveSocketRoom(io: Server, socketId: string, dropSeat: boolean): void {
  const code = socketRoom.get(socketId);
  socketRoom.delete(socketId);
  if (code) {
    const sock = io.sockets.sockets.get(socketId);
    if (sock) void sock.leave(code);
  }
  if (!code) return;
  const room = rooms.get(code);
  if (!room) return;
  const seat = room.seats.find((s) => s.socketId === socketId);
  if (!seat) return;
  seat.socketId = null;
  seat.connected = false;
  if (!room.game) {
    if (dropSeat) {
      clearDropTimer(room.code, seat.id);
      room.seats = room.seats.filter((s) => s.id !== seat.id);
      if (room.seats.length === 0) {
        rooms.delete(room.code);
        return;
      }
      if (room.hostId === seat.id) {
        const nextHost = room.seats.find((s) => s.human);
        if (nextHost) room.hostId = nextHost.id;
      }
      broadcastLobby(io, room);
      return;
    }
    clearDropTimer(room.code, seat.id);
    dropTimers.set(
      dropKey(room.code, seat.id),
      setTimeout(() => {
        dropTimers.delete(dropKey(room.code, seat.id));
        const current = rooms.get(room.code);
        if (!current || current.game) return;
        const gone = current.seats.find((s) => s.id === seat.id);
        if (!gone || gone.connected) return;
        current.seats = current.seats.filter((s) => s.id !== seat.id);
        if (current.seats.length === 0) {
          rooms.delete(current.code);
          return;
        }
        if (current.hostId === seat.id) {
          const nextHost = current.seats.find((s) => s.human);
          if (nextHost) current.hostId = nextHost.id;
        }
        broadcastLobby(io, current);
      }, 120_000),
    );
    broadcastLobby(io, room);
    return;
  }
  const idx = room.seats.findIndex((s) => s.id === seat.id);
  if (idx >= 0 && room.game.players[idx]) {
    room.game.players[idx]!.connected = false;
  }
  broadcastLobby(io, room);
  broadcastGame(io, room);
  clearDropTimer(room.code, seat.id);
  dropTimers.set(
    dropKey(room.code, seat.id),
    setTimeout(() => {
      dropTimers.delete(dropKey(room.code, seat.id));
      const current = rooms.get(room.code);
      if (!current?.game) return;
      const gone = current.seats.find((s) => s.id === seat.id);
      if (!gone || gone.connected) return;
      const i = current.seats.findIndex((s) => s.id === seat.id);
      gone.type = "ai";
      if (i >= 0 && current.game.players[i]) {
        current.game.players[i]!.type = "ai";
        current.game.players[i]!.connected = false;
        if (current.game.phase === "collecting") {
          current.game = applyAction(current.game, { type: "collect", playerIndex: i });
        }
      }
      broadcastLobby(io, current);
      broadcastGame(io, current);
      scheduleAi(io, current);
    }, 8_000),
  );
}

function attachSeat(socket: { id: string; join: (room: string) => void }, room: Room, seat: Seat): void {
  clearDropTimer(room.code, seat.id);
  seat.socketId = socket.id;
  seat.connected = true;
  seat.type = "human";
  seat.human = true;
  socketRoom.set(socket.id, room.code);
  void socket.join(room.code);
  const idx = room.seats.findIndex((s) => s.id === seat.id);
  if (room.game && idx >= 0 && room.game.players[idx]) {
    room.game.players[idx]!.connected = true;
    room.game.players[idx]!.type = "human";
  }
}

function act(
  socketId: string,
  action:
    | { type: "bid"; amount: number }
    | { type: "play"; cardId: string; tigressAs?: TigressAs }
    | { type: "collect" }
    | { type: "nextRound" },
): void {
  const room = roomOf(socketId);
  if (!room?.game) return;
  const playerIndex = room.seats.findIndex((s) => s.socketId === socketId);
  if (playerIndex < 0) return;
  try {
    if (action.type === "bid") {
      room.game = applyAction(room.game, { type: "bid", playerIndex, amount: action.amount });
    } else if (action.type === "play") {
      room.game = applyAction(room.game, {
        type: "play",
        playerIndex,
        cardId: action.cardId,
        tigressAs: action.tigressAs,
      });
    } else if (action.type === "collect") {
      room.game = applyAction(room.game, { type: "collect", playerIndex });
    } else {
      if (room.game.phase !== "roundEnd") return;
      room.game = applyAction(room.game, { type: "nextRound" });
    }
    syncPlayers(room);
    broadcastGame(io, room);
    scheduleAi(io, room);
  } catch (err) {
    io.to(socketId).emit("errorMsg", err instanceof Error ? err.message : "出了一点小意外");
  }
}

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`企鹅王服务器已开张 http://localhost:${PORT}`);
});
