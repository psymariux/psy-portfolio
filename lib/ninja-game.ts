import { CHUNK_SIZE, DEFAULT_SEED, pointKey, villageTile, generatedTile, groundTile, worldChunk, biomeAt, biomeNames, type WildEnemy } from "./ninja-world.ts";

// Legacy dimensions describe the starting village, never the world boundary.
export const WORLD_W = 40, WORLD_H = 32, SAVE_KEY = "psymariux:ninja-sandbox:v1";
export type WorldState = { seed: number; changes: Record<string, number>; explored: Record<string, true>; foes: Record<string, { x: number; y: number; hp: number }> };
export const tileNames = ["grass", "path", "water", "tree", "rock", "wood", "stone", "bridge", "flowers", "sand", "house", "ruin", "garden", "fence", "lantern", "workbench", "campfire", "crop", "supply_cache", "snow", "ore", "soil", "seedling", "trail", "brick"] as const;
export type Facing = [number, number];
export type EnemyKind = "rogue" | "archer" | "guard" | "warden";
export type Ninja = { x: number; y: number; hp: number; kind: EnemyKind; id?: string };
export type Jutsu = "kunai" | "fire" | "wind" | "lightning";
export type Material = "wood" | "stone" | "bridge" | "fence" | "lantern" | "campfire" | "garden" | "trail" | "brick";
export const materials: Material[] = ["wood", "stone", "trail", "brick", "bridge", "fence", "lantern", "campfire", "garden"];
export type Inventory = { herb: number; ore: number; medicine: number; bridge: number; fence: number; lantern: number; campfire: number; garden: number; trail: number; brick: number };
export type Quest = "supplies" | "herbalist" | "warden";
export type Mission = "trailblazer" | "homesteader" | "vanguard";
export const missions: readonly Mission[] = ["trailblazer", "homesteader", "vanguard"];
export type Projectile = { x: number; y: number; dx: number; dy: number; left: number; damage: number; hostile: boolean; kind: Jutsu };
export type GameState = {
  version: 3; savedAt: number; world: WorldState; roamers: WildEnemy[]; spawn: { x: number; y: number }; crops: Record<string, number>;
  elapsed: number; hurtUntil: number; totals: { built: number; harvested: number; defeated: number };
  tiles: number[]; x: number; y: number; facing: Facing;
  hp: number; chakra: number; wood: number; stone: number; scrolls: number[]; enemies: Ninja[];
  inventory: Inventory; quests: Quest[]; missions: Mission[]; upgrades: ("kunai" | "armor")[]; projectiles: Projectile[];
};
export const camp = { x: 10, y: 16 };
export const shrines = [{ x: 7, y: 7 }, { x: 32, y: 8 }, { x: 30, y: 25 }];
export const npcs = [
  { id: "supplies", name: "Kiyo", role: "village keeper", x: 8, y: 17, color: "#bb729b" },
  { id: "builder", name: "Ren", role: "craftsperson", x: 13, y: 17, color: "#dfae55" },
  { id: "herbalist", name: "Aoi", role: "forest ranger", x: 7, y: 10, color: "#62b99b" },
] as const;
export const houses = [{ x: 3, y: 12, w: 4, h: 3 }, { x: 3, y: 20, w: 4, h: 3 }, { x: 12, y: 21, w: 4, h: 3 }];
export const solid = (tile: number) => [2, 3, 4, 5, 6, 10, 11, 13, 14, 15, 18, 20, 24].includes(tile);
const inside = (x: number, y: number) => x >= 1 && x < WORLD_W - 1 && y >= 1 && y < WORLD_H - 1;
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const coordinate = (v: number) => Number.isSafeInteger(v) && Math.abs(v) < Number.MAX_SAFE_INTEGER - 100;
export function tileAt(s: GameState, x: number, y: number) {
  if (!coordinate(x) || !coordinate(y)) return 4;
  const tile = villageTile(x, y) ? s.tiles[y * WORLD_W + x] : s.world?.changes[pointKey(x, y)] ?? generatedTile(s.world?.seed ?? DEFAULT_SEED, x, y);
  return tile === 22 && s.crops?.[pointKey(x, y)] <= s.elapsed ? 17 : tile;
}
export function setTile(s: GameState, x: number, y: number, tile: number) {
  if (villageTile(x, y)) s.tiles[y * WORLD_W + x] = tile;
  else s.world.changes[pointKey(x, y)] = tile;
  if (tile !== 22) delete s.crops[pointKey(x, y)];
  if (s.spawn.x === x && s.spawn.y === y && tile !== 16) s.spawn = { ...camp };
}
export const allEnemies = (s: GameState): Ninja[] => [...s.enemies, ...s.roamers];
export function streamWorld(s: GameState) {
  const cx = Math.floor(s.x / CHUNK_SIZE), cy = Math.floor(s.y / CHUNK_SIZE), active = new Map(s.roamers.map(e => [e.id, e]));
  s.world.explored[pointKey(cx, cy)] = true;
  // Keep nearby pursuers when their original spawn chunk leaves the window.
  const nearby = new Map(s.roamers.filter(e => e.hp && distance(e, s) <= 12).map(e => [e.id, e]));
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const chunk = worldChunk(s.world.seed, cx + dx, cy + dy);
    for (const original of chunk.enemies) {
      const e = active.get(original.id) ?? { ...original, ...s.world.foes[original.id] };
      if (e.hp && !solid(tileAt(s, e.x, e.y))) nearby.set(e.id, e);
    }
  }
  s.roamers = [...nearby.values()].sort((a, b) => distance(a, s) - distance(b, s)).slice(0, 18);
}
export function advanceWorld(s: GameState, dt: number) { if (Number.isFinite(dt) && dt > 0) s.elapsed += Math.min(dt, 1); }
export const daylight = (s: GameState) => s.elapsed % 240 < 180;
export function nearbyCamp(s: GameState, x = s.x, y = s.y) {
  if (distance({ x, y }, camp) <= 1) return { ...camp };
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) if (tileAt(s, x + dx, y + dy) === 16) return { x: x + dx, y: y + dy };
  return null;
}
export const maxHp = (s: GameState) => s.upgrades.includes("armor") ? 8 : 6;
export const region = (x: number, y: number, seed = DEFAULT_SEED) => !villageTile(x, y) ? biomeNames[biomeAt(seed, x, y)] : x > 21 ? y > 18 ? "Moonfall ruins" : "River crossing" : y < 12 ? "Jade forest" : "Lantern village";
const safe = (s: GameState, x: number, y: number) => distance({ x, y }, camp) <= 3 || npcs.some(n => distance({ x, y }, n) <= 1) || !!nearbyCamp(s, x, y);
const protectedTile = (x: number, y: number) => distance({ x, y }, camp) <= 1 || shrines.some(p => p.x === x && p.y === y) || npcs.some(n => n.x === x && n.y === y);
export const bossAwake = (s: GameState, e: Ninja) => e.kind !== "warden" || s.scrolls.length === 3;
const maxEnemyHp = (kind: EnemyKind) => kind === "warden" ? 18 : kind === "guard" ? 6 : 3;
export const recipes = [
  { id: "medicine", name: "Field medicine", cost: { herb: 2, wood: 1 }, amount: 1, note: "Restore 3 life with H." },
  { id: "bridge", name: "River bridges", cost: { wood: 2, stone: 1 }, amount: 2, note: "Build across water." },
  { id: "fence", name: "Timber fences", cost: { wood: 1 }, amount: 2, note: "Shape your village." },
  { id: "lantern", name: "Stone lantern", cost: { stone: 2, ore: 1 }, amount: 1, note: "Light up a new camp." },
  { id: "kunai", name: "Tempered kunai", cost: { ore: 3, stone: 3 }, amount: 1, note: "Permanent +1 kunai damage." },
  { id: "armor", name: "Shinobi armor", cost: { wood: 4, stone: 4 }, amount: 1, note: "Permanent +2 maximum life." },
  { id: "campfire", name: "Trail campfire", cost: { wood: 3, stone: 2 }, amount: 1, note: "Place, then F to rest and set your respawn." },
  { id: "garden", name: "Herb seeds", cost: { herb: 1, wood: 1 }, amount: 3, note: "Plant with Q. Grow for 45 active seconds; harvest with F." },
  { id: "trail", name: "Trail pavers", cost: { stone: 1, wood: 1 }, amount: 4, note: "Lay readable paths across open ground." },
  { id: "brick", name: "Kiln bricks", cost: { stone: 3, ore: 1 }, amount: 2, note: "Build sturdy outlined walls." },
] as const;
export type RecipeId = typeof recipes[number]["id"];
const stock = (s: GameState, resource: string) => resource === "wood" ? s.wood : resource === "stone" ? s.stone : s.inventory[resource as keyof Inventory];
function spend(s: GameState, resource: string, count: number) {
  if (resource === "wood") s.wood -= count;
  else if (resource === "stone") s.stone -= count;
  else s.inventory[resource as keyof Inventory] -= count;
}
function add(s: GameState, resource: string, count: number) {
  if (resource === "wood") s.wood = Math.min(999, s.wood + count);
  else if (resource === "stone") s.stone = Math.min(999, s.stone + count);
  else s.inventory[resource as keyof Inventory] = Math.min(999, stock(s, resource) + count);
}
export function createGame(seed = DEFAULT_SEED): GameState {
  const tiles: number[] = Array.from({ length: WORLD_W * WORLD_H }, (_, i) => {
    const x = i % WORLD_W, y = Math.floor(i / WORLD_W);
    if (!inside(x, y)) return 1;
    if (x >= 17 && x <= 20 && y > 3 && y < 28) return y === 15 || y === 16 ? 7 : 2;
    if (y === 15 || y === 16 || x === 10 || x === 29) return 1;
    if (x > 22 && y > 18) {
      if ((x === 24 || x === 36) && y > 19 && y < 28 && y !== 24) return 11;
      if (y === 20 && x > 26 && x < 35) return 11;
      return (x * 11 + y * 3) % 19 === 0 ? 4 : 9;
    }
    if ((x * 17 + y * 31) % (y < 12 && x < 17 ? 11 : 29) === 0) return 3;
    if ((x * 13 + y * 7) % 41 === 0) return 4;
    if ((x * 7 + y * 13) % 17 === 0) return 8;
    return 0;
  });
  for (const h of houses) for (let y = h.y; y < h.y + h.h; y++) for (let x = h.x; x < h.x + h.w; x++) tiles[y * WORLD_W + x] = 10;
  for (let y = 24; y < 27; y++) for (let x = 4; x < 8; x++) tiles[y * WORLD_W + x] = 12;
  // Guaranteed paths make every quest and shrine reachable without mining.
  for (const p of [camp, ...shrines, ...npcs]) {
    for (let x = Math.min(p.x, 10); x <= Math.max(p.x, 10); x++) tiles[p.y * WORLD_W + x] = x >= 17 && x <= 20 ? 7 : 1;
    for (let y = Math.min(p.y, 16); y <= Math.max(p.y, 16); y++) tiles[y * WORLD_W + 10] = 1;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) tiles[(p.y + dy) * WORLD_W + p.x + dx] = 1;
  }
  tiles[18 * WORLD_W + 14] = 15;
  const enemies: Ninja[] = [
    { x: 13, y: 8, hp: 3, kind: "rogue" }, { x: 25, y: 12, hp: 3, kind: "archer" },
    { x: 33, y: 21, hp: 6, kind: "guard" }, { x: 7, y: 28, hp: 3, kind: "rogue" },
    { x: 4, y: 5, hp: 3, kind: "archer" }, { x: 26, y: 6, hp: 6, kind: "guard" },
    { x: 34, y: 15, hp: 3, kind: "archer" }, { x: 34, y: 26, hp: 18, kind: "warden" },
  ];
  for (const e of enemies) tiles[e.y * WORLD_W + e.x] = e.x > 22 && e.y > 18 ? 9 : 0;
  return { version: 3, savedAt: 0, world: { seed: seed >>> 0, changes: {}, explored: { "0,0": true, "1,0": true, "0,1": true, "1,1": true }, foes: {} }, roamers: [], spawn: { ...camp }, crops: {}, elapsed: 0, hurtUntil: 0, totals: { built: 0, harvested: 0, defeated: 0 }, tiles, x: camp.x, y: camp.y, facing: [0, 1], hp: 6, chakra: 100, wood: 8, stone: 4, scrolls: [], enemies, inventory: { herb: 0, ore: 0, medicine: 1, bridge: 0, fence: 0, lantern: 0, garden: 2, campfire: 1, trail: 0, brick: 0 }, quests: [], missions: [], upgrades: [], projectiles: [] };
}
export function readSave(value: string | null, strict = false): GameState {
  try {
    const s = JSON.parse(value || "null");
    const integer = (v: unknown, min: number, max: number) => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
    const points = (v: { x: number; y: number }) => v && (s?.version === 3 ? coordinate(v.x) && coordinate(v.y) : integer(v.x, 1, WORLD_W - 2) && integer(v.y, 1, WORLD_H - 2));
    const unique = (v: unknown, allowed: readonly unknown[]) => Array.isArray(v) && v.length <= allowed.length && new Set(v).size === v.length && v.every(i => allowed.includes(i));
    if (!s || ![1, 2, 3].includes(s.version) || !Array.isArray(s.tiles) || s.tiles.length !== WORLD_W * WORLD_H || !s.tiles.every((t: unknown) => integer(t, 0, s.version === 1 ? 6 : s.version === 2 ? 15 : 24))) throw new Error();
    if (!points(s) || solid(tileAt(s, s.x, s.y)) || !Array.isArray(s.facing) || s.facing.length !== 2 || !s.facing.every((v: unknown) => integer(v, -1, 1)) || Math.abs(s.facing[0]) + Math.abs(s.facing[1]) !== 1) throw new Error();
    if (!Number.isFinite(s.chakra) || s.chakra < 0 || s.chakra > 100 || !integer(s.wood, 0, 999) || !integer(s.stone, 0, 999) || !unique(s.scrolls, [0, 1, 2])) throw new Error();
    const base = createGame();
    if (s.version === 3) {
      if (s.savedAt !== undefined && !integer(s.savedAt, 0, Number.MAX_SAFE_INTEGER - 1)) throw new Error();
      const record = (v: unknown, check: (key: string, value: unknown) => boolean) => !!v && typeof v === "object" && !Array.isArray(v) && Object.entries(v).every(([k, value]) => check(k, value));
      const keyPoint = (key: string) => { const [x, y] = key.split(",").map(Number); return /^-?\d+,-?\d+$/.test(key) && coordinate(x) && coordinate(y) && pointKey(x, y) === key; };
      const foe = (id: string) => {
        const match = /^(-?\d+),(-?\d+):([01])$/.exec(id); if (!match || !keyPoint(`${match[1]},${match[2]}`)) return undefined;
        const cx = Number(match[1]), cy = Number(match[2]); if (!coordinate(cx * CHUNK_SIZE + 12) || !coordinate(cy * CHUNK_SIZE + 12)) return undefined;
        return worldChunk(s.world.seed, cx, cy).enemies.find(e => e.id === id);
      };
      if (!s.world || !integer(s.world.seed, 0, 4294967295) || !record(s.world.changes, (k, v) => keyPoint(k) && !villageTile(...k.split(",").map(Number) as [number, number]) && integer(v, 0, 24)) || !record(s.world.explored, (k, v) => keyPoint(k) && v === true)) throw new Error();
      if (!Number.isFinite(s.elapsed) || s.elapsed < 0 || s.elapsed > Number.MAX_SAFE_INTEGER || !Number.isFinite(s.hurtUntil) || s.hurtUntil < 0 || s.hurtUntil > s.elapsed + 2 || !points(s.spawn) || (distance(s.spawn, camp) !== 0 && tileAt(s, s.spawn.x, s.spawn.y) !== 16)) throw new Error();
      if (!record(s.crops, (k, ready) => keyPoint(k) && typeof ready === "number" && Number.isFinite(ready) && ready >= 0 && ready <= s.elapsed + 45 && (villageTile(...k.split(",").map(Number) as [number, number]) ? s.tiles[Number(k.split(",")[1]) * WORLD_W + Number(k.split(",")[0])] : s.world.changes[k]) === 22)) throw new Error();
      if (!s.tiles.every((tile: number, i: number) => tile !== 22 || Object.hasOwn(s.crops, pointKey(i % WORLD_W, Math.floor(i / WORLD_W)))) || !Object.entries(s.world.changes).every(([key, tile]) => tile !== 22 || Object.hasOwn(s.crops, key))) throw new Error();
      if (!s.totals || !["built", "harvested", "defeated"].every(k => integer(s.totals[k], 0, Number.MAX_SAFE_INTEGER))) throw new Error();
      if (!record(s.world.foes, (id, value) => { const original = foe(id), e = value as Ninja; return !!original && points(e) && integer(e.hp, 0, original.hp) && (!e.hp || !solid(tileAt(s, e.x, e.y))); })) throw new Error();
      if (!Array.isArray(s.roamers) || s.roamers.length > 18 || new Set(s.roamers.map((e: WildEnemy) => e?.id)).size !== s.roamers.length || !s.roamers.every((e: WildEnemy) => { const original = e && foe(e.id); return original && e.kind === original.kind && points(e) && integer(e.hp, 0, original.hp) && (!e.hp || !solid(tileAt(s, e.x, e.y))) && (!s.world.foes[e.id] || s.world.foes[e.id].hp === e.hp); })) throw new Error();
    }
    if (s.version === 1) {
      if (!integer(s.hp, 1, 6) || !Array.isArray(s.enemies) || s.enemies.length !== 4 || !s.enemies.every((e: Ninja) => points(e) && integer(e.hp, 0, 3) && (!e.hp || !solid(tileAt(s, e.x, e.y))))) throw new Error();
      // Keep every old tile, placed block, resource and recovered scroll. Add only
      // non-solid flowers and new opponents on clear ground; never overwrite builds.
      const tiles = [...s.tiles];
      base.tiles.forEach((tile, i) => { if (tile === 8 && tiles[i] === 0) tiles[i] = 8; });
      const migrated: GameState = { ...base, tiles, x: s.x, y: s.y, facing: s.facing, hp: s.hp, chakra: s.chakra, wood: s.wood, stone: s.stone, scrolls: s.scrolls, enemies: s.enemies.map((e: Ninja) => ({ x: e.x, y: e.y, hp: e.hp, kind: "rogue" as const })) };
      for (const e of base.enemies.slice(4)) {
        const candidates = Array.from({ length: WORLD_W * WORLD_H }, (_, i) => ({ x: i % WORLD_W, y: Math.floor(i / WORLD_W) })).filter(p => inside(p.x, p.y) && !solid(tileAt(migrated, p.x, p.y)) && !protectedTile(p.x, p.y) && distance(p, migrated) > 2 && !migrated.enemies.some(n => n.hp && distance(p, n) === 0)).sort((a, b) => distance(a, e) - distance(b, e));
        if (candidates[0]) migrated.enemies.push({ ...e, ...candidates[0] });
      }
      return migrated;
    }
    const requiredInventory = Object.keys(base.inventory).filter(k => !["trail", "brick"].includes(k) && (s.version === 3 || !["garden", "campfire"].includes(k)));
    if (!s.inventory || !requiredInventory.every(k => integer(s.inventory[k], 0, 999)) || !["trail", "brick"].every(k => s.inventory[k] === undefined || integer(s.inventory[k], 0, 999)) || !unique(s.quests, ["supplies", "herbalist", "warden"]) || (s.missions !== undefined && !unique(s.missions, missions)) || !unique(s.upgrades, ["kunai", "armor"]) || !integer(s.hp, 1, s.upgrades.includes("armor") ? 8 : 6)) throw new Error();
    if (!Array.isArray(s.enemies) || s.enemies.length < 4 || s.enemies.length > 8 || !s.enemies.every((e: Ninja) => points(e) && ["rogue", "archer", "guard", "warden"].includes(e.kind) && integer(e.hp, 0, maxEnemyHp(e.kind)) && (!e.hp || !solid(tileAt(s, e.x, e.y))))) throw new Error();
    if (s.enemies.filter((e: Ninja) => e.kind === "warden").length > 1 || !Array.isArray(s.projectiles) || s.projectiles.length > 64 || !s.projectiles.every((p: Projectile) => points(p) && integer(p.dx, -1, 1) && integer(p.dy, -1, 1) && Math.abs(p.dx) + Math.abs(p.dy) >= 1 && integer(p.left, 1, 10) && integer(p.damage, 1, 4) && typeof p.hostile === "boolean" && ["kunai", "fire", "wind", "lightning"].includes(p.kind))) throw new Error();
    const frontier = s.version === 3 ? { savedAt: s.savedAt ?? 0, world: { seed: s.world.seed, changes: { ...s.world.changes }, explored: { ...s.world.explored }, foes: Object.fromEntries(Object.entries(s.world.foes).map(([id, value]) => { const e = value as Ninja; return [id, { x: e.x, y: e.y, hp: e.hp }]; })) }, roamers: s.roamers.map((e: WildEnemy) => ({ id: e.id, x: e.x, y: e.y, hp: e.hp, kind: e.kind })), spawn: { x: s.spawn.x, y: s.spawn.y }, crops: { ...s.crops }, elapsed: s.elapsed, hurtUntil: s.hurtUntil, totals: { built: s.totals.built, harvested: s.totals.harvested, defeated: s.totals.defeated }, missions: s.missions ? [...s.missions] : [] } : {};
    return { ...base, ...frontier, version: 3, tiles: s.tiles, x: s.x, y: s.y, facing: s.facing, hp: s.hp, chakra: s.chakra, wood: s.wood, stone: s.stone, scrolls: s.scrolls, enemies: s.enemies.map((e: Ninja) => ({ x: e.x, y: e.y, hp: e.hp, kind: e.kind })), inventory: Object.fromEntries(Object.keys(base.inventory).map(k => [k, s.inventory[k] ?? base.inventory[k as keyof Inventory]])) as Inventory, quests: s.quests, upgrades: s.upgrades, projectiles: s.projectiles.map((p: Projectile) => ({ x: p.x, y: p.y, dx: p.dx, dy: p.dy, left: p.left, damage: p.damage, hostile: p.hostile, kind: p.kind })) };
  } catch { if (strict) throw new Error("Invalid world save. Your current world was not changed."); return createGame(); }
}
export function canStand(s: GameState, x: number, y: number) {
  return coordinate(x) && coordinate(y) && !solid(tileAt(s, x, y)) && !npcs.some(n => n.x === x && n.y === y) && !allEnemies(s).some(e => e.hp > 0 && e.x === x && e.y === y);
}
export function movePlayer(s: GameState, dx: number, dy: number) {
  if (!Number.isInteger(dx) || !Number.isInteger(dy) || Math.abs(dx) + Math.abs(dy) !== 1) return false;
  s.facing = [dx, dy]; const x = s.x + dx, y = s.y + dy;
  if (!canStand(s, x, y)) return false;
  s.x = x; s.y = y; streamWorld(s); return true;
}
export function jump(s: GameState) {
  const [dx, dy] = s.facing, middle = { x: s.x + dx, y: s.y + dy }, landing = { x: s.x + dx * 2, y: s.y + dy * 2 };
  if (!canStand(s, middle.x, middle.y) || !canStand(s, landing.x, landing.y)) return "Jump blocked. Trees, stone, buildings and enemies cannot be cleared.";
  s.x = landing.x; s.y = landing.y; streamWorld(s); return "Jumped two tiles.";
}
export function collectScroll(s: GameState) {
  const i = shrines.findIndex(p => distance(p, s) <= 1);
  if (i < 0 || s.scrolls.includes(i)) return "Find the three scroll shrines. Check your journal map.";
  s.scrolls.push(i); s.hp = maxHp(s); s.chakra = 100;
  return s.scrolls.length === 3 ? "Mangekyo awakened! The Moonfall Warden stirs. G freezes enemies; L dashes." : `Scroll ${s.scrolls.length}/3 recovered. ${s.scrolls.length === 1 ? "Wind" : "Lightning"} style unlocked. Life and chakra restored.`;
}
export function talk(s: GameState) {
  const n = npcs.find(n => distance(n, s) <= 1);
  if (!n) return "";
  if (n.id === "builder") return "Ren: Open Inventory / recipes with E or I. Gather ore from grey rocks and ruin walls. Bridges cross water; medicine restores life. Temper your kunai before the Warden.";
  if (n.id === "herbalist") {
    if (s.quests.includes("herbalist")) return "Aoi: The grove is healthy again. Your dash now costs only 6 chakra. Flowers and village gardens provide herbs.";
    if (s.inventory.herb < 3) return `Aoi: Bring me 3 herbs from the flowers or gardens (${s.inventory.herb}/3). I’ll teach you an efficient dash. The first scroll is northwest, at 7,7.`;
    s.inventory.herb -= 3; s.quests.push("herbalist"); add(s, "medicine", 2);
    return "Aoi: Thank you! Ranger quest complete. +2 medicine. Your dash costs 6 chakra instead of 12.";
  }
  const warden = s.enemies.find(e => e.kind === "warden");
  if (warden && !warden.hp && !s.quests.includes("warden")) {
    s.quests.push("warden"); add(s, "lantern", 3); s.hp = maxHp(s); s.chakra = 100;
    return "Kiyo: You lifted the seal! +3 lanterns. The village is safe. Keep exploring and building; this dream is yours.";
  }
  if (s.quests.includes("supplies")) return s.quests.includes("warden") ? "Kiyo: Our lanterns burn bright again. You’re always welcome here." : "Kiyo: Recover the three scrolls, then defeat the Warden in the southeast ruins. Return here for your reward. Camp restores your life.";
  if (s.wood < 3 || s.stone < 2) return `Kiyo: The village needs 3 wood and 2 stone (${s.wood}/3 wood, ${s.stone}/2 stone). Gather with F. I’ll trade you ore and medicine.`;
  s.wood -= 3; s.stone -= 2; s.quests.push("supplies"); add(s, "ore", 2); add(s, "medicine", 1);
  return "Kiyo: Village quest complete! +2 ore, +1 medicine. Visit Aoi in the Jade forest and Ren by the workbench.";
}
export function mine(s: GameState) {
  const underfoot = tileAt(s, s.x, s.y);
  if (underfoot === 22) return `Growing herbs: ${Math.max(0, Math.ceil(s.crops[pointKey(s.x, s.y)] - s.elapsed))} active seconds left.`;
  if (underfoot === 23) { add(s, "trail", 1); setTile(s, s.x, s.y, villageTile(s.x, s.y) ? 0 : groundTile(s.world.seed, s.x, s.y)); s.totals.harvested++; return "trail recovered."; }
  if ([8, 12, 17].includes(underfoot)) {
    add(s, "herb", underfoot === 8 ? 1 : 2); if (underfoot === 17) add(s, "garden", 1);
    setTile(s, s.x, s.y, underfoot === 17 ? 21 : villageTile(s.x, s.y) ? 0 : groundTile(s.world.seed, s.x, s.y)); s.totals.harvested++;
    return underfoot === 17 ? "+2 herbs, +1 seed. Plant again to keep your garden growing." : underfoot === 12 ? "+2 herbs" : "+1 herb";
  }
  const x = s.x + s.facing[0], y = s.y + s.facing[1], tile = tileAt(s, x, y);
  if (!coordinate(x) || !coordinate(y)) return "Choose a neighboring tile.";
  if (tile === 18) return lootCache(s, x, y);
  if (tile === 22) return `Growing herbs: ${Math.max(0, Math.ceil(s.crops[pointKey(x, y)] - s.elapsed))} active seconds left.`;
  if (tile === 7 && allEnemies(s).some(e => e.hp && e.x === x && e.y === y)) return "Move the enemy off the bridge first.";
  if ((protectedTile(x, y) && ![5, 6, 13, 14].includes(tile)) || tile === 10 || tile === 15) return "Leave the village, camp and shrines intact.";
  let message = "";
  if (tile === 3 || tile === 5) { add(s, "wood", 1); message = "+1 wood"; }
  else if (tile === 20) { add(s, "stone", 1); add(s, "ore", 2); message = "+1 stone, +2 ore"; }
  else if (tile === 4 || tile === 6 || tile === 11) { add(s, "stone", 1); if (tile !== 6 && (tile === 11 || (x + y) % 2 === 0)) { add(s, "ore", 1); message = "+1 stone, +1 ore"; } else message = "+1 stone"; }
  else if ([8, 12, 17].includes(tile)) { add(s, "herb", tile === 8 ? 1 : 2); if (tile === 17) add(s, "garden", 1); message = tile === 8 ? "+1 herb" : tile === 17 ? "+2 herbs, +1 seed" : "+2 herbs"; }
  else if ([7, 13, 14, 16, 23, 24].includes(tile)) { const item = tile === 7 ? "bridge" : tile === 13 ? "fence" : tile === 16 ? "campfire" : tile === 23 ? "trail" : tile === 24 ? "brick" : "lantern"; add(s, item, 1); message = `${item} recovered.`; }
  else return "F gathers nearby trees, rocks and herbs. Q builds; E opens inventory and maps.";
  setTile(s, x, y, tile === 17 ? 21 : tile === 7 ? 2 : villageTile(x, y) ? 0 : groundTile(s.world.seed, x, y)); s.totals.harvested++;
  return message;
}
function lootCache(s: GameState, x: number, y: number) {
  if (allEnemies(s).some(e => e.hp && distance(e, { x, y }) < 7)) return "Clear the nearby guards before opening these supplies.";
  setTile(s, x, y, groundTile(s.world.seed, x, y));
  add(s, "ore", 2); add(s, "medicine", 1); add(s, "garden", 3); add(s, "wood", 4);
  return "Ruins explored! +2 ore, +1 medicine, +3 seeds, +4 wood. New ruins await beyond the trail.";
}
export function interact(s: GameState) {
  const dialogue = talk(s); if (dialogue) return dialogue;
  if ([8, 12, 17, 22].includes(tileAt(s, s.x, s.y)) || [17, 22].includes(tileAt(s, s.x + s.facing[0], s.y + s.facing[1]))) return mine(s);
  const rest = nearbyCamp(s);
  if (rest) { s.hp = maxHp(s); s.chakra = 100; s.spawn = rest; return distance(rest, camp) === 0 ? "Rested at camp. Life and chakra restored. Talk to Kiyo, just southwest." : `Trail camp at ${rest.x},${rest.y}. Life restored; your new respawn is set. R recalls you here.`; }
  if (shrines.some((p, i) => distance(p, s) <= 1 && !s.scrolls.includes(i))) return collectScroll(s);
  return mine(s);
}
export function recall(s: GameState, village = false) {
  const target = village ? camp : s.spawn;
  if (distance(s, target) <= 1) return "You are already at this camp. F rests here.";
  if (allEnemies(s).some(e => e.hp && bossAwake(s, e) && distance(e, s) < 6)) return "Find safe ground before recalling: enemies are too close.";
  if (s.chakra < 25) return "Recall needs 25 chakra.";
  s.chakra -= 25; s.x = target.x; s.y = target.y; s.projectiles = []; streamWorld(s);
  return `Recalled to ${village ? "Lantern village" : "your camp"}. Buildings, crops and discoveries stay where you left them.`;
}
export function build(s: GameState, material: Material) {
  const x = s.x + s.facing[0], y = s.y + s.facing[1], tile = tileAt(s, x, y);
  if ([7, 12, 16, 17, 22, 23, 24].includes(tile)) return "Recover or harvest this tile with X before replacing it.";
  if (!materials.includes(material) || !coordinate(x) || !coordinate(y) || protectedTile(x, y) || (solid(tile) && !(material === "bridge" && tile === 2)) || allEnemies(s).some(e => e.hp > 0 && e.x === x && e.y === y)) return "That tile is occupied.";
  if (material === "bridge" && tile !== 2) return "Place bridges over water.";
  if (material !== "bridge" && tile === 2) return "Only bridges can cross water.";
  if (!stock(s, material)) return material === "wood" || material === "stone" ? `Mine more ${material} first.` : material === "garden" ? "Craft herb seeds in Inventory first." : `Craft ${material} in Inventory first.`;
  spend(s, material, 1); setTile(s, x, y, { wood: 5, stone: 6, bridge: 7, fence: 13, lantern: 14, campfire: 16, garden: 22, trail: 23, brick: 24 }[material]);
  s.totals.built++;
  if (material === "garden") { s.crops[pointKey(x, y)] = s.elapsed + 45; return "Herb seeds planted. Grow for 45 active seconds; harvest with F for herbs and a seed."; }
  return material === "campfire" ? "Campfire placed. F rests here and sets your respawn." : `${material[0].toUpperCase() + material.slice(1)} block placed.`;
}
export function craft(s: GameState, id: RecipeId) {
  const recipe = recipes.find(r => r.id === id); if (!recipe) return "Unknown recipe.";
  if ((id === "armor" || id === "kunai") && s.upgrades.includes(id)) return "You already have this upgrade.";
  if (Object.entries(recipe.cost).some(([key, count]) => stock(s, key) < count)) return "Gather the ingredients shown in this recipe first.";
  if (id !== "armor" && id !== "kunai" && stock(s, id) + recipe.amount > 999) return "Your inventory is full.";
  Object.entries(recipe.cost).forEach(([key, count]) => spend(s, key, count));
  if (id === "armor" || id === "kunai") { s.upgrades.push(id); if (id === "armor") s.hp = maxHp(s); }
  else add(s, id, recipe.amount);
  return `${recipe.name} crafted${recipe.amount > 1 ? ` ×${recipe.amount}` : ""}.`;
}
export function heal(s: GameState) {
  if (s.hp >= maxHp(s)) return "Your life is already full.";
  if (!s.inventory.medicine) return "Craft field medicine with 2 herbs and 1 wood, or rest at camp.";
  s.inventory.medicine--; s.hp = Math.min(maxHp(s), s.hp + 3); return "Field medicine: +3 life.";
}
export function dash(s: GameState) {
  const cost = s.quests.includes("herbalist") ? 6 : 12;
  if (s.chakra < cost) return `Dash needs ${cost} chakra.`;
  let steps = 0; for (let i = 0; i < 3; i++) { if (!movePlayer(s, ...s.facing)) break; steps++; }
  if (!steps) return "The way is blocked.";
  s.chakra -= cost; return "Body flicker!";
}
export function cast(s: GameState, kind: Jutsu) {
  const required = kind === "wind" ? 1 : kind === "lightning" ? 2 : 0;
  if (s.scrolls.length < required) return `Recover ${required} scroll${required > 1 ? "s" : ""} to learn ${kind} style.`;
  const cost = { kunai: 0, fire: 20, wind: 25, lightning: 35 }[kind];
  if (s.chakra < cost) return `Not enough chakra. ${kind} needs ${cost}.`;
  if (s.projectiles.length >= 60) return "Let your previous jutsu settle.";
  s.chakra -= cost;
  const [dx, dy] = s.facing, damage = kind === "kunai" ? s.upgrades.includes("kunai") ? 3 : 2 : kind === "lightning" ? 4 : 3;
  s.projectiles.push({ x: s.x, y: s.y, dx, dy, left: kind === "kunai" ? 4 : 8, damage, hostile: false, kind });
  return kind === "kunai" ? "Kunai thrown." : `${kind[0].toUpperCase() + kind.slice(1)} style!`;
}
export const attack = (s: GameState, jutsu = false) => cast(s, jutsu ? "fire" : "kunai");
function hurtPlayer(s: GameState, damage: number) {
  if (safe(s, s.x, s.y) || s.elapsed < s.hurtUntil) return "";
  s.hurtUntil = s.elapsed + .65; s.hp -= damage;
  if (s.hp > 0) return "Hit! Dash, heal, or retreat to camp.";
  s.hp = maxHp(s); s.chakra = 100; s.x = s.spawn.x; s.y = s.spawn.y; s.projectiles = [];
  return "Back at camp. Your blocks, inventory, crops and scrolls are safe.";
}
export function stepProjectiles(s: GameState, frozen = false) {
  let message = "", respawned = false;
  s.projectiles = s.projectiles.filter(p => {
    if (frozen && p.hostile) return true;
    p.x += p.dx; p.y += p.dy; p.left--;
    if (!coordinate(p.x) || !coordinate(p.y) || solid(tileAt(s, p.x, p.y))) return false;
    if (p.hostile) {
      if (safe(s, p.x, p.y) || npcs.some(n => n.x === p.x && n.y === p.y)) return false;
      if (p.x === s.x && p.y === s.y) { message = hurtPlayer(s, p.damage); respawned ||= s.x === s.spawn.x && s.y === s.spawn.y; return false; }
    } else {
      const e = allEnemies(s).find(e => e.hp > 0 && bossAwake(s, e) && e.x === p.x && e.y === p.y);
      if (e) {
        e.hp = Math.max(0, e.hp - p.damage);
        if (e.id) s.world.foes[e.id] = { x: e.x, y: e.y, hp: e.hp };
        if (!e.hp) { s.totals.defeated++; add(s, "herb", e.kind === "warden" ? 3 : 1); add(s, "ore", e.kind === "rogue" ? 0 : 1); message = e.kind === "warden" ? "The Warden falls! Return to Kiyo in the village for your reward." : `${e.kind} defeated. Supplies recovered.`; }
        else message = `${e.kind === "warden" ? "Warden" : "Rogue ninja"} hit!`;
        return p.kind === "wind" && p.left > 0;
      }
    }
    return p.left > 0;
  });
  if (respawned) s.projectiles = [];
  return message;
}
function clearShot(s: GameState, e: Ninja) {
  if (s.x !== e.x && s.y !== e.y) return false;
  const dx = Math.sign(s.x - e.x), dy = Math.sign(s.y - e.y);
  for (let d = 1; d < distance(s, e); d++) if (solid(tileAt(s, e.x + dx * d, e.y + dy * d))) return false;
  return true;
}
export function stepEnemies(s: GameState, tick: number) {
  let hurt = false;
  const enemies = allEnemies(s);
  for (const [i, e] of enemies.entries()) {
    if (!e.hp || !bossAwake(s, e)) continue;
    const d = distance(e, s); if (d > 12) continue;
    if (d === 1) { hurt = true; continue; }
    if (!safe(s, s.x, s.y) && d < 9 && (e.kind === "archer" || e.kind === "warden") && tick % 2 === 0 && clearShot(s, e) && s.projectiles.length < 60) {
      s.projectiles.push({ x: e.x, y: e.y, dx: Math.sign(s.x - e.x), dy: Math.sign(s.y - e.y), left: 9, damage: e.kind === "warden" ? 2 : 1, hostile: true, kind: e.kind === "warden" ? "fire" : "kunai" });
      continue;
    }
    if (e.kind === "warden" && d < 10 && tick % 4 === 0 && s.projectiles.length < 56) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) s.projectiles.push({ x: e.x, y: e.y, dx, dy, left: 7, damage: 2, hostile: true, kind: "fire" });
    }
    if (e.kind === "guard" && tick % 2) continue;
    const toward = Math.abs(s.x - e.x) >= Math.abs(s.y - e.y) ? [Math.sign(s.x - e.x), 0] : [0, Math.sign(s.y - e.y)];
    const [dx, dy] = d < 8 && !safe(s, s.x, s.y) ? toward : [[1, 0], [0, 1], [-1, 0], [0, -1]][(tick + i) % 4];
    const x = e.x + dx, y = e.y + dy;
    if (coordinate(x) && coordinate(y) && !safe(s, x, y) && !solid(tileAt(s, x, y)) && !(s.x === x && s.y === y) && !shrines.some(p => p.x === x && p.y === y) && !enemies.some(other => other !== e && other.hp > 0 && other.x === x && other.y === y)) { e.x = x; e.y = y; }
    if (e.id) s.world.foes[e.id] = { x: e.x, y: e.y, hp: e.hp };
  }
  return hurt ? hurtPlayer(s, 1) : "";
}
export function missionReady(s: GameState, id: Mission) {
  if (id === "trailblazer") return Object.keys(s.world.explored).length >= 8;
  if (id === "homesteader") return s.totals.built >= 10;
  return s.totals.harvested >= 20 && s.totals.defeated >= 5;
}
export function claimMission(s: GameState, id: Mission) {
  if (!missions.includes(id)) return "Unknown mission.";
  if (s.missions.includes(id)) return "Mission reward already claimed.";
  if (!missionReady(s, id)) return "Keep exploring the frontier to finish this mission.";
  const reward: Partial<Inventory> = id === "trailblazer" ? { trail: 6 } : id === "homesteader" ? { brick: 4 } : { medicine: 3, ore: 3 };
  if (Object.entries(reward).some(([item, count]) => s.inventory[item as keyof Inventory] + count > 999)) return "Make room in your inventory before claiming this reward.";
  s.missions.push(id);
  for (const [item, count] of Object.entries(reward)) add(s, item, count);
  return id === "trailblazer" ? "Trailblazer claimed: +6 trail pavers." : id === "homesteader" ? "Homesteader claimed: +4 kiln bricks." : "Vanguard claimed: +3 medicine, +3 ore.";
}
export function objectives(s: GameState) {
  const warden = s.enemies.find(e => e.kind === "warden");
  const mission = (id: Mission, title: string, detail: string) => ({ id, done: s.missions.includes(id), ready: missionReady(s, id), title, detail });
  return [
    { done: s.quests.includes("supplies"), title: "Light the village", detail: "Kiyo · 8,17 · Bring 3 wood and 2 stone. Reward: 2 ore + medicine." },
    { done: s.quests.includes("herbalist"), title: "Help the grove", detail: "Aoi · 7,10 · Bring 3 herbs. Reward: 2 medicine + cheaper dash." },
    { done: s.scrolls.length === 3, title: `Recover the seals · ${s.scrolls.length}/3`, detail: "Shrines: 7,7 · 32,8 · 30,25. Unlock Wind, Lightning and Mangekyo." },
    { done: !!warden && !warden.hp, title: "Challenge the Moonfall Warden", detail: "Southeast ruins · 34,26. Recover all scrolls to wake it. Heal, dash and freeze time." },
    { done: s.quests.includes("warden"), title: "Bring the light home", detail: "Return to Kiyo after the Warden falls. Reward: 3 lanterns. Keep building afterward." },
    mission("trailblazer", `Trailblazer · ${Math.min(8, Object.keys(s.world.explored).length)}/8 chunks`, "Explore 8 chunks. Claim 6 trail pavers."),
    mission("homesteader", `Homesteader · ${Math.min(10, s.totals.built)}/10 builds`, "Place 10 blocks. Claim 4 kiln bricks."),
    mission("vanguard", `Frontier vanguard · ${Math.min(20, s.totals.harvested)}/20 harvests · ${Math.min(5, s.totals.defeated)}/5 foes`, "Harvest 20 resources and defeat 5 enemies. Claim 3 medicine + 3 ore."),
  ];
}
