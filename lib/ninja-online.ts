import { createGame, readSave, movePlayer, jump, interact, mine, build, craft, cast, heal, dash, recall, collectScroll, claimMission, stepEnemies, stepProjectiles, streamWorld, materials, recipes, missions, tileAt, canStand, type GameState, type Facing, type Material, type RecipeId, type Mission, type Jutsu } from "./ninja-game.ts";

export class OnlineError extends Error {}
export const MAX_PLAYERS = 8, PRESENCE_MS = 45_000;
export type GameMode = "survival" | "creative";
export type Intent = { kind: "move"; facing: Facing; sprint?: boolean } | { kind: "jump" | "interact" | "recover" | "heal" | "dash" | "recall" | "village" | "scroll" | "eye"; facing: Facing } | { kind: "build"; facing: Facing; material: Material } | { kind: "craft"; recipe: RecipeId } | { kind: "claim"; mission: Mission } | { kind: "cast"; facing: Facing; jutsu: Jutsu };
const personalKeys = ["x", "y", "facing", "hp", "chakra", "wood", "stone", "inventory", "quests", "missions", "upgrades", "scrolls", "spawn", "hurtUntil", "totals"] as const;
type Personal = Pick<GameState, typeof personalKeys[number]>;
export type OnlinePlayer = { id: string; name: string; x: number; y: number; facing: Facing };
type Member = { name: string; tokenHash: string; personal: Personal; seen: number; moveAt: number; actionAt: number; seq: number; socketId?: string };
export type Room = { schema: 1; mode: GameMode; game: GameState; players: Record<string, Member>; revision: number; updatedAt: number; enemyAt: number; projectileAt: number; freezeUntil: number };
export type RoomView = { code: string; playerId: string; mode: GameMode; revision: number; freeze: number; game: GameState; players: OnlinePlayer[] };
export const validCode = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{24}$/.test(value);
export const validName = (value: unknown): value is string => typeof value === "string" && /^[\p{L}\p{N}_ -]{1,20}$/u.test(value.trim());
export function parseIntent(value: unknown): Intent {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new OnlineError("Invalid action.");
  const a = value as Record<string, unknown>, kind = a.kind;
  if (typeof kind !== "string") throw new OnlineError("Invalid action type.");
  if (kind === "craft" && recipes.some(r => r.id === a.recipe)) return { kind, recipe: a.recipe as RecipeId };
  if (kind === "claim" && missions.includes(a.mission as Mission)) return { kind, mission: a.mission as Mission };
  const f = a.facing;
  if (!Array.isArray(f) || f.length !== 2 || !f.every(n => Number.isInteger(n) && Math.abs(n) <= 1) || Math.abs(f[0]) + Math.abs(f[1]) !== 1) throw new OnlineError("Invalid direction.");
  const facing = f as Facing;
  if (kind === "move" && (a.sprint === undefined || typeof a.sprint === "boolean")) return { kind, facing, sprint: a.sprint as boolean | undefined };
  if (kind === "build" && materials.includes(a.material as Material)) return { kind, facing, material: a.material as Material };
  if (kind === "cast" && typeof a.jutsu === "string" && ["kunai", "fire", "wind", "lightning"].includes(a.jutsu)) return { kind, facing, jutsu: a.jutsu as Jutsu };
  if (["jump", "interact", "recover", "heal", "dash", "recall", "village", "scroll", "eye"].includes(kind)) return { kind, facing } as Intent;
  throw new OnlineError("Unknown action.");
}
function personal(s: GameState): Personal { return structuredClone(Object.fromEntries(personalKeys.map(k => [k, s[k]]))) as Personal; }
export function activePlayers(room: Room, now: number) { return Object.entries(room.players).filter(([, p]) => p.seen > 0 && now - p.seen < PRESENCE_MS); }
function spawnNearCamp(s: GameState, occupied: Set<string>) {
  for (let r = 0; r <= 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.abs(dx) + Math.abs(dy) !== r) continue;
    const x = 10 + dx, y = 16 + dy;
    if (canStand(s, x, y) && !occupied.has(`${x},${y}`)) { s.x = x; s.y = y; return; }
  }
  throw new OnlineError("No clear spawn tile. Ask a friend to clear space near camp.");
}
export function playerGame(room: Room, id: string): GameState {
  const p = room.players[id]; if (!p) throw new OnlineError("Player not found.");
  const s = { ...room.game, ...structuredClone(p.personal) };
  if (!canStand(s, s.x, s.y)) spawnNearCamp(s, new Set(Object.entries(room.players).filter(([key, p]) => key !== id && room.updatedAt - p.seen < PRESENCE_MS).map(([, p]) => `${p.personal.x},${p.personal.y}`)));
  if ((s.spawn.x !== 10 || s.spawn.y !== 16) && tileAt(s, s.spawn.x, s.spawn.y) !== 16) s.spawn = { x: 10, y: 16 };
  return s;
}
export function createRoom(mode: GameMode, now: number): Room {
  return { schema: 1, mode, game: createGame(), players: {}, revision: 0, updatedAt: now, enemyAt: now, projectileAt: now, freezeUntil: 0 };
}
export function joinRoom(room: Room, id: string, name: string, tokenHash: string, now: number) {
  if (!validName(name)) throw new OnlineError("Use a name of 1–20 letters, numbers, spaces, underscores or hyphens.");
  const existing = room.players[id], active = activePlayers(room, now);
  if (!existing || existing.seen <= 0 || now - existing.seen >= PRESENCE_MS) if (active.length >= MAX_PLAYERS) throw new OnlineError("This world is full (8/8 players).");
  if (existing) {
    if (existing.tokenHash !== tokenHash) throw new OnlineError("Invalid player session.");
    existing.seen = now;
    const s = playerGame(room, id);
    if (active.some(([key, other]) => key !== id && other.personal.x === s.x && other.personal.y === s.y)) spawnNearCamp(s, new Set(active.filter(([key]) => key !== id).map(([, p]) => `${p.personal.x},${p.personal.y}`)));
    existing.personal = personal(s); return;
  }
  if (Object.keys(room.players).length >= 64) throw new OnlineError("This world's saved player limit has been reached.");
  const s = createGame(room.game.world.seed);
  // New arrivals use the shared terrain but keep their own inventory and progression.
  s.tiles = room.game.tiles; s.world = room.game.world; s.enemies = room.game.enemies; s.roamers = room.game.roamers;
  const occupied = new Set(active.map(([, p]) => `${p.personal.x},${p.personal.y}`));
  spawnNearCamp(s, occupied);
  room.players[id] = { name: name.trim(), tokenHash, personal: personal(s), seen: now, moveAt: 0, actionAt: 0, seq: 0 };
}
export function roomView(room: Room, code: string, id: string, now: number): RoomView {
  const game = playerGame(room, id); game.world = { ...game.world, explored: { ...game.world.explored } }; streamWorld(game);
  return { code, playerId: id, mode: room.mode, revision: room.revision, freeze: Math.max(0, (room.freezeUntil - now) / 1000), game, players: activePlayers(room, now).map(([id, p]) => ({ id, name: p.name, x: p.personal.x, y: p.personal.y, facing: p.personal.facing })) };
}
function commitPlayer(room: Room, id: string, s: GameState) { room.game = s; room.players[id].personal = personal(s); }
export function tickRoom(room: Room, now: number) {
  now = Math.max(now, room.updatedAt);
  const active = activePlayers(room, now); if (!active.length) { room.updatedAt = now; return; }
  const elapsed = Math.min(1, Math.max(0, (now - room.updatedAt) / 1000)); room.updatedAt = now;
  room.game.elapsed += elapsed;
  for (const [, p] of active) p.personal.chakra = Math.min(100, p.personal.chakra + elapsed * 5);
  // One shared clock; no per-client simulation can duplicate enemies or projectile steps.
  // ponytail: enemy turns rotate through at most eight active players; add per-mob targeting only if needed.
  const frozen = now < room.freezeUntil;
  type Shot = GameState["projectiles"][number] & { owner?: string };
  if (now - room.projectileAt >= 110) {
    room.projectileAt = now;
    const groups = new Map<string, Shot[]>(), survivors: Shot[] = [];
    for (const p of room.game.projectiles as Shot[]) {
      const target = p.hostile ? active.find(([, m]) => m.personal.x === p.x + p.dx && m.personal.y === p.y + p.dy)?.[0] : p.owner;
      const owner = target && room.players[target] ? target : active[0][0];
      if (!groups.has(owner)) groups.set(owner, []); groups.get(owner)!.push(p);
    }
    for (const [owner, shots] of groups) {
      const s = playerGame(room, owner); streamWorld(s); s.projectiles = shots; stepProjectiles(s, frozen);
      if (room.mode === "creative") s.hp = s.upgrades.includes("armor") ? 8 : 6;
      if (active.some(([key, p]) => key !== owner && p.personal.x === s.x && p.personal.y === s.y)) spawnNearCamp(s, new Set(active.filter(([key]) => key !== owner).map(([, p]) => `${p.personal.x},${p.personal.y}`)));
      survivors.push(...s.projectiles); commitPlayer(room, owner, s);
    }
    room.game.projectiles = survivors;
  }
  const [id] = active[Math.floor(now / 750) % active.length], s = playerGame(room, id);
  streamWorld(s);
  if (!frozen && now - room.enemyAt >= 750) {
    room.enemyAt = now;
    const positions = [...s.enemies, ...s.roamers].map(e => ({ enemy: e, x: e.x, y: e.y }));
    stepEnemies(s, Math.floor(now / 750));
    for (const { enemy, x, y } of positions) if (active.some(([, p]) => p.personal.x === enemy.x && p.personal.y === enemy.y)) {
      enemy.x = x; enemy.y = y; if (enemy.id) s.world.foes[enemy.id] = { x, y, hp: enemy.hp };
    }
  }
  if (active.some(([key, p]) => key !== id && p.personal.x === s.x && p.personal.y === s.y)) spawnNearCamp(s, new Set(active.filter(([key]) => key !== id).map(([, p]) => `${p.personal.x},${p.personal.y}`)));
  if (room.mode === "creative") { s.hp = s.upgrades.includes("armor") ? 8 : 6; s.chakra = 100; }
  commitPlayer(room, id, s);
}
export function applyIntent(room: Room, id: string, intent: Intent, seq: number, now: number): string {
  const p = room.players[id]; if (!p) throw new OnlineError("Player not found.");
  if (!Number.isSafeInteger(seq) || seq <= p.seq || seq > p.seq + 1000) throw new OnlineError("Invalid action sequence. Reconnect to synchronize.");
  p.seq = seq; p.seen = now;
  const moving = intent.kind === "move", cooldown = moving ? intent.sprint ? 65 : 115 : intent.kind === "jump" ? 380 : 220;
  if (now - (moving ? p.moveAt : p.actionAt) < cooldown) return "";
  if (moving) p.moveAt = now; else p.actionAt = now;
  tickRoom(room, now);
  const s = playerGame(room, id), old = { x: s.x, y: s.y, chakra: s.chakra };
  if ("facing" in intent) s.facing = intent.facing;
  const others = activePlayers(room, now).filter(([key]) => key !== id).map(([, m]) => m.personal);
  if (intent.kind === "build" && (Math.abs(s.x + s.facing[0]) > 2048 || Math.abs(s.y + s.facing[1]) > 2048)) return "Online world boundary reached.";
  if (intent.kind === "build" && others.some(o => o.x === s.x + s.facing[0] && o.y === s.y + s.facing[1])) return "A player is standing on that tile.";
  if (intent.kind === "jump" && others.some(o => o.x === s.x + s.facing[0] && o.y === s.y + s.facing[1])) return "A player is standing in the jump path.";
  let message = "";
  if (intent.kind === "move") movePlayer(s, ...intent.facing);
  else if (intent.kind === "jump") message = jump(s);
  else if (intent.kind === "interact") message = interact(s);
  else if (intent.kind === "recover") message = mine(s);
  else if (intent.kind === "build") {
    if (room.mode === "creative") {
      const before = intent.material === "wood" ? s.wood : intent.material === "stone" ? s.stone : s.inventory[intent.material];
      if (intent.material === "wood") s.wood = Math.max(1, before); else if (intent.material === "stone") s.stone = Math.max(1, before); else s.inventory[intent.material] = Math.max(1, before);
      message = build(s, intent.material);
      if (intent.material === "wood") s.wood = before; else if (intent.material === "stone") s.stone = before; else s.inventory[intent.material] = before;
    } else message = build(s, intent.material);
  }
  else if (intent.kind === "craft") message = craft(s, intent.recipe);
  else if (intent.kind === "claim") message = claimMission(s, intent.mission);
  else if (intent.kind === "cast") { const count = s.projectiles.length; message = cast(s, intent.jutsu); for (const p of s.projectiles.slice(count)) (p as typeof p & { owner?: string }).owner = id; }
  else if (intent.kind === "heal") message = heal(s);
  else if (intent.kind === "dash") message = dash(s);
  else if (intent.kind === "recall" || intent.kind === "village") message = recall(s, intent.kind === "village");
  else if (intent.kind === "scroll") message = collectScroll(s);
  else if (s.scrolls.length < 3 || s.chakra < 50) message = "Mangekyo needs three scrolls and 50 chakra.";
  else { s.chakra -= 50; room.freezeUntil = now + 5000; message = "Mangekyo: enemies frozen for 5 seconds."; }
  if (others.some(o => o.x === s.x && o.y === s.y)) { s.x = old.x; s.y = old.y; s.chakra = old.chakra; message = "A player is standing there."; }
  if (Math.abs(s.x) > 2048 || Math.abs(s.y) > 2048) { s.x = old.x; s.y = old.y; s.chakra = old.chakra; message = "Online world boundary reached."; }
  if (Object.keys(s.world.changes).length > 16000 || Object.keys(s.world.explored).length > 4096) throw new OnlineError("This world has reached its saved terrain limit. Export a backup.");
  commitPlayer(room, id, s); return message;
}
export function readRoom(raw: string): Room {
  const room = JSON.parse(raw) as Room;
  if (!room || room.schema !== 1 || !["creative", "survival"].includes(room.mode) || !room.players || typeof room.players !== "object" || Array.isArray(room.players) || Object.keys(room.players).length > 64 || !Number.isSafeInteger(room.revision) || room.revision < 0) throw new OnlineError("Stored world could not be read.");
  for (const p of Object.values(room.players)) if (!p || !validName(p.name) || typeof p.tokenHash !== "string" || !p.tokenHash || !p.personal || !personalKeys.every(k => Object.hasOwn(p.personal, k)) || ![p.seen, p.moveAt, p.actionAt, p.seq].every(n => Number.isSafeInteger(n) && n >= 0)) throw new OnlineError("Stored player could not be read.");
  if (![room.updatedAt, room.enemyAt, room.projectileAt, room.freezeUntil].every(n => Number.isSafeInteger(n) && n >= 0)) throw new OnlineError("Stored world clock could not be read.");
  const shots = room.game.projectiles as (GameState["projectiles"][number] & { owner?: string })[];
  room.game = readSave(JSON.stringify(room.game), true);
  room.game.projectiles.forEach((p, i) => { const owner = shots[i].owner; if (owner && room.players[owner]) (p as typeof p & { owner?: string }).owner = owner; });
  return room;
}
