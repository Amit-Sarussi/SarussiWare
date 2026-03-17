import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { getTokenFromWebRequest, verifyToken } from "../jwt.js";
import { prisma } from "../db.js";

export async function createContext(opts: FetchCreateContextFnOptions) {
  const { req, resHeaders } = opts;
  let user: { id: number; name: string; permissions: string[] } | null = null;

  const token = getTokenFromWebRequest(req);
  if (token) {
    const payload = await verifyToken(token);
    if (payload) {
      const userId = parseInt(payload.sub, 10);
      if (!Number.isNaN(userId)) {
        const u = await prisma.user.findUnique({ where: { id: userId } });
        if (u && u.permissionIds.length > 0) {
          const perms = await prisma.permission.findMany({
            where: { id: { in: u.permissionIds } },
            select: { id: true, name: true },
          });
          const idToName = new Map(perms.map((p) => [p.id, p.name]));
          user = {
            id: u.id,
            name: u.name,
            permissions: u.permissionIds.map((id) => idToName.get(id)).filter(Boolean) as string[],
          };
        } else if (u) {
          user = { id: u.id, name: u.name, permissions: [] };
        }
      }
    }
  }

  return { req, resHeaders, user };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
