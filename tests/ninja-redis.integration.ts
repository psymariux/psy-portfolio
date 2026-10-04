import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { createClient } from "redis";
import { WebSocket } from "ws";
import { tileAt, type GameState } from "../lib/ninja-game.ts";
import type { RoomView } from "../lib/ninja-online.ts";

const redisUrl = process.env.TEST_REDIS_URL;
if (!redisUrl || !["127.0.0.1", "localhost"].includes(new URL(redisUrl).hostname)) throw new Error("Set TEST_REDIS_URL to a disposable localhost Redis instance. This test never touches a production store.");
const origin = "http://127.0.0.1:3100";
async function server(): Promise<{ process: ChildProcess; url: string }> {
  const process = spawn(globalThis.process.execPath, ["--experimental-strip-types", "scripts/multiplayer-dev.ts"], { env: { ...globalThis.process.env, REDIS_URL: redisUrl!, GAME_DEV_PORT: "0", GAME_DEV_ORIGIN: origin }, stdio: ["ignore", "pipe", "pipe"] });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { process.kill(); reject(new Error("Game server startup timed out.")); }, 10000);
    process.once("exit", code => { clearTimeout(timer); reject(new Error(`Game server exited ${code}`)); });
    process.stdout!.on("data", data => { const match = /listening on 127.0.0.1:(\d+)/.exec(String(data)); if (match) { clearTimeout(timer); resolve({ process, url: `ws://127.0.0.1:${match[1]}/api/game` }); } });
    process.stderr!.on("data", data => { if (!String(data).includes("ExperimentalWarning") && !String(data).includes("trace-warnings")) console.error(String(data)); });
  });
}
class Player {
  ws: WebSocket; messages: Record<string, unknown>[] = []; view?: RoomView; token = ""; seq = 0;
  constructor(url: string, autoPong = true) {
    this.ws = new WebSocket(url, { origin, autoPong });
    this.ws.on("message", raw => { const data = JSON.parse(raw.toString()); this.messages.push(data); if (data.view) this.view = data.view; if (data.type === "joined") { this.token = data.token; this.seq = data.seq; } });
  }
  async wait(predicate: () => boolean, label: string, timeout = 7000) { const start = Date.now(); while (!predicate()) { if (Date.now() - start > timeout) throw new Error(`Timed out: ${label}. Latest response: ${JSON.stringify(this.messages.at(-1)?.type)}`); await new Promise(r => setTimeout(r, 15)); } }
  async join(message: unknown) { await this.wait(() => this.ws.readyState === WebSocket.OPEN, "socket open"); this.ws.send(JSON.stringify(message)); await this.wait(() => !!this.token || this.messages.some(m => m.type === "error"), "join response"); }
  action(intent: unknown) { this.ws.send(JSON.stringify({ type: "action", seq: ++this.seq, intent })); }
  async close() { if (this.ws.readyState >= WebSocket.CLOSING) return; await new Promise<void>(resolve => { this.ws.once("close", () => resolve()); this.ws.close(); }); }
}
test("two independent socket instances share eight-player rooms, enforce auth and recover persisted builds after restart", { timeout: 75000 }, async () => {
  const servers: Awaited<ReturnType<typeof server>>[] = [], players: Player[] = []; let code = "";
  const store = createClient({ url: redisUrl }); await store.connect();
  try {
    servers.push(...await Promise.all([server(), server()]));
    const host = new Player(servers[0].url); players.push(host); await host.join({ type: "create", name: "Host", mode: "creative" }); assert.ok(host.token); code = host.view!.code;
    const guest = new Player(servers[1].url); players.push(guest); await guest.join({ type: "join", code, name: "Friend" }); assert.ok(guest.token);
    await host.wait(() => host.view?.players.length === 2, "cross-instance presence");
    // Protected camp has clear southern ground. Creative wood does not consume a personal stack.
    host.action({ kind: "move", facing: [0, 1] }); await host.wait(() => host.view?.game.y === 17, "authoritative movement");
    const wood = host.view!.game.wood;
    host.action({ kind: "build", facing: [1, 0], material: "wood" });
    await guest.wait(() => tileAt(guest.view!.game, 11, 17) === 5, "shared build on another instance");
    assert.equal(host.view!.game.wood, wood); assert.equal(guest.view!.game.wood, 8);
    const raw = JSON.parse((await store.get(`psy:world:v1:${code}`))!); assert.ok(raw.players[host.view!.playerId].tokenHash); assert.ok(!JSON.stringify(host.view).includes("tokenHash")); assert.ok(!JSON.stringify(guest.view).includes(host.token));
    host.action({ kind: "move", facing: [999, 0], wood: 999 }); await host.wait(() => host.messages.some(m => m.type === "error" && String(m.message).includes("direction")), "invalid action rejected"); assert.equal(host.view!.game.x, 10);
    for (let i = 2; i < 8; i++) { const p = new Player(servers[i % 2].url); players.push(p); await p.join({ type: "join", code, name: `Friend ${i}` }); assert.ok(p.token); }
    await guest.wait(() => guest.view?.players.length === 8, "eight-player presence");
    const ninth = new Player(servers[1].url); players.push(ninth); await ninth.join({ type: "join", code, name: "Ninth" }); assert.equal(ninth.token, ""); assert.ok(ninth.messages.some(m => String(m.message).includes("full")));
    const stolen = new Player(servers[1].url); players.push(stolen); await stolen.join({ type: "resume", code, token: "0".repeat(48) }); assert.equal(stolen.token, ""); assert.ok(stolen.messages.some(m => String(m.message).includes("session not found")));
    await new Promise(r => setTimeout(r, 240));
    for (const p of players.slice(0, 8)) p.action({ kind: "craft", recipe: "fence" });
    await host.wait(() => players.slice(0, 8).every(p => p.view?.game.inventory.fence === 2), "eight concurrent crafting transactions");
    const concurrent = JSON.parse((await store.get(`psy:world:v1:${code}`))!);
    for (const p of players.slice(0, 8)) assert.equal(concurrent.players[p.view!.playerId].personal.wood, 7);
    const savedToken = host.token;
    const replacement = new Player(servers[1].url); await replacement.join({ type: "resume", code, token: savedToken });
    await host.wait(() => host.ws.readyState === WebSocket.CLOSED, "old socket revoked after same-player reconnect");
    assert.equal(replacement.view!.playerId, host.view!.playerId); assert.equal(replacement.view!.players.length, 8); players[0] = replacement;
    for (const p of players) await p.close();
    await new Promise(r => setTimeout(r, 100));
    for (const s of servers) { s.process.kill(); await new Promise(r => s.process.once("exit", r)); }
    servers.length = 0; servers.push(await server());
    const resumed = new Player(servers[0].url); players.push(resumed); await resumed.join({ type: "resume", code, token: savedToken }); assert.ok(resumed.token); assert.equal(tileAt(resumed.view!.game, 11, 17), 5); assert.equal(resumed.view!.game.y, 17); assert.equal(resumed.view!.game.wood, wood - 1); assert.equal(resumed.view!.game.inventory.fence, 2);
    // Normal leave frees occupancy, while the same player's credentials restore progression.
    assert.equal(resumed.view!.players.length, 1);
    const payload = resumed.view!.game as GameState; assert.equal(payload.version, 3);
    const silent = new Player(servers[0].url, false); players.push(silent); await silent.join({ type: "join", code, name: "NoPong" }); assert.ok(silent.token);
    await silent.wait(() => silent.ws.readyState === WebSocket.CLOSED, "unresponsive transport terminated", 35000);
    await resumed.wait(() => resumed.view?.players.length === 1, "dead transport releases its seat");
  } finally {
    for (const p of players) await p.close(); for (const s of servers) s.process.kill();
    if (code) await store.del([`psy:world:v1:${code}`, `psy:world-clock:${code}`]); await store.quit();
  }
});
