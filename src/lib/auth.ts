import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { getUserById } from "@/lib/db";
import type { AuthUser } from "@/types/travel";

export const SESSION_COOKIE_NAME = "tripgenie_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

const DATA_DIR = path.join(process.cwd(), "data");
const SECRET_FILE = path.join(DATA_DIR, ".auth-secret");
let cachedSecret: string | null = null;

function getAuthSecret(): string {
  if (process.env.AUTH_SECRET?.trim()) {
    return process.env.AUTH_SECRET.trim();
  }
  if (cachedSecret) return cachedSecret;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(SECRET_FILE)) {
      const existing = fs.readFileSync(SECRET_FILE, "utf8").trim();
      if (existing.length >= 32) {
        cachedSecret = existing;
        return existing;
      }
    }
    const generated = crypto.randomBytes(32).toString("hex");
    fs.writeFileSync(SECRET_FILE, generated, "utf8");
    cachedSecret = generated;
    return generated;
  } catch {
    cachedSecret = crypto.randomBytes(32).toString("hex");
    return cachedSecret;
  }
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, keyHex] = storedHash.split(":");
  if (!salt || !keyHex) return false;
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const keyBuf = Buffer.from(keyHex, "hex");
    if (derived.length !== keyBuf.length) return false;
    return crypto.timingSafeEqual(derived, keyBuf);
  } catch {
    return false;
  }
}

interface SessionPayload {
  uid: string;
  exp: number;
}

export function createSessionToken(userId: string): string {
  const payload: SessionPayload = {
    uid: userId,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", getAuthSecret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  try {
    const expectedSig = crypto
      .createHmac("sha256", getAuthSecret())
      .update(encoded)
      .digest("base64url");
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.uid || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getSessionCookieOptions(request?: Request) {
  const proto = request?.headers.get("x-forwarded-proto") || "";
  let isHttps = proto.includes("https");
  if (!isHttps && request) {
    try {
      isHttps = new URL(request.url).protocol === "https:";
    } catch {
      isHttps = false;
    }
  }
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
    secure: isHttps,
  };
}

export async function getAuthenticatedUser(): Promise<AuthUser | null> {
  try {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE_NAME)?.value;
    const payload = verifySessionToken(token);
    if (!payload) return null;
    return getUserById(payload.uid);
  } catch {
    return null;
  }
}
