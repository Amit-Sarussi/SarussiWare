import { observable } from "@trpc/server/observable";
import type { TRPCLink } from "@trpc/client";
import type { AppRouter } from "../server/trpc/routers/index.js";

declare global {
  interface Window {
    /** path is the tRPC procedure path (e.g. "auth.me"). Don't redirect when path is "auth.me" to avoid loop. */
    __onTrpcUnauthorized?: (path: string) => void;
  }
}

function isUnauthorizedResult(result: unknown): boolean {
  if (result && typeof result === "object" && "result" in result) {
    const r = (result as { result?: unknown }).result;
    if (r && typeof r === "object" && "error" in r) {
      const err = (r as { error?: { data?: { code?: string } } }).error;
      return err?.data?.code === "UNAUTHORIZED";
    }
  }
  return false;
}

function isUnauthorizedError(err: unknown): boolean {
  if (err && typeof err === "object" && "data" in err) {
    return (err as { data?: { code?: string } }).data?.code === "UNAUTHORIZED";
  }
  return false;
}

/**
 * Link that calls window.__onTrpcUnauthorized when any procedure returns UNAUTHORIZED.
 * Register the handler in main.ts (clear user + redirect to /login).
 */
export const unauthorizedRedirectLink: TRPCLink<AppRouter> = () => {
  return ({ next, op }) => {
    return observable((observer) => {
      const sub = next(op).subscribe({
        next(value) {
          if (isUnauthorizedResult(value)) {
            window.__onTrpcUnauthorized?.(op.path);
          }
          observer.next(value);
        },
        error(err) {
          if (isUnauthorizedError(err)) {
            window.__onTrpcUnauthorized?.(op.path);
          }
          observer.error(err);
        },
        complete() {
          observer.complete();
        },
      });
      return () => sub.unsubscribe();
    });
  };
};
