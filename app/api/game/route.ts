import { experimental_upgradeWebSocket } from "@vercel/functions";
import { attachGameSocket } from "@/lib/ninja-socket";
import { isAllowedOrigin } from "@/lib/contact";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(request: Request) {
  if (!process.env.REDIS_URL) return Response.json({ error: "Online play needs Redis. Your offline world is still available." }, { status: 503 });
  if (!isAllowedOrigin(request.headers.get("origin"), new URL(request.url).host)) return Response.json({ error: "Forbidden origin." }, { status: 403 });
  if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") return Response.json({ ready: true, maxPlayers: 8 });
  if (!request.headers.get("origin")) return Response.json({ error: "Origin required." }, { status: 403 });
  return experimental_upgradeWebSocket(ws => attachGameSocket(ws, request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"), { maxPayload: 2048 });
}
