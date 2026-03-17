import { TRPCError } from "@trpc/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../../db.js";
import {
  signToken,
  buildSetCookieHeader,
  buildClearCookieHeader,
} from "../../jwt.js";
import { isLockedOut, recordFailedAttempt, clearAttempts, getRemainingLockoutMs } from "../../loginLimiter.js";
import { router, publicProcedure, protectedProcedure } from "../trpc.js";

const SALT_ROUNDS = 10;
const JWT_MAX_AGE_SEC = 60 * 60; // 1 hour (when "Remember me" is unchecked)
const JWT_REMEMBER_ME_MAX_AGE_SEC = 30 * 24 * 60 * 60; // 30 days

async function userToJson(user: {
  id: number;
  name: string;
  createdAt: Date;
  permissionIds: number[];
}) {
  const perms =
    user.permissionIds.length > 0
      ? await prisma.permission.findMany({
          where: { id: { in: user.permissionIds } },
          select: { id: true, name: true },
        })
      : [];
  const idToName = new Map(perms.map((p) => [p.id, p.name]));
  return {
    id: user.id,
    name: user.name,
    permissions: user.permissionIds.map((id) => idToName.get(id)).filter(Boolean) as string[],
    createdAt: user.createdAt.toISOString(),
  };
}

export const authRouter = router({
  register: publicProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required"),
        password: z.string().min(8, "Password must be at least 8 characters"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const nameNorm = input.name.trim();
      const existing = await prisma.user.findUnique({ where: { name: nameNorm } });
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "An account with this name already exists" });
      }
      const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
      await prisma.user.create({
        data: { name: nameNorm, passwordHash },
      });
      const user = await prisma.user.findUnique({ where: { name: nameNorm } });
      if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "User not found after create" });
      const token = await signToken({ sub: String(user.id) }, JWT_MAX_AGE_SEC);
      ctx.resHeaders.append("Set-Cookie", buildSetCookieHeader(token, JWT_MAX_AGE_SEC));
      return { user: await userToJson(user) };
    }),

  login: publicProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required"),
        password: z.string().min(1, "Password is required"),
        rememberMe: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const nameNorm = input.name.trim();
      if (isLockedOut(nameNorm)) {
        const ms = getRemainingLockoutMs(nameNorm);
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Too many failed attempts. Try again in ${Math.ceil(ms / 60000)} minutes.`,
        });
      }
      const user = await prisma.user.findUnique({ where: { name: nameNorm } });
      if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
        recordFailedAttempt(nameNorm);
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid name or password" });
      }
      clearAttempts(nameNorm);
      const maxAgeSec = input.rememberMe ? JWT_REMEMBER_ME_MAX_AGE_SEC : JWT_MAX_AGE_SEC;
      const token = await signToken({ sub: String(user.id) }, maxAgeSec);
      ctx.resHeaders.append("Set-Cookie", buildSetCookieHeader(token, maxAgeSec));
      return { user: await userToJson(user) };
    }),

  logout: publicProcedure.mutation(({ ctx }) => {
    ctx.resHeaders.append("Set-Cookie", buildClearCookieHeader());
    return { ok: true };
  }),

  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await prisma.user.findUnique({ where: { id: ctx.user.id } });
    if (!user) {
      ctx.resHeaders.append("Set-Cookie", buildClearCookieHeader());
      throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found" });
    }
    return { user: await userToJson(user) };
  }),
});
