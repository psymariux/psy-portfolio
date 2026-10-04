import { readSave } from "./ninja-game.ts";
import { validCode, validName, type GameMode, type Intent, type RoomView } from "./ninja-online.ts";
export type OnlineStatus = "connecting" | "online" | "reconnecting" | "error";
export type WorldCredential = { code: string; token: string; name: string; mode: GameMode };
export type JoinRequest = { type: "create"; name: string; mode: GameMode } | { type: "join"; name: string; code: string } | { type: "resume"; code: string; token: string };
const CREDENTIALS = "psymariux:online-worlds:v1";
export function savedWorlds(): WorldCredential[] {
  try { const data = JSON.parse(localStorage.getItem(CREDENTIALS) ?? "[]"); return Array.isArray(data) ? data.slice(0, 12).filter(c => c && typeof c === "object" && validCode(c.code) && typeof c.token === "string" && /^[a-f0-9]{48}$/.test(c.token) && validName(c.name) && ["survival", "creative"].includes(c.mode)) : []; } catch { return []; }
}
function remember(credential: WorldCredential) { try { localStorage.setItem(CREDENTIALS, JSON.stringify([credential, ...savedWorlds().filter(c => c.code !== credential.code)].slice(0, 12))); } catch { /* Joining remains possible without storage. */ } }
export function connectOnline(initial: JoinRequest, handlers: { view: (view: RoomView) => void; status: (status: OnlineStatus) => void; message: (text: string) => void }) {
  let ws: WebSocket | undefined, stopped = false, timer: ReturnType<typeof setTimeout> | undefined, attempts = 0, credential: WorldCredential | undefined, sequence = 0, revision = -1;
  let watchdog: ReturnType<typeof setInterval> | undefined, lastUpdate = Date.now();
  function open() {
    if (stopped) return;
    handlers.status(credential ? "reconnecting" : "connecting");
    const url = new URL("/api/game", location.href); url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const endpoint = process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_GAME_DEV_WS_URL ? process.env.NEXT_PUBLIC_GAME_DEV_WS_URL : url.toString();
    const socket = new WebSocket(endpoint); ws = socket; lastUpdate = Date.now();
    if (watchdog) clearInterval(watchdog);
    watchdog = setInterval(() => { if (!stopped && Date.now() - lastUpdate > 12000) socket.close(4000, "World updates timed out"); }, 3000);
    socket.onopen = () => { if (!stopped && ws === socket) socket.send(JSON.stringify(credential ? { type: "resume", code: credential.code, token: credential.token } : initial)); };
    socket.onmessage = event => {
      if (stopped || socket !== ws) return;
      try {
        lastUpdate = Date.now();
        if (typeof event.data !== "string" || event.data.length > 3_000_000) throw new Error("Invalid server response.");
        const data = JSON.parse(event.data);
        if (data.type === "error") { handlers.message(String(data.message)); if (!credential) { handlers.status("error"); stopped = true; socket.close(); } return; }
        if (data.type === "message") { handlers.message(String(data.message)); return; }
        const raw = data.view;
        if (!["state", "joined"].includes(data.type) || !validCode(raw?.code) || !["survival", "creative"].includes(raw.mode) || typeof raw.playerId !== "string" || !/^[a-f0-9]{16}$/.test(raw.playerId) || !Number.isFinite(raw.freeze) || raw.freeze < 0 || !Number.isSafeInteger(raw.revision) || raw.revision < 0 || !Number.isSafeInteger(data.seq) || data.seq < 0 || !Array.isArray(raw.players) || raw.players.length > 8) throw new Error("Invalid world response.");
        if (!raw.players.every((p: RoomView["players"][number]) => p && typeof p.id === "string" && /^[a-f0-9]{16}$/.test(p.id) && validName(p.name) && Number.isSafeInteger(p.x) && Math.abs(p.x) <= 2048 && Number.isSafeInteger(p.y) && Math.abs(p.y) <= 2048 && Array.isArray(p.facing) && p.facing.length === 2 && p.facing.every(Number.isInteger) && Math.abs(p.facing[0]) + Math.abs(p.facing[1]) === 1) || !raw.players.some((p: RoomView["players"][number]) => p.id === raw.playerId) || new Set(raw.players.map((p: RoomView["players"][number]) => p.id)).size !== raw.players.length) throw new Error("Invalid player response.");
        const view = data.view as RoomView; view.game = readSave(JSON.stringify(view.game), true);
        if (data.type === "joined") {
          if (typeof data.token !== "string" || !/^[a-f0-9]{48}$/.test(data.token)) throw new Error("Invalid player session.");
          credential = { code: view.code, token: data.token, mode: view.mode, name: view.players.find(p => p.id === view.playerId)?.name ?? "Player" }; remember(credential);
          sequence = data.seq; revision = -1; attempts = 0; handlers.status("online");
        } else sequence = Math.max(sequence, data.seq);
        if (view.revision > revision) { revision = view.revision; handlers.view(view); }
      } catch { handlers.message("Could not synchronize this world. Reconnect to try again."); handlers.status("error"); stopped = true; socket.close(); }
    };
    socket.onerror = () => { if (!stopped && socket === ws) handlers.message("Online connection unavailable. Check that Redis and Fluid Compute are configured."); };
    socket.onclose = event => {
      if (socket === ws && watchdog) clearInterval(watchdog);
      if (stopped || socket !== ws) return;
      if (event.code === 4001 || event.code === 1008) { stopped = true; handlers.status("error"); handlers.message("This player session closed. Rejoin from the Online menu."); return; }
      handlers.status("reconnecting");
      timer = setTimeout(open, Math.min(30000, 1000 * 2 ** Math.min(attempts++, 5)) + Math.floor(Math.random() * 300));
    };
  }
  open();
  return {
    send(intent: Intent) { if (stopped || !credential || ws?.readyState !== WebSocket.OPEN) return false; ws.send(JSON.stringify({ type: "action", seq: ++sequence, intent })); return true; },
    stop() { stopped = true; if (timer) clearTimeout(timer); if (watchdog) clearInterval(watchdog); ws?.close(1000, "Leaving world"); },
  };
}
export type OnlineConnection = ReturnType<typeof connectOnline>;
