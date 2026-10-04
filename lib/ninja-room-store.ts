import { createClient } from "redis";
import { createHash, randomBytes } from "node:crypto";
import { OnlineError, readRoom, type Room } from "./ninja-online.ts";

export const roomKey = (code: string) => `psy:world:v1:${code}`;
export const channel = (code: string) => `psy:world-updates:${code}`;
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const newToken = () => randomBytes(24).toString("hex");
export const newCode = () => randomBytes(12).toString("hex");
let connection: ReturnType<typeof createClient> | undefined, connecting: Promise<unknown> | undefined;
export async function redis() {
  if (!process.env.REDIS_URL) throw new OnlineError("Online play is not configured. Connect Redis in Vercel Marketplace and set REDIS_URL.");
  if (!connection) {
    connection = createClient({ url: process.env.REDIS_URL, socket: { connectTimeout: 5000, reconnectStrategy: retries => retries < 3 ? 100 * (retries + 1) : false } });
    connection.on("error", () => { /* Request handlers expose a safe unavailable state. */ });
  }
  if (!connection.isOpen) connecting = connection.connect();
  await connecting;
  return connection;
}
export async function loadRoom(code: string) { const raw = await (await redis()).get(roomKey(code)); if (!raw) throw new OnlineError("World not found. Check your invite."); return readRoom(raw); }
// A Lua compare-and-swap serializes joins, inventory spending and builds across all Vercel instances.
export const CAS_ROOM = `local old=redis.call('GET',KEYS[1]); if not old then return -1 end; local state=cjson.decode(old); if state.revision~=tonumber(ARGV[1]) then return 0 end; redis.call('SET',KEYS[1],ARGV[2]); redis.call('PUBLISH',KEYS[2],ARGV[2]); return 1`;
export async function mutateRoom<T>(code: string, mutate: (room: Room) => T, shouldWrite: (room: Room) => boolean = () => true): Promise<{ room: Room; result: T | undefined }> {
  const store = await redis();
  for (let attempt = 0; attempt < 12; attempt++) {
    const room = await loadRoom(code); if (!shouldWrite(room)) return { room, result: undefined };
    const revision = room.revision, result = mutate(room); room.revision++;
    const raw = JSON.stringify(room); if (Buffer.byteLength(raw) > 2_000_000) throw new OnlineError("World storage limit reached. Export a backup.");
    const saved = await store.eval(CAS_ROOM, { keys: [roomKey(code), channel(code)], arguments: [String(revision), raw] });
    if (saved === 1) return { room, result };
    if (saved === -1) throw new OnlineError("World not found.");
  }
  throw new OnlineError("World is busy. Try that action again.");
}
const COUNT_WITH_EXPIRY = `local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n`;
export async function limitAdmission(ip: string) {
  const store = await redis(), key = `psy:admissions:${hashToken(ip)}:${Math.floor(Date.now() / 60000)}`;
  const n = Number(await store.eval(COUNT_WITH_EXPIRY, { keys: [key], arguments: ["120"] }));
  if (n > 30) throw new OnlineError("Too many connection attempts. Try again in a minute.");
}
export async function limitCreation(ip: string) {
  const store = await redis(), key = `psy:creations:${hashToken(ip)}:${Math.floor(Date.now() / 86400000)}`;
  const n = Number(await store.eval(COUNT_WITH_EXPIRY, { keys: [key], arguments: ["172800"] }));
  if (n > 10) throw new OnlineError("Daily world creation limit reached. Reopen an existing world.");
}
