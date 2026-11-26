import { describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import { NextRequest } from "next/server";
import {
  apiError,
  apiSuccess,
  generateTrackingCode,
  getClientIp,
} from "@/lib/apiResponse";
import { nodeStreamToWebStream } from "@/lib/streamAdapter";
import {
  approvePaperSchema,
  paperQuerySchema,
  rejectPaperSchema,
  updateSubjectSchema,
  uploadMetadataSchema,
  zipDownloadSchema,
} from "@/server/validators/schemas";
import { verifySameOrigin } from "@/server/auth/guards";
import { safeReadApiJson } from "@/lib/httpClient";
import { proxy } from "@/proxy";

describe("API helpers, schemas, and stream adapter", () => {
  it("builds consistent success and error envelopes", async () => {
    const okRes = apiSuccess({ hello: "world" }, { status: 201 });
    expect(okRes.status).toBe(201);
    expect(await okRes.json()).toEqual({
      success: true,
      data: { hello: "world" },
      error: null,
    });

    const errRes = apiError("BAD_INPUT", "Invalid value", 422, { field: "sem" });
    expect(errRes.status).toBe(422);
    expect(await errRes.json()).toEqual({
      success: false,
      data: null,
      error: {
        code: "BAD_INPUT",
        message: "Invalid value",
        details: { field: "sem" },
      },
    });
  });

  it("generates tracking code and extracts client IP safely", () => {
    expect(generateTrackingCode()).toMatch(/^PV-[A-F0-9]{6}$/);
    const req = new Request("http://localhost/test", {
      headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1" },
    });
    expect(getClientIp(req)).toBe("203.0.113.5");
    expect(getClientIp(new Request("http://localhost/test"))).toBe("127.0.0.1");
  });

  it("converts Node Readable stream to Web ReadableStream", async () => {
    const nodeStream = Readable.from(["hello ", Buffer.from("papervault")]);
    const webStream = nodeStreamToWebStream(nodeStream);
    const reader = webStream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const text = new TextDecoder().decode(Buffer.concat(chunks));
    expect(text).toBe("hello papervault");
  });

  it("validates query, upload metadata, reject reason, and zip payloads", () => {
    expect(paperQuerySchema.safeParse({ year: "2", sem: "4", examType: "SUPPLY" }).success).toBe(true);
    expect(rejectPaperSchema.safeParse({ reason: "ok" }).success).toBe(false);
    expect(rejectPaperSchema.safeParse({ reason: "Blurry scan on page 2" }).success).toBe(true);
    expect(zipDownloadSchema.safeParse({ paperIds: [] }).success).toBe(false);

    const invalidSem = uploadMetadataSchema.safeParse({
      branchId: "11111111-1111-4111-8111-111111111111",
      regulationId: "22222222-2222-4222-8222-222222222222",
      yearOfStudy: 2,
      semester: 1, // wrong for Year 2
      subjectId: "33333333-3333-4333-8333-333333333333",
      examType: "SUPPLY",
      examMonth: 11,
      examYear: 2024,
    });
    expect(invalidSem.success).toBe(false);

    const parsedApprove = approvePaperSchema.safeParse({
      subjectCode: " cs499 ",
      subjectName: " Distributed Systems ",
    });
    expect(parsedApprove.success).toBe(true);
    if (parsedApprove.success) {
      expect(parsedApprove.data.subjectCode).toBe("CS499");
      expect(parsedApprove.data.subjectName).toBe("Distributed Systems");
    }
    expect(approvePaperSchema.safeParse({ subjectName: "A" }).success).toBe(false);

    const parsedSubjectEdit = updateSubjectSchema.safeParse({
      id: "33333333-3333-4333-8333-333333333333",
      code: "cs401",
      name: "Database Management Systems II",
    });
    expect(parsedSubjectEdit.success).toBe(true);
    if (parsedSubjectEdit.success) {
      expect(parsedSubjectEdit.data.code).toBe("CS401");
    }
    expect(
      updateSubjectSchema.safeParse({
        id: "33333333-3333-4333-8333-333333333333",
        name: "X",
      }).success
    ).toBe(false);
  });

  it("checks same-origin including forwarded host headers", () => {
    const same = new NextRequest("http://localhost:3000/api/v1/auth/logout", {
      method: "POST",
      headers: { host: "localhost:3000", origin: "http://localhost:3000" },
    });
    const forwarded = new NextRequest("http://internal:3000/api/v1/auth/logout", {
      method: "POST",
      headers: {
        host: "internal:3000",
        "x-forwarded-host": "papervault.vercel.app, proxy.internal",
        origin: "https://papervault.vercel.app",
      },
    });
    const cross = new NextRequest("http://localhost:3000/api/v1/auth/logout", {
      method: "POST",
      headers: { host: "localhost:3000", origin: "https://evil.example" },
    });
    expect(verifySameOrigin(same)).toBe(true);
    expect(verifySameOrigin(forwarded)).toBe(true);
    expect(verifySameOrigin(cross)).toBe(false);
  });

  it("safely parses JSON API envelopes and falls back cleanly on non-JSON 500 responses", async () => {
    const okRes = new Response(
      JSON.stringify({ success: true, data: { token: "ok" }, meta: { total: 1 } }),
      { status: 200 }
    );
    const parsedOk = await safeReadApiJson<{ token: string }>(okRes, "Failed");
    expect(parsedOk).toEqual({
      ok: true,
      data: { token: "ok" },
      meta: { total: 1 },
      errorMessage: "",
    });

    const apiErrRes = new Response(
      JSON.stringify({
        success: false,
        data: null,
        error: { code: "BAD", message: "SESSION_SECRET missing" },
      }),
      { status: 500 }
    );
    const parsedErr = await safeReadApiJson(apiErrRes, "Fallback");
    expect(parsedErr).toEqual({
      ok: false,
      data: null,
      errorMessage: "SESSION_SECRET missing",
    });

    const htmlErrRes = new Response("Internal Server Error", { status: 500 });
    const parsedHtml = await safeReadApiJson(htmlErrRes, "Sign-in failed");
    expect(parsedHtml.ok).toBe(false);
    expect(parsedHtml.errorMessage).toContain("HTTP 500");
  });

  it("hides /admin behind optional ADMIN_PORTAL_KEY when configured", () => {
    const prevKey = process.env.ADMIN_PORTAL_KEY;
    process.env.ADMIN_PORTAL_KEY = "exam-cell-secret-key";
    try {
      const blocked = proxy(
        new NextRequest("https://example.vercel.app/admin/login")
      );
      expect(blocked.headers.get("x-middleware-rewrite")).toContain("/404");

      const unlock = proxy(
        new NextRequest(
          "https://example.vercel.app/admin/login?key=exam-cell-secret-key"
        )
      );
      expect(unlock.status).toBe(307);
      expect(unlock.headers.get("location")).toBe(
        "https://example.vercel.app/admin/login"
      );
      const setCookie = unlock.headers.get("set-cookie") ?? "";
      expect(setCookie).toContain("pv_admin_gate=");
      expect(setCookie).toContain("HttpOnly");
    } finally {
      if (prevKey === undefined) delete process.env.ADMIN_PORTAL_KEY;
      else process.env.ADMIN_PORTAL_KEY = prevKey;
    }
  });
});

describe("uploadFormWithProgress", () => {
  it("reports upload progress and resolves ParsedApiResult on success", async () => {
    const { uploadFormWithProgress } = await import("@/lib/httpClient");
    const prevXhr = globalThis.XMLHttpRequest;

    class MockXhr {
      status = 200;
      responseText = JSON.stringify({
        success: true,
        data: { trackingCode: "PV-TEST99" },
      });
      upload = {
        onprogress: null as
          | ((e: { lengthComputable: boolean; loaded: number; total: number }) => void)
          | null,
      };
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onabort: (() => void) | null = null;
      open = vi.fn();
      send = vi.fn(() => {
        this.upload.onprogress?.({
          lengthComputable: true,
          loaded: 50,
          total: 100,
        });
        this.upload.onprogress?.({
          lengthComputable: true,
          loaded: 100,
          total: 100,
        });
        this.onload?.();
      });
    }

    vi.stubGlobal("XMLHttpRequest", MockXhr);
    try {
      const seen: number[] = [];
      const form = new FormData();
      form.append("test", "1");
      const result = await uploadFormWithProgress<{ trackingCode: string }>(
        "/api/submissions",
        form,
        "Upload failed",
        (pct) => seen.push(pct)
      );
      expect(seen).toEqual([50, 100]);
      expect(result.ok).toBe(true);
      expect(result.data?.trackingCode).toBe("PV-TEST99");
    } finally {
      vi.stubGlobal("XMLHttpRequest", prevXhr);
    }
  });

  it("handles server JSON errors, non-JSON 500 pages, network failures, and aborts", async () => {
    const { uploadFormWithProgress } = await import("@/lib/httpClient");
    const prevXhr = globalThis.XMLHttpRequest;

    let scenario: "api_error" | "html_500" | "network" | "abort" = "api_error";
    class ErrorXhr {
      status = 400;
      responseText = "";
      upload = { onprogress: null };
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onabort: (() => void) | null = null;
      open = vi.fn();
      send = vi.fn(() => {
        if (scenario === "api_error") {
          this.status = 422;
          this.responseText = JSON.stringify({
            success: false,
            error: { message: "PDF rejected by validator" },
          });
          this.onload?.();
        } else if (scenario === "html_500") {
          this.status = 500;
          this.responseText = "<html>Bad Gateway</html>";
          this.onload?.();
        } else if (scenario === "abort") {
          this.onabort?.();
        } else {
          this.onerror?.();
        }
      });
    }

    vi.stubGlobal("XMLHttpRequest", ErrorXhr);
    try {
      const form = new FormData();
      scenario = "api_error";
      const apiErr = await uploadFormWithProgress("/api/submissions", form, "Fallback");
      expect(apiErr.ok).toBe(false);
      expect(apiErr.errorMessage).toBe("PDF rejected by validator");

      scenario = "html_500";
      const htmlErr = await uploadFormWithProgress("/api/submissions", form, "Fallback");
      expect(htmlErr.ok).toBe(false);
      expect(htmlErr.errorMessage).toMatch(/Fallback.*HTTP 500/);

      scenario = "network";
      await expect(
        uploadFormWithProgress("/api/submissions", form, "Fallback")
      ).rejects.toThrow(/Network error/i);

      scenario = "abort";
      await expect(
        uploadFormWithProgress("/api/submissions", form, "Fallback")
      ).rejects.toThrow(/cancelled/i);
    } finally {
      vi.stubGlobal("XMLHttpRequest", prevXhr);
    }
  });
});
