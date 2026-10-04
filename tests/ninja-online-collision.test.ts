import { test } from "node:test";
import assert from "node:assert/strict";
import { createRoom, joinRoom, tickRoom } from "../lib/ninja-online.ts";

test("an enemy pursuing one player cannot walk into a different player's occupied tile", () => {
  const room = createRoom("survival", 1000); joinRoom(room, "a", "Blocker", "hashA", 1000); joinRoom(room, "b", "Target", "hashB", 1000);
  room.game.tiles.fill(0); Object.assign(room.players.a.personal, { x: 24, y: 10 }); Object.assign(room.players.b.personal, { x: 23, y: 10 });
  room.game.enemies[0] = { x: 25, y: 10, hp: 3, kind: "rogue" };
  tickRoom(room, 1400); assert.equal(room.game.enemies[0].x, 25); assert.equal(room.game.enemies[0].y, 10);
  assert.equal(room.players.a.personal.x, 24); assert.equal(room.players.b.personal.x, 23);
});
