import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { prisma } from "../../db.js";
import { router, adminProcedure } from "../trpc.js";

export const permissionsRouter = router({
  list: adminProcedure.query(async () => {
    const [permissions, users] = await Promise.all([
      prisma.permission.findMany({ orderBy: { name: "asc" } }),
      prisma.user.findMany({ select: { id: true, permissionIds: true } }),
    ]);
    return permissions.map((p) => ({
      id: p.id,
      name: p.name,
      userIds: users.filter((u) => u.permissionIds.includes(p.id)).map((u) => u.id),
    }));
  }),

  create: adminProcedure
    .input(z.object({ name: z.string().min(1, "Name is required") }))
    .mutation(async ({ input }) => {
      const name = input.name.trim();
      const existing = await prisma.permission.findUnique({ where: { name } });
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "A permission with this name already exists" });
      }
      return prisma.permission.create({ data: { name } });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const perm = await prisma.permission.findUnique({ where: { id: input.id } });
      if (!perm) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Permission not found" });
      }
      const usersWithPerm = await prisma.user.findMany({
        where: { permissionIds: { has: input.id } },
        select: { id: true, permissionIds: true },
      });
      for (const u of usersWithPerm) {
        await prisma.user.update({
          where: { id: u.id },
          data: { permissionIds: u.permissionIds.filter((id) => id !== input.id) },
        });
      }
      await prisma.permission.delete({ where: { id: input.id } });
      return { ok: true };
    }),
});
