import { test } from "node:test";
import assert from "node:assert/strict";
import { createRoom, joinRoom, applyIntent, tickRoom, readRoom, activePlayers } from "../lib/ninja-online.ts";

test("shared projectile kills credit the shooter and hostile shots hit the actual player", () => {
  let room = createRoom("survival", 1000);
  const a = "a".repeat(16), b = "b".repeat(16);
  joinRoom(room, a, "Archer", "hashA", 1000); joinRoom(room, b, "Friend", "hashB", 1000);
  room.game.tiles.fill(0); Object.assign(room.players[a].personal, { x: 25, y: 10 }); Object.assign(room.players[b].personal, { x: 27, y: 10 });
  room.game.enemies[0] = { x: 26, y: 10, hp: 2, kind: "rogue" };
  applyIntent(room, a, { kind: "cast", facing: [1, 0], jutsu: "kunai" }, 1, 1400);
  room = readRoom(JSON.stringify(room)); tickRoom(room, 1550);
  assert.equal(room.players[a].personal.totals.defeated, 1); assert.equal(room.players[b].personal.totals.defeated, 0);
  const hp = room.players[b].personal.hp; room.players[b].personal.hurtUntil = 0;
  room.game.projectiles = [{ x: 26, y: 10, dx: 1, dy: 0, left: 2, damage: 1, hostile: true, kind: "kunai" }];
  tickRoom(room, 2000); assert.equal(room.players[b].personal.hp, hp - 1);
});

test("stale clock attempts cannot regress world time and a disconnected seat is free", () => {
  const room = createRoom("survival", 1000); joinRoom(room, "a", "Psy", "hash", 1000);
  tickRoom(room, 1500); const elapsed = room.game.elapsed;
  tickRoom(room, 1200); assert.equal(room.updatedAt, 1500); assert.equal(room.game.elapsed, elapsed);
  room.players.a.seen = 0; assert.equal(activePlayers(room, 1600).length, 0);
});
