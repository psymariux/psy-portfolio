import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { connectOnline, savedWorlds } from "../lib/ninja-online-client.ts";
import { createRoom, joinRoom, roomView } from "../lib/ninja-online.ts";

class Socket {
  static OPEN = 1; static instances: Socket[] = [];
  readyState = 0; sent: Record<string, unknown>[] = [];
  onopen?: () => void; onmessage?: (event: { data: string }) => void; onclose?: (event: { code: number }) => void;
  constructor() { Socket.instances.push(this); }
  open() { this.readyState = 1; this.onopen?.(); }
  send(value: string) { this.sent.push(JSON.parse(value)); }
  receive(value: unknown) { this.onmessage?.({ data: JSON.stringify(value) }); }
  close(code = 1000) { this.readyState = 3; this.onclose?.({ code }); }
}
function browser(t: TestContext) {
  const storage = new Map<string, string>(), retries: (() => void)[] = [];
  const replacements = { WebSocket: Socket, location: { href: "https://portfolio.example/", protocol: "https:" }, localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) } };
  for (const [key, value] of Object.entries(replacements)) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); });
  }
  t.mock.method(globalThis, "setInterval", () => 0 as unknown as ReturnType<typeof setInterval>);
  t.mock.method(globalThis, "setTimeout", ((fn: () => void) => { retries.push(fn); return 0; }) as unknown as typeof setTimeout);
  const room = createRoom("survival", 1000), id = "c".repeat(16), token = "b".repeat(48); joinRoom(room, id, "Host", "hash", 1000);
  return { storage, retries, joined: { type: "joined", token, seq: 4, view: roomView(room, "a".repeat(24), id, 1000) } };
}

test("online client resumes credentials after disconnect, keeps intent sequences and does not send while disconnected", t => {
  const fixture = browser(t), statuses: string[] = [], views: unknown[] = [];
  const client = connectOnline({ type: "create", name: "Host", mode: "survival" }, { status: s => statuses.push(s), view: v => views.push(v), message: () => {} });
  const first = Socket.instances.at(-1)!; first.open(); first.receive(fixture.joined);
  assert.equal(statuses.at(-1), "online"); assert.equal(views.length, 1); assert.ok(fixture.storage.size);
  assert.equal(client.send({ kind: "move", facing: [1, 0], sprint: false }), true); assert.equal(first.sent.at(-1)!.seq, 5);
  first.close(1006); assert.equal(statuses.at(-1), "reconnecting"); assert.equal(client.send({ kind: "recall", facing: [1, 0] }), false);
  fixture.retries.shift()!(); const second = Socket.instances.at(-1)!; second.open(); assert.equal(second.sent[0].type, "resume"); assert.equal(second.sent[0].token, fixture.joined.token);
  second.receive({ ...fixture.joined, seq: 7 }); client.send({ kind: "recall", facing: [1, 0] }); assert.equal(second.sent.at(-1)!.seq, 8);
  second.receive({ type: "error", message: "World storage limit reached." }); assert.equal(client.send({ kind: "recover", facing: [1, 0] }), true);
  client.stop(); assert.equal(client.send({ kind: "recall", facing: [1, 0] }), false);
});

test("invalid server metadata cannot replace the world or persist player credentials", t => {
  const fixture = browser(t), statuses: string[] = [], views: unknown[] = [];
  const client = connectOnline({ type: "create", name: "Host", mode: "survival" }, { status: s => statuses.push(s), view: v => views.push(v), message: () => {} });
  const socket = Socket.instances.at(-1)!; socket.open(); socket.receive({ ...fixture.joined, view: { ...fixture.joined.view, mode: "administrator" } });
  assert.equal(statuses.at(-1), "error"); assert.equal(views.length, 0); assert.equal(fixture.storage.size, 0); assert.equal(client.send({ kind: "recall", facing: [1, 0] }), false);
  client.stop();
});

test("a malformed saved credential does not discard another valid world identity", t => {
  const fixture = browser(t), credential = { code: fixture.joined.view.code, token: fixture.joined.token, name: "Host", mode: "survival" };
  fixture.storage.set("psymariux:online-worlds:v1", JSON.stringify([null, {}, credential]));
  assert.deepEqual(savedWorlds(), [credential]);
});

test("client accepts the server's full Unicode name range rather than counting UTF-16 units", t => {
  const fixture = browser(t), statuses: string[] = [], name = "𐐀".repeat(20);
  fixture.joined.view.players[0].name = name;
  const client = connectOnline({ type: "create", name: "Host", mode: "survival" }, { status: s => statuses.push(s), view: () => {}, message: () => {} });
  const socket = Socket.instances.at(-1)!; socket.open(); socket.receive(fixture.joined);
  assert.equal(statuses.at(-1), "online"); assert.equal(savedWorlds()[0].name, name); client.stop();
});
