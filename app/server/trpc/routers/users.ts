import { TRPCError } from "@trpc/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../../db.js";
import { router, adminProcedure } from "../trpc.js";

const SALT_ROUNDS = 10;

function userToJson(
  user: { id: number; name: string; createdAt: Date; permissionIds: number[] },
  idToName: Map<number, string>
) {
  return {
    id: user.id,
    name: user.name,
    permissionIds: user.permissionIds,
    permissions: user.permissionIds.map((id) => idToName.get(id)).filter(Boolean) as string[],
    createdAt: user.createdAt.toISOString(),
  };
}

async function getIdToName(permissionIds: number[]): Promise<Map<number, string>> {
  if (permissionIds.length === 0) return new Map();
  const perms = await prisma.permission.findMany({
    where: { id: { in: permissionIds } },
    select: { id: true, name: true },
  });
  return new Map(perms.map((p) => [p.id, p.name]));
}

export const usersRouter = router({
  list: adminProcedure.query(async () => {
    const users = await prisma.user.findMany({ orderBy: { name: "asc" } });
    const allIds = [...new Set(users.flatMap((u) => u.permissionIds))];
    const idToName = await getIdToName(allIds);
    return users.map((u) => userToJson(u, idToName));
  }),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required"),
        password: z.string().min(8, "Password must be at least 8 characters"),
        permissionIds: z.array(z.number()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const nameNorm = input.name.trim();
      const existing = await prisma.user.findUnique({ where: { name: nameNorm } });
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "A user with this name already exists" });
      }
      const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
      const permissionIds = input.permissionIds ?? [];
      const user = await prisma.user.create({
        data: { name: nameNorm, passwordHash, permissionIds },
      });
      return userToJson(user, await getIdToName(user.permissionIds));
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1, "Name is required").optional(),
        password: z.string().min(8).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const existing = await prisma.user.findUnique({ where: { id: input.id } });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }
      const data: { name?: string; passwordHash?: string } = {};
      if (input.name !== undefined) {
        const nameNorm = input.name.trim();
        if (nameNorm !== existing.name) {
          const taken = await prisma.user.findUnique({ where: { name: nameNorm } });
          if (taken) {
            throw new TRPCError({ code: "CONFLICT", message: "A user with this name already exists" });
          }
          data.name = nameNorm;
        }
      }
      if (input.password !== undefined) {
        data.passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
      }
      if (Object.keys(data).length === 0) {
        return userToJson(existing, await getIdToName(existing.permissionIds));
      }
      const user = await prisma.user.update({
        where: { id: input.id },
        data,
      });
      return userToJson(user, await getIdToName(user.permissionIds));
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const user = await prisma.user.findUnique({ where: { id: input.id } });
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }
      await prisma.user.delete({ where: { id: input.id } });
      return { ok: true };
    }),

  addPermission: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        permissionId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const user = await prisma.user.findUnique({ where: { id: input.userId } });
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }
      const perm = await prisma.permission.findUnique({ where: { id: input.permissionId } });
      if (!perm) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Permission not found" });
      }
      if (user.permissionIds.includes(perm.id)) {
        return userToJson(user, await getIdToName(user.permissionIds));
      }
      await prisma.user.update({
        where: { id: input.userId },
        data: { permissionIds: { push: perm.id } },
      });
      const updated = await prisma.user.findUnique({ where: { id: input.userId } });
      if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "User not found after add" });
      return userToJson(updated, await getIdToName(updated.permissionIds));
    }),

  removePermission: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        permissionId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const user = await prisma.user.findUnique({ where: { id: input.userId } });
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      const newIds = user.permissionIds.filter((id) => id !== input.permissionId);
      await prisma.user.update({
        where: { id: input.userId },
        data: { permissionIds: newIds },
      });
      const updated = await prisma.user.findUnique({ where: { id: input.userId } });
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      return userToJson(updated, await getIdToName(updated.permissionIds));
    }),
});
