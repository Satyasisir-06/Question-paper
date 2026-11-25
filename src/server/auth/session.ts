import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const scrypt = promisify(scryptCb);

export const SESSION_COOKIE_NAME = "pv_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

export interface SessionUser {
  userId: string;
  email: string;
  name: string;
  role: "ADMIN" | "MODERATOR";
}

function getSecretKey(): Uint8Array {
  const rawTrimmed = process.env.SESSION_SECRET?.trim() ?? "";
  const raw =
    (rawTrimmed.startsWith('"') && rawTrimmed.endsWith('"')) ||
    (rawTrimmed.startsWith("'") && rawTrimmed.endsWith("'"))
      ? rawTrimmed.slice(1, -1).trim()
      : rawTrimmed;
  if (raw && raw.length >= 32) {
    return new TextEncoder().encode(raw);
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be at least 32 characters in production.");
  }
  return new TextEncoder().encode(
    "dev-only-fallback-session-secret-change-me-32chars"
  );
}

/** Hash a plaintext password using scrypt with a 16-byte random salt. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

/** Verify a password against a stored scrypt salt:hash string in constant time. */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex || keyHex.length !== 128) return false;

  try {
    const keyBuffer = Buffer.from(keyHex, "hex");
    const derived = (await scrypt(password, salt, 64)) as Buffer;
    if (keyBuffer.length !== derived.length) return false;
    return timingSafeEqual(keyBuffer, derived);
  } catch {
    return false;
  }
}

/** Sign an authenticated admin/moderator session token. */
export async function signSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

/** Verify and decode a session JWT; returns null for invalid or expired tokens. */
export async function verifySessionToken(
  token: string
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string" ||
      (payload.role !== "ADMIN" && payload.role !== "MODERATOR")
    ) {
      return null;
    }

    return {
      userId: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

/** Read current session user from Next.js HttpOnly cookie store. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/** Build HttpOnly cookie attributes for login/logout responses. */
export function buildSessionCookieOptions(
  maxAgeSeconds = SESSION_TTL_SECONDS,
  secure = process.env.NODE_ENV === "production"
) {
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
