import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  buildSessionCookieOptions,
  hashPassword,
  verifyPassword,
  signSessionToken,
  verifySessionToken,
} from "@/server/auth/session";
import { requireAdminApi } from "@/server/auth/guards";
import { getStorageProvider } from "@/server/storage";

const mockCookies = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = mockCookies.get(name);
      return value ? { name, value } : undefined;
    },
  }),
}));

describe("Admin auth, guards, and storage factory", () => {
  it("hashes password with random salt and verifies securely", async () => {
    const hash1 = await hashPassword("StrongPass#2026");
    const hash2 = await hashPassword("StrongPass#2026");
    expect(hash1).not.toBe(hash2);
    expect(await verifyPassword("StrongPass#2026", hash1)).toBe(true);
    expect(await verifyPassword("WrongPass#2026", hash1)).toBe(false);
    expect(await verifyPassword("StrongPass#2026", "malformed-hash")).toBe(false);
    expect(await verifyPassword("StrongPass#2026", "abc:deadbeef")).toBe(false);
  });

  it("signs, verifies, and rejects invalid JWT session tokens", async () => {
    const token = await signSessionToken({
      userId: "user-123",
      email: "admin@college.edu",
      name: "Exam Admin",
      role: "ADMIN",
    });

    expect(await verifySessionToken(token)).toEqual({
      userId: "user-123",
      email: "admin@college.edu",
      name: "Exam Admin",
      role: "ADMIN",
    });

    const parts = token.split(".");
    const tampered = `${parts[0]}.${parts[1]}a.${parts[2]}`;
    expect(await verifySessionToken(tampered)).toBeNull();
    expect(await verifySessionToken("not-a-jwt")).toBeNull();
  });

  it("enforces requireAdminApi for unauthenticated, CSRF, and valid requests", async () => {
    mockCookies.clear();
    const unauth = await requireAdminApi(
      new NextRequest("http://localhost:3000/api/v1/admin/papers")
    );
    expect(unauth.authorized).toBe(false);
    if (!unauth.authorized) {
      expect(unauth.response.status).toBe(401);
    }

    const crossOrigin = await requireAdminApi(
      new NextRequest("http://localhost:3000/api/v1/admin/papers/1/approve", {
        method: "PATCH",
        headers: { host: "localhost:3000", origin: "https://evil.example" },
      })
    );
    expect(crossOrigin.authorized).toBe(false);
    if (!crossOrigin.authorized) {
      expect(crossOrigin.response.status).toBe(403);
    }

    const token = await signSessionToken({
      userId: "admin-1",
      email: "admin@college.edu",
      name: "Exam Admin",
      role: "ADMIN",
    });
    mockCookies.set("pv_session", token);

    const ok = await requireAdminApi(
      new NextRequest("http://localhost:3000/api/v1/admin/papers/1/approve", {
        method: "PATCH",
        headers: { host: "localhost:3000", origin: "http://localhost:3000" },
      })
    );
    expect(ok.authorized).toBe(true);
    if (ok.authorized) {
      expect(ok.user.role).toBe("ADMIN");
    }

    const cookieOpts = buildSessionCookieOptions(60);
    expect(cookieOpts.httpOnly).toBe(true);
    expect(cookieOpts.maxAge).toBe(60);
  });

  it("resolves default local storage provider", () => {
    const storage1 = getStorageProvider();
    const storage2 = getStorageProvider();
    expect(storage1).toBe(storage2);
  });
});
