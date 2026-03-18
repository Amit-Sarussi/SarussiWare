import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "./context.js";

const t = initTRPC.context<Context>().create();

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

const isAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }
  if (!ctx.user.permissions.includes("admin")) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

const isFinanceOrAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }
  const hasFinance =
    ctx.user.permissions.includes("finance") || ctx.user.permissions.includes("admin");
  if (!hasFinance) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Finance access required" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const router = t.router;
export const publicProcedure = t.procedure;
/** Use for procedures that require an authenticated user. `ctx.user` is guaranteed. */
export const protectedProcedure = t.procedure.use(isAuthed);
/** Use for procedures that require the user to have the "admin" permission. */
export const adminProcedure = t.procedure.use(isAdmin);
/** Use for procedures that require "finance" or "admin" permission. */
export const financeProcedure = t.procedure.use(isAuthed).use(isFinanceOrAdmin);
export const createCallerFactory = t.createCallerFactory;
