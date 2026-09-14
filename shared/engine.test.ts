import { describe, expect, it } from "vitest";
import { choosePlay, runAiUntilHuman, stepAi } from "./ai.ts";
import { applyAction, createGame, nextAiActorIndex, toClientView } from "./engine.ts";
import { legalCards } from "./legal.ts";
import { resolveTrick, scoreRound } from "./scoring.ts";
import type { Card, GameState, PlayedCard, Player } from "./types.ts";

const fish = (n: number) => ({ id: `fish-${n}`, kind: { type: "suit" as const, suit: "fish" as const, rank: n } });
const shell = (n: number) => ({ id: `shell-${n}`, kind: { type: "suit" as const, suit: "shell" as const, rank: n } });
const ice = (n: number) => ({ id: `ice-${n}`, kind: { type: "suit" as const, suit: "ice" as const, rank: n } });
const pirate = (i = 0): Card => ({ id: `pirate-${i}`, kind: { type: "pirate", index: i } });
const mermaid = (i = 0): Card => ({ id: `mermaid-${i}`, kind: { type: "mermaid", index: i } });
const escape = (i = 0): Card => ({ id: `escape-${i}`, kind: { type: "escape", index: i } });
const king = (): Card => ({ id: "king", kind: { type: "king" } });
const tigress = (): Card => ({ id: "tigress", kind: { type: "tigress" } });
const kraken = (): Card => ({ id: "kraken", kind: { type: "kraken" } });
const whale = (): Card => ({ id: "whale", kind: { type: "whale" } });

function play(playerIndex: number, card: Card, tigressAs?: "pirate" | "escape"): PlayedCard {
  return { playerIndex, card, tigressAs };
}

function makeRng(seed = 42): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe("trick resolution", () => {
  it("highest of lead suit wins", () => {
    const r = resolveTrick([play(0, fish(7)), play(1, fish(12)), play(2, fish(8))]);
    expect(r.winnerIndex).toBe(1);
  });

  it("off-suit numbered card loses even if higher", () => {
    const r = resolveTrick([play(0, shell(12)), play(1, shell(5)), play(2, fish(14))]);
    expect(r.winnerIndex).toBe(0);
  });

  it("ice trump beats higher standard suit", () => {
    const r = resolveTrick([play(0, shell(12)), play(1, shell(5)), play(2, ice(2))]);
    expect(r.winnerIndex).toBe(2);
  });

  it("highest ice wins among trumps", () => {
    const r = resolveTrick([play(0, ice(3)), play(1, ice(11)), play(2, fish(14))]);
    expect(r.winnerIndex).toBe(1);
  });

  it("first pirate wins among pirates", () => {
    const r = resolveTrick([play(0, fish(14)), play(1, pirate(0)), play(2, pirate(1))]);
    expect(r.winnerIndex).toBe(1);
  });

  it("mermaid captures the king even with a pirate present", () => {
    const r = resolveTrick([play(0, shell(14)), play(1, pirate()), play(2, king()), play(3, mermaid())]);
    expect(r.winnerIndex).toBe(3);
    expect(r.bonuses.some((b) => b.kind === "kingByMermaid")).toBe(true);
    expect(r.bonuses.some((b) => b.kind === "pirateByKing")).toBe(false);
  });

  it("king beats pirates", () => {
    const r = resolveTrick([play(0, pirate()), play(1, king()), play(2, fish(14))]);
    expect(r.winnerIndex).toBe(1);
    expect(r.bonuses.some((b) => b.kind === "pirateByKing" && b.points === 30)).toBe(true);
  });

  it("all escapes: first card wins", () => {
    const r = resolveTrick([play(0, escape(0)), play(1, escape(1)), play(2, escape(2))]);
    expect(r.winnerIndex).toBe(0);
  });

  it("tigress as pirate beats numbers", () => {
    const r = resolveTrick([play(0, ice(14)), play(1, tigress(), "pirate")]);
    expect(r.winnerIndex).toBe(1);
  });

  it("tigress as escape loses", () => {
    const r = resolveTrick([play(0, fish(1)), play(1, tigress(), "escape")]);
    expect(r.winnerIndex).toBe(0);
  });

  it("kraken destroys the trick and next lead is the would-be winner", () => {
    const r = resolveTrick([play(0, fish(14)), play(1, kraken()), play(2, fish(2))]);
    expect(r.destroyed).toBe(true);
    expect(r.winnerIndex).toBeNull();
    expect(r.nextLeaderIndex).toBe(0);
  });

  it("later beast wins: whale after kraken applies whale", () => {
    const r = resolveTrick([play(0, ice(2)), play(1, kraken()), play(2, shell(14)), play(3, whale())]);
    expect(r.destroyed).toBe(false);
    expect(r.winnerIndex).toBe(2);
  });

  it("whale: highest number wins regardless of suit", () => {
    const r = resolveTrick([play(0, ice(2)), play(1, pirate()), play(2, shell(14)), play(3, whale())]);
    expect(r.winnerIndex).toBe(2);
  });
});

describe("legal plays", () => {
  it("must follow suit with numbered cards but may play specials", () => {
    const hand = [fish(3), shell(9), pirate(), ice(1)];
    const legal = legalCards(hand, [play(0, fish(7))]);
    expect(legal.map((c) => c.id).sort()).toEqual(["fish-3", "pirate-0"].sort());
  });

  it("any card is legal when a character leads", () => {
    const hand = [fish(3), shell(9), ice(1)];
    const legal = legalCards(hand, [play(0, pirate())]);
    expect(legal).toHaveLength(3);
  });

  it("escape lead defers suit to the next numbered card", () => {
    const hand = [fish(3), shell(9)];
    const legal = legalCards(hand, [play(0, escape()), play(1, shell(4))]);
    expect(legal.map((c) => c.id)).toEqual(["shell-9"]);
  });
});

describe("scoring", () => {
  it("awards 20 per trick on a made bid", () => {
    expect(scoreRound({ round: 3, cardsDealt: 3, bid: 3, tricks: 3, capturedBonuses: [], lootBonus: 0 })).toEqual({
      bidPoints: 60,
      bonus: 0,
      total: 60,
    });
  });

  it("penalizes 10 per trick off", () => {
    expect(scoreRound({ round: 4, cardsDealt: 4, bid: 2, tricks: 4, capturedBonuses: [], lootBonus: 0 }).bidPoints).toBe(
      -20,
    );
  });

  it("zero bid uses cards dealt", () => {
    expect(scoreRound({ round: 7, cardsDealt: 7, bid: 0, tricks: 0, capturedBonuses: [], lootBonus: 0 }).bidPoints).toBe(
      70,
    );
    expect(scoreRound({ round: 9, cardsDealt: 9, bid: 0, tricks: 2, capturedBonuses: [], lootBonus: 0 }).bidPoints).toBe(
      -90,
    );
  });

  it("forfeits bonuses on a missed bid", () => {
    const r = scoreRound({
      round: 5,
      cardsDealt: 5,
      bid: 1,
      tricks: 2,
      capturedBonuses: [{ kind: "fourteen", points: 20, label: "冰山 14" }],
      lootBonus: 20,
    });
    expect(r.bonus).toBe(0);
    expect(r.total).toBe(-10);
  });
});

describe("full game", () => {
  it("plays a 2-player round 1 to completion", () => {
    const players: Player[] = [
      { id: "a", name: "圆圆", type: "human", connected: true },
      { id: "b", name: "冰冰", type: "human", connected: true },
    ];
    let state = createGame(players, { expansion: false, maxRounds: 10 }, makeRng(7));
    expect(state.hands[0]).toHaveLength(1);
    state = applyAction(state, { type: "bid", playerIndex: 0, amount: 0 });
    state = applyAction(state, { type: "bid", playerIndex: 1, amount: 1 });
    expect(state.phase).toBe("playing");
    const first = state.currentPlayerIndex;
    const second = 1 - first;
    const firstCard = state.hands[first]![0]!;
    state = applyAction(state, {
      type: "play",
      playerIndex: first,
      cardId: firstCard.id,
      tigressAs: firstCard.kind.type === "tigress" ? "escape" : undefined,
    });
    const last = state.hands[second]![0]!;
    state = applyAction(state, {
      type: "play",
      playerIndex: second,
      cardId: last.id,
      tigressAs: last.kind.type === "tigress" ? "escape" : undefined,
    });
    expect(state.phase).toBe("collecting");
    expect(state.currentTrick).toHaveLength(2);
    state = applyAction(state, { type: "collect", playerIndex: 0 });
    expect(state.phase).toBe("collecting");
    state = applyAction(state, { type: "collect", playerIndex: 1 });
    expect(state.phase).toBe("roundEnd");
    expect(state.history[0]).toHaveLength(1);
  });

  it("four AIs finish a 10-round game without crashing", () => {
    const players: Player[] = [
      { id: "1", name: "圆圆", type: "ai", connected: true },
      { id: "2", name: "冰冰", type: "ai", connected: true },
      { id: "3", name: "波波", type: "ai", connected: true },
      { id: "4", name: "朵朵", type: "ai", connected: true },
    ];
    let state = createGame(players, { expansion: true, maxRounds: 10 }, makeRng(99));
    for (let i = 0; i < 20; i++) {
      state = runAiUntilHuman(state, makeRng(100 + i));
      if (state.phase === "gameEnd") break;
      if (state.phase === "roundEnd") {
        state = applyAction(state, { type: "nextRound" }, makeRng(200 + i));
      }
    }
    expect(state.phase).toBe("gameEnd");
    expect(state.round).toBe(10);
    expect(state.winnerIndices.length).toBeGreaterThan(0);
    expect(state.history[0]).toHaveLength(10);
  });

  it("four sharp AIs finish a 10-round game without crashing", () => {
    const players: Player[] = [
      { id: "1", name: "圆圆", type: "ai", connected: true },
      { id: "2", name: "冰冰", type: "ai", connected: true },
      { id: "3", name: "波波", type: "ai", connected: true },
      { id: "4", name: "朵朵", type: "ai", connected: true },
    ];
    let state = createGame(players, { expansion: true, maxRounds: 10, aiDifficulty: "sharp" }, makeRng(42));
    for (let i = 0; i < 20; i++) {
      state = runAiUntilHuman(state, makeRng(300 + i));
      if (state.phase === "gameEnd") break;
      if (state.phase === "roundEnd") {
        state = applyAction(state, { type: "nextRound" }, makeRng(400 + i));
      }
    }
    expect(state.phase).toBe("gameEnd");
    expect(state.config.aiDifficulty).toBe("sharp");
    expect(state.winnerIndices.length).toBeGreaterThan(0);
  });

  it("four hard AIs finish a 10-round game without crashing", () => {
    const players: Player[] = [
      { id: "1", name: "圆圆", type: "ai", connected: true },
      { id: "2", name: "冰冰", type: "ai", connected: true },
      { id: "3", name: "波波", type: "ai", connected: true },
      { id: "4", name: "朵朵", type: "ai", connected: true },
    ];
    let state = createGame(players, { expansion: true, maxRounds: 10, aiDifficulty: "hard" }, makeRng(42));
    for (let i = 0; i < 20; i++) {
      state = runAiUntilHuman(state, makeRng(500 + i));
      if (state.phase === "gameEnd") break;
      if (state.phase === "roundEnd") {
        state = applyAction(state, { type: "nextRound" }, makeRng(600 + i));
      }
    }
    expect(state.phase).toBe("gameEnd");
    expect(state.config.aiDifficulty).toBe("hard");
    expect(state.winnerIndices.length).toBeGreaterThan(0);
  }, 20000);
});

describe("hard AI tactics", () => {
  function hardState(playerCount: number, over: Partial<GameState> & { hands: Card[][] }) {
    const players: Player[] = Array.from({ length: playerCount }, (_, i) => ({
      id: String(i),
      name: `p${i}`,
      type: "ai" as const,
      connected: true,
    }));
    return {
      ...createGame(players, { expansion: false, maxRounds: 10, aiDifficulty: "hard" }, makeRng(1)),
      phase: "playing" as const,
      bids: players.map(() => 1),
      tricksWon: players.map(() => 0),
      leaderIndex: 0,
      currentPlayerIndex: 1,
      ...over,
    };
  }

  it("captures the penguin king with a mermaid when it still needs the trick", () => {
    const state = hardState(2, {
      currentTrick: [{ playerIndex: 0, card: king() }],
      hands: [[fish(4)], [mermaid(0), fish(3), escape(0)]],
    });
    expect(choosePlay(state, 1).cardId).toBe("mermaid-0");
  });

  it("ducks the king with an escape when bidding zero", () => {
    const state = hardState(2, {
      bids: [1, 0],
      currentTrick: [{ playerIndex: 0, card: king() }],
      hands: [[fish(4)], [mermaid(0), escape(0)]],
    });
    expect(choosePlay(state, 1).cardId).toBe("escape-0");
  });

  it("does not dump the king on a cheap trick while someone else can still play", () => {
    const state = hardState(3, {
      bids: [0, 1, 1],
      currentTrick: [{ playerIndex: 0, card: fish(4) }],
      hands: [[shell(6)], [king(), fish(8), escape(1)], [shell(3)]],
    });
    expect(choosePlay(state, 1).cardId).not.toBe("king");
  });
});

describe("AI thinking steps", () => {
  it("stepAi fills only one AI bid at a time", () => {
    const players: Player[] = [
      { id: "h", name: "你", type: "human", connected: true },
      { id: "1", name: "圆圆", type: "ai", connected: true },
      { id: "2", name: "冰冰", type: "ai", connected: true },
    ];
    let state = createGame(players, { expansion: false, maxRounds: 10 }, makeRng(1));
    expect(nextAiActorIndex(state)).toBe(1);
    expect(toClientView(state, 0).thinkingPlayerIndex).toBe(1);

    state = stepAi(state, makeRng(2));
    const filled = state.bids.filter((b, i) => state.players[i]!.type === "ai" && b !== null);
    expect(filled).toHaveLength(1);
    expect(nextAiActorIndex(state)).toBe(2);

    state = stepAi(state, makeRng(3));
    expect(state.bids[1]).not.toBeNull();
    expect(state.bids[2]).not.toBeNull();
    expect(state.bids[0]).toBeNull();
    expect(nextAiActorIndex(state)).toBeNull();
    expect(toClientView(state, 0).thinkingPlayerIndex).toBeNull();
  });
});

describe("trick collect", () => {
  it("waits for the human to collect while AIs are already ready", () => {
    const players: Player[] = [
      { id: "h", name: "你", type: "human", connected: true },
      { id: "1", name: "圆圆", type: "ai", connected: true },
    ];
    let state = createGame(players, { expansion: false, maxRounds: 10 }, makeRng(3));
    state = applyAction(state, { type: "bid", playerIndex: 0, amount: 0 });
    state = runAiUntilHuman(state, makeRng(4));
    while (state.phase === "playing") {
      const actor = state.currentPlayerIndex;
      if (state.players[actor]!.type === "ai") {
        state = runAiUntilHuman(state, makeRng(5));
        continue;
      }
      const card = state.hands[actor]![0]!;
      state = applyAction(state, {
        type: "play",
        playerIndex: actor,
        cardId: card.id,
        tigressAs: card.kind.type === "tigress" ? "escape" : undefined,
      });
    }
    expect(state.phase).toBe("collecting");
    expect(state.collectReady[1]).toBe(true);
    expect(state.collectReady[0]).toBe(false);
    expect(toClientView(state, 0).youCollected).toBe(false);
    expect(state.currentTrick).toHaveLength(2);
    state = applyAction(state, { type: "collect", playerIndex: 0 });
    expect(state.phase).toBe("roundEnd");
  });
});
