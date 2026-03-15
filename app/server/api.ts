import type { IncomingMessage, ServerResponse } from "node:http";
import { prisma } from "./db.js";

type NextFunction = (err?: unknown) => void;

function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export function apiMiddleware(req: IncomingMessage, res: ServerResponse, next: NextFunction): void {
  if (!req.url?.startsWith("/api/")) {
    next();
    return;
  }

  const handle = async () => {
    try {
      const path = (req.url ?? "").slice(4).split("?")[0]; // strip "/api" and query

      if (path === "/users" && req.method === "GET") {
        const users = await prisma.user.findMany({ orderBy: { id: "asc" } });
        sendJson(res, 200, { users });
        return;
      }

      if (path === "/users" && req.method === "POST") {
        const body = await readBody(req);
        const { name } = JSON.parse(body || "{}") as { name?: string };
        if (!name || typeof name !== "string") {
          sendJson(res, 400, { error: "name is required" });
          return;
        }
        const user = await prisma.user.create({ data: { name } });
        sendJson(res, 201, { user });
        return;
      }

      sendJson(res, 404, { error: "Not found" });
    } catch (err) {
      console.error("API error:", err);
      sendJson(res, 500, { error: err instanceof Error ? err.message : "Internal server error" });
    }
  };

  handle();
}
