import { NextRequest } from "next/server";
import Redis from "ioredis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const migrationId = req.nextUrl.searchParams.get("migrationId");
  if (!migrationId) {
    return new Response("Missing migrationId", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const subscriber = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
      const channel = `migration:${migrationId}:progress`;

      subscriber.subscribe(channel).catch((err) => {
        console.error("Redis subscribe error:", err);
        controller.close();
      });

      subscriber.on("message", (_ch: string, message: string) => {
        controller.enqueue(encoder.encode(`data: ${message}\n\n`));

        // Check if migration is complete
        try {
          const data = JSON.parse(message);
          if (data.completed) {
            subscriber.unsubscribe().then(() => subscriber.quit());
            controller.close();
          }
        } catch {
          // ignore parse errors
        }
      });

      // Clean up on abort
      req.signal.addEventListener("abort", () => {
        subscriber.unsubscribe().then(() => subscriber.quit());
        controller.close();
      });

      // Send initial heartbeat
      controller.enqueue(encoder.encode(": heartbeat\n\n"));
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
