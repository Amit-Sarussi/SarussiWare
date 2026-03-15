import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

// Prefer APP_DATABASE_URL so Docker/Compose env isn't overwritten by app/.env (loaded by Vite)
const connectionString = process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("APP_DATABASE_URL or DATABASE_URL environment variable is not set");
}

const adapter = new PrismaPg({ connectionString });
export const prisma = new PrismaClient({ adapter });
