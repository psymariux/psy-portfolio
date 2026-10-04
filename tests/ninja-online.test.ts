import { test } from "node:test";
import assert from "node:assert/strict";
import { createRoom, joinRoom, roomView, parseIntent, applyIntent, readRoom, tickRoom, PRESENCE_MS } from "../lib/ninja-online.ts";
import { tileAt, streamWorld } from "../lib/ninja-game.ts";

test("online worlds enforce eight active players, preserve rejoining inventories and hide credentials", () => {
  const r = createRoom("survival", 1000);
  for (let i = 0; i < 8; i++) joinRoom(r, String(i), `Player ${i}`, `secret${i}`, 1000);
  assert.throws(() => joinRoom(r, "8", "Ninth", "secret8", 1000), /full/);
  r.players["0"].personal.wood = 77;
  joinRoom(r, "0", "Ignored new name", "secret0", 1001); assert.equal(r.players["0"].personal.wood, 77);
  assert.throws(() => joinRoom(r, "0", "Impostor", "wrong", 1001), /Invalid player/);
  const view = roomView(r, "a".repeat(24), "0", 1001); assert.equal(view.players.length, 8); assert.ok(!JSON.stringify(view).includes("secret"));
  joinRoom(r, "8", "New player", "secret8", 1001 + PRESENCE_MS); assert.equal(roomView(r, "a".repeat(24), "8", 1001 + PRESENCE_MS).players.length, 1);
  assert.equal(readRoom(JSON.stringify(r)).players["0"].personal.wood, 77);
});

test("server validates intents, collision, rate limits and replay sequences rather than trusting client saves", () => {
  for (const input of [{ kind: ["eye"], facing: [1, 0] }, { kind: "cast", jutsu: ["fire"], facing: [1, 0] }, { kind: "move", facing: [10, 0] }, { kind: "build", facing: [1, 0], material: "admin" }, { kind: "teleport", facing: [1, 0] }, { kind: "craft", recipe: "hack" }, { kind: "claim", mission: "hack" }]) assert.throws(() => parseIntent(input));
  const r = createRoom("survival", 1000); joinRoom(r, "a", "Psy", "hash", 1000); r.game.tiles.fill(0); r.players.a.personal.x = 25; r.players.a.personal.y = 10;
  applyIntent(r, "a", parseIntent({ kind: "build", facing: [1, 0], material: "wood", wood: 999 }), 1, 1500);
  assert.equal(tileAt(r.game, 26, 10), 5); assert.equal(r.players.a.personal.wood, 7);
  assert.throws(() => applyIntent(r, "a", { kind: "recover", facing: [1, 0] }, 1, 1800), /sequence/);
  applyIntent(r, "a", { kind: "recover", facing: [1, 0] }, 2, 1800); assert.equal(r.players.a.personal.wood, 8);
  applyIntent(r, "a", { kind: "move", facing: [1, 0] }, 3, 2000); const x = r.players.a.personal.x;
  applyIntent(r, "a", { kind: "move", facing: [1, 0] }, 4, 2001); assert.equal(r.players.a.personal.x, x);
});

test("creative placement uses unlimited materials while shared builds cannot intersect an active player", () => {
  const r = createRoom("creative", 1000); joinRoom(r, "a", "Builder", "hash", 1000); joinRoom(r, "b", "Friend", "hash2", 1000);
  r.game.tiles.fill(0); Object.assign(r.players.a.personal, { x: 25, y: 10, wood: 0 }); Object.assign(r.players.b.personal, { x: 26, y: 10 });
  assert.match(applyIntent(r, "a", { kind: "build", facing: [1, 0], material: "wood" }, 1, 1500), /player/); assert.equal(tileAt(r.game, 26, 10), 0);
  r.players.b.personal.x = 28;
  assert.match(applyIntent(r, "a", { kind: "build", facing: [1, 0], material: "wood" }, 2, 1800), /placed/); assert.equal(tileAt(r.game, 26, 10), 5); assert.equal(r.players.a.personal.wood, 0);
  const elapsed = r.game.elapsed; tickRoom(r, 1900); assert.ok(r.game.elapsed > elapsed);
});

test("stored rooms fail closed for incomplete player records, array maps and corrupt clocks", () => {
  const r = createRoom("survival", 1000); joinRoom(r, "a", "Owner", "hash", 1000);
  assert.doesNotThrow(() => readRoom(JSON.stringify(r)));
  assert.throws(() => readRoom(JSON.stringify({ ...r, players: [] })), /Stored world/);
  assert.throws(() => readRoom(JSON.stringify({ ...r, revision: -1 })), /Stored world/);
  Reflect.deleteProperty(r.players.a.personal, "wood"); assert.throws(() => readRoom(JSON.stringify(r)), /Stored player/);
  r.players.a.personal.wood = 8; r.updatedAt = Number.NaN; assert.throws(() => readRoom(JSON.stringify(r)), /clock/);
});

test("world borders cannot take building stocks or charge chakra for a rejected dash", () => {
  const r = createRoom("survival", 1000); joinRoom(r, "a", "Builder", "hash", 1000);
  Object.assign(r.players.a.personal, { x: 2048, y: 100, chakra: 80 }); Object.assign(r.game, { x: 2048, y: 100 });
  for (let x = 2048; x <= 2051; x++) r.game.world.changes[`${x},100`] = 0;
  streamWorld(r.game); for (const e of r.game.roamers) { e.hp = 0; if (e.id) r.game.world.foes[e.id] = { x: e.x, y: e.y, hp: 0 }; }
  assert.match(applyIntent(r, "a", { kind: "build", material: "campfire", facing: [1, 0] }, 1, 1150), /boundary/);
  assert.equal(r.game.world.changes["2049,100"], 0);
  assert.match(applyIntent(r, "a", { kind: "dash", facing: [1, 0] }, 2, 1450), /boundary/);
  assert.equal(r.players.a.personal.x, 2048); assert.ok(r.players.a.personal.chakra >= 80);
});
