import { router } from "../trpc.js";
import { authRouter } from "./auth.js";
import { financeRouter } from "./finance.js";
import { permissionsRouter } from "./permissions.js";
import { usersRouter } from "./users.js";

export const appRouter = router({
  auth: authRouter,
  finance: financeRouter,
  permissions: permissionsRouter,
  users: usersRouter,
});

export type AppRouter = typeof appRouter;
