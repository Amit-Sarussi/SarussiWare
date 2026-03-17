import type { IncomingMessage, ServerResponse } from "node:http";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createContext } from "./context.js";
import { appRouter } from "./routers/index.js";

const TRPC_ENDPOINT = "/api/trpc";

function readBody(req: IncomingMessage): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function nodeReqToWebRequest(req: IncomingMessage, baseUrl: string): Promise<Request> {
  const url = new URL(req.url ?? "/", baseUrl);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined) {
      if (Array.isArray(value)) {
        value.forEach((v) => headers.append(key, v));
      } else {
        headers.append(key, value);
      }
    }
  }
  const hasBody = req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS";
  const body = hasBody ? await readBody(req) : undefined;
  return new Request(url, { method: req.method ?? "GET", headers, body });
}

async function webResponseToNodeRes(response: Response, res: ServerResponse): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  if (response.body) {
    const reader = response.body.getReader();
    const pump = async (): Promise<void> => {
      const { done, value } = await reader.read();
      if (done) {
        res.end();
        return;
      }
      res.write(Buffer.from(value));
      return pump();
    };
    await pump();
  } else {
    res.end();
  }
}

export async function handleTrpc(req: IncomingMessage, res: ServerResponse, baseUrl: string): Promise<void> {
  const webReq = await nodeReqToWebRequest(req, baseUrl);
  const response = await fetchRequestHandler({
    endpoint: TRPC_ENDPOINT,
    req: webReq,
    router: appRouter,
    createContext,
  });
  await webResponseToNodeRes(response, res);
}

export { TRPC_ENDPOINT };
