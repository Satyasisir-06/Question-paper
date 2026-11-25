import { describe, expect, it } from "vitest";
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
  paperQuerySchema,
  rejectPaperSchema,
  uploadMetadataSchema,
  zipDownloadSchema,
} from "@/server/validators/schemas";
import { verifySameOrigin } from "@/server/auth/guards";

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
  });

  it("checks same-origin for CSRF protection", () => {
    const same = new NextRequest("http://localhost:3000/api/v1/auth/logout", {
      method: "POST",
      headers: { host: "localhost:3000", origin: "http://localhost:3000" },
    });
    const cross = new NextRequest("http://localhost:3000/api/v1/auth/logout", {
      method: "POST",
      headers: { host: "localhost:3000", origin: "https://evil.example" },
    });
    expect(verifySameOrigin(same)).toBe(true);
    expect(verifySameOrigin(cross)).toBe(false);
  });
});
