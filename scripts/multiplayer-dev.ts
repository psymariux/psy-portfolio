// Local-only WebSocket adapter. Production uses app/api/game on Vercel.
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { attachGameSocket } from "../lib/ninja-socket.ts";
const port = Number(process.env.GAME_DEV_PORT ?? 3102), origin = process.env.GAME_DEV_ORIGIN ?? "http://127.0.0.1:3100";
if (!process.env.REDIS_URL) throw new Error("Set REDIS_URL to your local Redis connection.");
const server = createServer((_req, res) => { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ ready: true, maxPlayers: 8 })); });
const sockets = new WebSocketServer({ noServer: true, maxPayload: 2048 });
server.on("upgrade", (request, socket, head) => {
  if (request.headers.origin !== origin || request.url !== "/api/game") { socket.destroy(); return; }
  sockets.handleUpgrade(request, socket, head, ws => { void attachGameSocket(ws, request.socket.remoteAddress ?? "local"); });
});
server.listen(port, "127.0.0.1", () => { const address = server.address(); console.log(`Local game sockets listening on 127.0.0.1:${typeof address === "object" && address ? address.port : port}`); });
