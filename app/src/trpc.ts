import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../server/trpc/routers/index.js";
import { unauthorizedRedirectLink } from "./trpcUnauthorizedLink.js";

const getBaseUrl = () => {
  if (typeof window !== "undefined") return "";
  return process.env?.VITE_API_URL ?? "http://localhost:3000";
};

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    unauthorizedRedirectLink,
    httpBatchLink({
      url: `${getBaseUrl()}/api/trpc`,
      fetch(url: RequestInfo | URL, options?: RequestInit) {
        return fetch(url, { ...options, credentials: "include" });
      },
    }),
  ],
});
