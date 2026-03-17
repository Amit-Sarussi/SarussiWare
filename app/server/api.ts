import "./env.js";
import type { IncomingMessage, ServerResponse } from "node:http";
import { handleTrpc } from "./trpc/nodeHandler.js";

type NextFunction = (err?: unknown) => void;

export function apiMiddleware(req: IncomingMessage, res: ServerResponse, next: NextFunction): void {
  const url = req.url ?? "";
  if (!url.startsWith("/api/")) {
    next();
    return;
  }

  const path = url.slice(4).split("?")[0];
  if (path === "/trpc" || path.startsWith("/trpc/")) {
    const baseUrl = `http://${req.headers.host ?? "localhost"}`;
    handleTrpc(req, res, baseUrl).catch((err) => {
      console.error("tRPC error:", err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Internal server error" }));
      }
    });
    return;
  }

  next();
}
