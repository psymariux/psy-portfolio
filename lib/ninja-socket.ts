import type { WebSocket } from "ws";
import { OnlineError, createRoom, joinRoom, roomView, parseIntent, applyIntent, tickRoom, activePlayers, validCode, validName, type Room } from "./ninja-online.ts";
import { redis, roomKey, channel, hashToken, newToken, newCode, mutateRoom, limitAdmission, limitCreation } from "./ninja-room-store.ts";

type Session = { code: string; id: string; hash: string; socketId: string };
const listeners = new Map<string, Set<(room: Room) => void>>();
let subscribing: Promise<void> | undefined;
const instanceId = newToken(), pumps = new Map<string, ReturnType<typeof setInterval>>();
const CLOCK_LEASE = `local owner=redis.call('GET',KEYS[1]); if not owner or owner==ARGV[1] then redis.call('SET',KEYS[1],ARGV[1],'PX',3000); return 1 end; return 0`;
function startClock(code: string) {
  if (pumps.has(code)) return;
  let busy = false, ownsClock = false, checkedAt = 0;
  const pump = setInterval(() => {
    if (busy) return; busy = true;
    void (async () => {
      const now = Date.now();
      if (now - checkedAt >= 900) { checkedAt = now; ownsClock = await (await redis()).eval(CLOCK_LEASE, { keys: [`psy:world-clock:${code}`], arguments: [instanceId] }) === 1; }
      if (ownsClock) await mutateRoom(code, room => tickRoom(room, now), room => now - room.updatedAt >= 100 && activePlayers(room, now).length > 0);
    })().catch(() => { ownsClock = false; checkedAt = 0; }).finally(() => { busy = false; });
  }, 110);
  pumps.set(code, pump);
}
function stopClock(code: string) { const pump = pumps.get(code); if (pump) clearInterval(pump); pumps.delete(code); }
async function subscribe() {
  if (!subscribing) subscribing = (async () => {
    const subscriber = (await redis()).duplicate(); subscriber.on("error", () => {}); subscriber.on("end", () => { subscribing = undefined; }); await subscriber.connect();
    await subscriber.pSubscribe("psy:world-updates:*", (raw, key) => {
      try { const room = JSON.parse(raw) as Room; for (const notify of listeners.get(key) ?? []) notify(room); } catch { /* Invalid messages never reach a client. */ }
    });
  })().catch(error => { subscribing = undefined; throw error; });
  await subscribing;
}
export function attachGameSocket(ws: WebSocket, ip: string): Promise<void> {
  return new Promise(resolve => {
    let pending: Room | undefined, snapshotTimer: ReturnType<typeof setTimeout> | undefined, lastSent = -1;
    let session: Session | undefined, closed = false, alive = true, timer: ReturnType<typeof setInterval> | undefined, processing = Promise.resolve(), queued = 0, requests = 0, windowStart = Date.now();
    const send = (value: unknown) => { if (ws.readyState === 1) { if (ws.bufferedAmount > 1_000_000) ws.close(1013, "Connection too slow"); else ws.send(JSON.stringify(value)); } };
    const error = (message: string) => send({ type: "error", message });
    const authorized = (room: Room) => !!session && room.players[session.id]?.tokenHash === session.hash && room.players[session.id]?.socketId === session.socketId;
    const notify = (room: Room) => {
      if (!session || closed) return;
      if (room.revision <= lastSent || pending && room.revision <= pending.revision) return;
      if (!authorized(room)) { ws.close(4001, "Player session replaced"); return; }
      pending = room;
      if (!snapshotTimer) snapshotTimer = setTimeout(() => {
        snapshotTimer = undefined; const latest = pending; pending = undefined;
        if (!latest || !session || closed) return; lastSent = latest.revision;
        send({ type: "state", view: roomView(latest, session.code, session.id, Date.now()), seq: latest.players[session.id].seq });
      }, 70);
    };
    const enqueue = (task: () => Promise<void>) => {
      if (++queued > 24) { queued--; ws.close(1008, "Too many queued actions"); return; }
      processing = processing.then(async () => { if (!closed) await task(); }).catch(reason => { error(reason instanceof OnlineError ? reason.message : "Online storage unavailable. Reconnecting…"); if (!(reason instanceof OnlineError)) ws.close(1013, "Storage unavailable"); }).finally(() => { queued--; });
    };
    const timeout = setTimeout(() => { if (!session) ws.close(1008, "Join timed out"); }, 10000);
    ws.on("message", raw => {
      if (Date.now() - windowStart >= 1000) { requests = 0; windowStart = Date.now(); }
      if (++requests > 35 || raw.toString().length > 2048) { ws.close(1008, "Too many or oversized actions"); return; }
      enqueue(async () => {
        let msg: Record<string, unknown>; try { msg = JSON.parse(raw.toString()); } catch { throw new OnlineError("Invalid message."); }
        if (!msg || typeof msg !== "object" || Array.isArray(msg)) throw new OnlineError("Invalid message.");
        if (!session) {
          if (typeof msg.type !== "string" || !["create", "join", "resume"].includes(msg.type)) throw new OnlineError("Join a world first.");
          await limitAdmission(ip); await subscribe();
          let token: string, code: string;
          if (msg.type === "create") {
            if (!validName(msg.name) || typeof msg.mode !== "string" || !["survival", "creative"].includes(msg.mode)) throw new OnlineError("Choose your name and game mode.");
            await limitCreation(ip); code = newCode(); token = newToken();
            const created = createRoom(msg.mode as "survival" | "creative", Date.now());
            if (!await (await redis()).set(roomKey(code), JSON.stringify(created), { NX: true })) throw new OnlineError("Could not create world. Retry.");
          } else {
            if (!validCode(msg.code)) throw new OnlineError("Invalid invite code."); code = msg.code;
            if (msg.type === "resume") { if (typeof msg.token !== "string" || !/^[a-f0-9]{48}$/.test(msg.token)) throw new OnlineError("Invalid player session."); token = msg.token; }
            else { if (!validName(msg.name)) throw new OnlineError("Choose a player name."); token = newToken(); }
          }
          const hash = hashToken(token), id = hash.slice(0, 16), socketId = newToken();
          const { room, result: newArrival } = await mutateRoom(code, room => {
            const old = room.players[id];
            if (msg.type === "resume" && (!old || old.tokenHash !== hash)) throw new OnlineError("Saved player session not found.");
            joinRoom(room, id, old?.name ?? String(msg.name), hash, Date.now()); room.players[id].socketId = socketId; return !old;
          });
          if (closed) {
            await mutateRoom(code, room => { if (room.players[id]?.socketId === socketId) { if (newArrival) delete room.players[id]; else room.players[id].seen = 0; } });
            return;
          }
          session = { code, id, hash, socketId }; lastSent = room.revision;
          const key = channel(code); if (!listeners.has(key)) listeners.set(key, new Set()); listeners.get(key)!.add(notify); startClock(code);
          clearTimeout(timeout);
          send({ type: "joined", token, view: roomView(room, code, id, Date.now()), seq: room.players[id].seq });
          timer = setInterval(() => {
            if (!alive || ws.readyState !== 1) { ws.terminate(); return; }
            alive = false; ws.ping();
            enqueue(async () => {
              const current = session!;
              const { room } = await mutateRoom(current.code, room => {
                if (!authorized(room)) throw new OnlineError("Player session replaced. Reconnect.");
                room.players[current.id].seen = Date.now();
              }); notify(room);
            });
          }, 15000);
          return;
        }
        if (msg.type !== "action") throw new OnlineError("Unknown message.");
        if (typeof msg.seq !== "number") throw new OnlineError("Invalid action sequence.");
        const intent = parseIntent(msg.intent), current = session;
        const { room, result } = await mutateRoom(current.code, room => {
          if (!authorized(room)) throw new OnlineError("Player session replaced. Reconnect.");
          return applyIntent(room, current.id, intent, msg.seq as number, Date.now());
        });
        if (result) send({ type: "message", message: result }); notify(room);
      });
    });
    ws.on("pong", () => { alive = true; });
    ws.on("error", () => { ws.close(); });
    ws.once("close", () => {
      closed = true; clearTimeout(timeout); if (timer) clearInterval(timer); if (snapshotTimer) clearTimeout(snapshotTimer);
      if (session) {
        const current = session, key = channel(current.code), list = listeners.get(key); list?.delete(notify); if (!list?.size) { listeners.delete(key); stopClock(current.code); }
      }
      // Drain accepted actions before clearing presence, and finish persistence before Vercel releases this handler.
      void processing.then(async () => {
        if (session) await mutateRoom(session.code, room => { if (authorized(room)) room.players[session!.id].seen = 0; }).catch(() => {});
        resolve();
      }).catch(() => resolve());
    });
  });
}
