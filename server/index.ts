import { choosePlay, runAiUntilHuman } from "../shared/ai.ts";
import { applyAction, createGame, toClientView } from "../shared/engine.ts";
import { AI_NAMES } from "../shared/theme.ts";
import type { AiDifficulty, GameState, Player, TigressAs } from "../shared/types.ts";
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
  const tick = (): void => {
    if (!room.game) return;
    if (room.game.phase === "bidding") {
      room.game = runAiUntilHuman(room.game);
      broadcastGame(io, room);
    }
    if (!room.game || room.game.phase !== "playing") return;
    const actor = room.game.players[room.game.currentPlayerIndex];
    if (!actor || actor.type !== "ai") return;
    const choice = choosePlay(room.game, room.game.currentPlayerIndex);
    room.game = applyAction(room.game, {
      type: "play",
      playerIndex: room.game.currentPlayerIndex,
      cardId: choice.cardId,
      tigressAs: choice.tigressAs,
    });
    syncPlayers(room);
    broadcastGame(io, room);
    if (room.game.phase === "playing" && room.game.players[room.game.currentPlayerIndex]?.type === "ai") {
      room.aiTimer = setTimeout(tick, 700);
    }
  };
  room.aiTimer = setTimeout(tick, 450);
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
  pingInterval: 20000,
  pingTimeout: 25000,
});

io.on("connection", (socket) => {
  socket.on("createRoom", ({ name, expansion, aiDifficulty }: { name: string; expansion?: boolean; aiDifficulty?: AiDifficulty }) => {
    const code = nanoid();
    const seat: Seat = {
      id: socket.id,
      name: (name || "企鹅").slice(0, 12),
      type: "human",
      socketId: socket.id,
      connected: true,
    };
    const room: Room = {
      code,
      hostId: seat.id,
      expansion: Boolean(expansion),
      aiDifficulty: aiDifficulty === "sharp" ? "sharp" : "easy",
      seats: [seat],
      game: null,
      aiTimer: null,
    };
    rooms.set(code, room);
    socketRoom.set(socket.id, code);
    void socket.join(code);
    socket.emit("joined", { playerId: seat.id, code });
    broadcastLobby(io, room);
  });

  socket.on("joinRoom", ({ code, name }: { code: string; name: string }) => {
    const room = rooms.get(code.trim().toUpperCase());
    if (!room) return socket.emit("errorMsg", "找不到这桌企鹅，检查房间号？");
    if (room.game) return socket.emit("errorMsg", "这局已经开始啦");
    if (room.seats.length >= 6) return socket.emit("errorMsg", "这桌已经坐满 6 只企鹅");
    const seat: Seat = {
      id: socket.id,
      name: (name || "企鹅").slice(0, 12),
      type: "human",
      socketId: socket.id,
      connected: true,
    };
    room.seats.push(seat);
    socketRoom.set(socket.id, room.code);
    void socket.join(room.code);
    socket.emit("joined", { playerId: seat.id, code: room.code });
    broadcastLobby(io, room);
  });

  socket.on("setAiDifficulty", ({ aiDifficulty }: { aiDifficulty?: AiDifficulty }) => {
    const room = roomOf(socket.id);
    if (!room || room.hostId !== socket.id || room.game) return;
    room.aiDifficulty = aiDifficulty === "sharp" ? "sharp" : "easy";
    broadcastLobby(io, room);
  });

  socket.on("addAi", ({ aiDifficulty }: { aiDifficulty?: AiDifficulty } = {}) => {
    const room = roomOf(socket.id);
    if (!room || room.hostId !== socket.id) return;
    if (room.game) return;
    if (room.seats.length >= 6) return socket.emit("errorMsg", "已经满员");
    if (aiDifficulty === "sharp" || aiDifficulty === "easy") {
      room.aiDifficulty = aiDifficulty;
    }
    const used = new Set(room.seats.map((s) => s.name));
    const name = AI_NAMES.find((n) => !used.has(n)) ?? `机器人${room.seats.length}`;
    room.seats.push({
      id: `ai-${nanoid()}`,
      name,
      type: "ai",
      socketId: null,
      connected: true,
    });
    broadcastLobby(io, room);
  });

  socket.on("removeSeat", ({ id }: { id: string }) => {
    const room = roomOf(socket.id);
    if (!room || room.hostId !== socket.id || room.game) return;
    const seat = room.seats.find((s) => s.id === id);
    if (!seat || seat.id === room.hostId) return;
    room.seats = room.seats.filter((s) => s.id !== id);
    broadcastLobby(io, room);
  });

  socket.on("startGame", () => {
    const room = roomOf(socket.id);
    if (!room || room.hostId !== socket.id) return;
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

  socket.on("nextRound", () => {
    act(socket.id, { type: "nextRound" });
  });

  socket.on("disconnect", () => {
    const code = socketRoom.get(socket.id);
    socketRoom.delete(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    const seat = room.seats.find((s) => s.socketId === socket.id);
    if (!seat) return;
    if (!room.game) {
      room.seats = room.seats.filter((s) => s.id !== seat.id);
      if (room.seats.length === 0) {
        rooms.delete(code);
        return;
      }
      if (room.hostId === seat.id) {
        const nextHost = room.seats.find((s) => s.type === "human");
        if (nextHost) room.hostId = nextHost.id;
      }
      broadcastLobby(io, room);
      return;
    }
    seat.connected = false;
    seat.socketId = null;
    if (room.game) {
      const idx = room.seats.findIndex((s) => s.id === seat.id);
      if (idx >= 0 && room.game.players[idx]) {
        room.game.players[idx]!.connected = false;
        room.game.players[idx]!.type = "ai";
        seat.type = "ai";
      }
    }
    broadcastLobby(io, room);
    broadcastGame(io, room);
    scheduleAi(io, room);
  });
});

function roomOf(socketId: string): Room | undefined {
  const code = socketRoom.get(socketId);
  return code ? rooms.get(code) : undefined;
}

function act(
  socketId: string,
  action: { type: "bid"; amount: number } | { type: "play"; cardId: string; tigressAs?: TigressAs } | { type: "nextRound" },
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
