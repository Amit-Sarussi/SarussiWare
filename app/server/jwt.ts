import * as jose from "jose";
import type { IncomingMessage } from "node:http";

const COOKIE_NAME = "auth_token";
const DEFAULT_MAX_AGE_SEC = 7 * 24 * 60 * 60; // 7 days

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be set and at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export interface JwtPayload {
  sub: string; // userId
  iat?: number;
  exp?: number;
}

export async function signToken(payload: Omit<JwtPayload, "iat" | "exp">, maxAgeSec = DEFAULT_MAX_AGE_SEC): Promise<string> {
  const secret = getSecret();
  return await new jose.SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(payload.sub))
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + maxAgeSec)
    .sign(secret);
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const secret = getSecret();
    const { payload } = await jose.jwtVerify(token, secret);
    const sub = payload.sub;
    if (typeof sub !== "string") return null;
    return { sub, iat: payload.iat as number, exp: payload.exp as number };
  } catch {
    return null;
  }
}

export function getTokenFromRequest(req: IncomingMessage): string | null {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;)\\s*${COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1].trim()) : null;
}

/** Get JWT from Web API Request (e.g. tRPC fetch adapter). */
export function getTokenFromWebRequest(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;)\\s*${COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1].trim()) : null;
}

export function getAuthCookieName(): string {
  return COOKIE_NAME;
}

export function buildSetCookieHeader(token: string, maxAgeSec: number): string {
  const isProd = process.env.NODE_ENV === "production";
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    `Max-Age=${maxAgeSec}`,
    "SameSite=Lax",
  ];
  if (isProd) parts.push("Secure");
  return parts.join("; ");
}

export function buildClearCookieHeader(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax`;
}
