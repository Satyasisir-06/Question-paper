import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";

function getLocalAdminCredentials(): { email: string; password: string } {
  let email = process.env.ADMIN_SEED_EMAIL?.trim() || "";
  let password = process.env.ADMIN_SEED_PASSWORD?.trim() || "";

  if ((!email || !password) && fs.existsSync(path.resolve(".env"))) {
    const rawEnv = fs.readFileSync(path.resolve(".env"), "utf8");
    for (const line of rawEnv.split(/\r?\n/)) {
      const m = line.match(/^(ADMIN_SEED_EMAIL|ADMIN_SEED_PASSWORD)\s*=\s*"?(.*?)"?\s*$/);
      if (!m) continue;
      if (m[1] === "ADMIN_SEED_EMAIL" && !email) email = m[2].trim();
      if (m[1] === "ADMIN_SEED_PASSWORD" && !password) password = m[2].trim();
    }
  }

  return {
    email: email || "admin@college.edu",
    password: password || "Admin@12345",
  };
}

async function createSamplePdfBuffer(label: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  page.drawText(`B.TECH TEST QUESTION PAPER - ${label}`, {
    x: 60,
    y: 760,
    size: 14,
  });
  const bytes = await doc.save();
  return Buffer.from(bytes);
}

test.describe("B.Tech PaperVault E2E journeys", () => {
  test("student filters Year/Sem + Supply, previews PDF canvas on desktop and 390px mobile, and downloads ZIP", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "B.Tech question paper archive" })
    ).toBeVisible();

    // Filter 2-2 + Supply
    await page.getByRole("button", { name: "2-2", exact: true }).click();
    await page.getByRole("button", { name: "Supply", exact: true }).click();

    await expect(page.getByText("B.Tech / Year 2 (Sem 4) / Supply")).toBeVisible();
    await expect(page.getByText("CS401").first()).toBeVisible();

    // Preview PDF via custom pdfjs-dist canvas viewer
    await page.getByRole("button", { name: "Preview" }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.locator("[role='dialog'] canvas").first()).toBeVisible();
    await expect(page.locator("[role='dialog']").getByText(/Page 1 \/ \d+/).first()).toBeVisible();
    await page.getByRole("button", { name: "Close preview" }).click();

    // Switch to Folder Tree view
    await page.getByRole("button", { name: "Folders" }).click();
    await expect(page.getByText("Year 2")).toBeVisible();
    await page.getByRole("button", { name: "List" }).click();

    // Download filtered folder ZIP
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download folder (ZIP)" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain(".zip");

    // Verify 390px mobile responsive layout, mobile nav menu, and mobile PDF viewer
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1
    );
    expect(hasHorizontalOverflow).toBe(false);

    // Mobile menu opens and exposes Track / Admin links
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("link", { name: "Track upload status" })).toBeVisible();
    await page.getByRole("button", { name: "Close menu" }).click();

    // Mobile PDF modal renders canvas cleanly without overflow
    await page.getByRole("button", { name: "Preview" }).first().click();
    await expect(page.locator("[role='dialog'] canvas").first()).toBeVisible();
    const modalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1
    );
    expect(modalOverflow).toBe(false);
    await page.getByRole("button", { name: "Close preview" }).click();
  });

  test("student upload stays hidden until admin previews & approves, then becomes public", async ({
    page,
    request,
  }) => {
    const unauthRes = await request.get("/api/v1/admin/papers");
    expect(unauthRes.status()).toBe(401);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/upload");
    await expect(page.locator('form[data-upload-ready="true"]')).toBeVisible();

    const uniqueSet = `Set-E2E-${Date.now().toString().slice(-5)}`;
    const pdfBuffer = await createSamplePdfBuffer(uniqueSet);

    await page.locator('input[type="file"]').setInputFiles({
      name: "e2e_test_paper.pdf",
      mimeType: "application/pdf",
      buffer: pdfBuffer,
    });

    await expect(page.getByText("1 pages verified")).toBeVisible();

    await page.locator("#up-year").selectOption("2");
    await page.locator("#up-sem").selectOption("4");

    const cseOption = await page
      .locator("#up-branch option", { hasText: "CSE — Computer Science" })
      .first()
      .getAttribute("value");
    if (cseOption) {
      await page.locator("#up-branch").selectOption(cseOption);
    }

    const firstSubjectValue = await page
      .locator("#up-subject option")
      .nth(1)
      .getAttribute("value");
    if (firstSubjectValue) {
      await page.locator("#up-subject").selectOption(firstSubjectValue);
    }

    await page.getByRole("button", { name: "Supply", exact: true }).click();
    await page.locator("#up-set").fill(uniqueSet);
    await page.locator("#up-name").fill("E2E Student");

    await page.getByRole("button", { name: "Submit for approval" }).click();

    await expect(
      page.getByRole("heading", { name: "Question paper submitted for review" })
    ).toBeVisible();
    const trackingCode = (
      await page.locator("text=/PV-[A-F0-9]+/").first().textContent()
    )?.trim();
    expect(trackingCode).toMatch(/^PV-[A-F0-9]+$/);

    await page.goto(`/track?code=${encodeURIComponent(trackingCode!)}`);
    await expect(page.getByText("Pending review")).toBeVisible();

    const preSearch = await request.get(
      `/api/v1/papers?q=${encodeURIComponent(uniqueSet)}`
    );
    const preJson = await preSearch.json();
    expect(preJson.data).toHaveLength(0);

    const adminCreds = getLocalAdminCredentials();
    await page.goto("/admin/login");
    await page.locator("#admin-email").fill(adminCreds.email);
    await page.locator("#admin-password").fill(adminCreds.password);
    await page.getByRole("button", { name: "Sign in to admin console" }).click();

    await page.waitForURL("**/admin/queue");
    const queueBtn = page.getByRole("button", { name: new RegExp(trackingCode!) });
    await expect(queueBtn).toBeVisible();
    await queueBtn.click();
    await expect(page.locator("canvas").first()).toBeVisible();

    await page.getByRole("button", { name: "Approve and publish" }).click();
    await expect(
      page.getByText(`Paper ${trackingCode!} approved and published`)
    ).toBeVisible();

    await page.goto(`/track?code=${encodeURIComponent(trackingCode!)}`);
    await expect(page.getByText("Published", { exact: true })).toBeVisible();

    await page.goto("/");
    await page
      .getByRole("searchbox", { name: "Search subject code or name" })
      .fill(uniqueSet);
    await expect(page.getByText(uniqueSet).first()).toBeVisible();
  });

  test("displays all 8 college branches and auto-scans PDF & photo uploads for subject code and name", async ({
    page,
    request,
  }) => {
    const healthRes = await request.get("/api/v1/health");
    expect(healthRes.status()).toBe(200);
    const healthJson = await healthRes.json();
    expect(healthJson.ok).toBe(true);
    expect(healthJson.dbConnected).toBe(true);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    for (const branchCode of ["CAI", "CSM", "CSD", "EEE", "ECE", "CIVI", "MECH", "CSE"]) {
      await expect(page.locator("aside").getByText(branchCode, { exact: true }).first()).toBeVisible();
    }

    await page.goto("/upload");
    await expect(page.locator('form[data-upload-ready="true"]')).toBeVisible();

    // 1. Upload a digital PDF containing university exam headers and verify auto-fill
    const doc = await PDFDocument.create();
    const pdfPage = doc.addPage([595, 842]);
    pdfPage.drawText("III B.Tech I Semester Supplementary Examinations, December - 2024", {
      x: 50,
      y: 770,
      size: 12,
    });
    pdfPage.drawText("Branch: CSE (Data Science)   Regulation: R22", {
      x: 50,
      y: 745,
      size: 12,
    });
    pdfPage.drawText("Code No: 22DS509", { x: 50, y: 720, size: 12 });
    pdfPage.drawText("Subject Name: Deep Learning Foundations", {
      x: 50,
      y: 695,
      size: 12,
    });
    const scanPdfBuffer = Buffer.from(await doc.save());

    await page.locator('input[type="file"]').setInputFiles({
      name: "csd_scan_paper.pdf",
      mimeType: "application/pdf",
      buffer: scanPdfBuffer,
    });

    await expect(page.getByText(/Auto-filled via PDF text scan/)).toBeVisible();
    await expect(page.getByPlaceholder("Code (e.g. CS405)")).toHaveValue("22DS509");
    await expect(page.getByPlaceholder("Full subject name")).toHaveValue(
      "Deep Learning Foundations"
    );
    await expect(page.locator("#up-year")).toHaveValue("3");
    await expect(page.locator("#up-sem")).toHaveValue("5");

    // 2. Render a crisp PNG photo of a printed question paper and upload via photo-to-PDF + offline OCR
    const pngBase64 = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 1100;
      canvas.height = 650;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#111111";
      ctx.font = "bold 32px Arial, sans-serif";
      ctx.fillText("II B.Tech I Sem Regular Examination, May 2024", 60, 100);
      ctx.fillText("Branch: CAI", 60, 170);
      ctx.fillText("Course Code: CA305", 60, 240);
      ctx.fillText("Subject Name: Computer Vision", 60, 310);
      ctx.font = "26px Arial, sans-serif";
      ctx.fillText("Time: 3 Hours   Max Marks: 70", 60, 380);
      return canvas.toDataURL("image/png").split(",")[1];
    });
    const pngBuffer = Buffer.from(pngBase64, "base64");

    await page.locator('input[type="file"]').setInputFiles({
      name: "paper_photo_page1.png",
      mimeType: "image/png",
      buffer: pngBuffer,
    });

    await expect(page.getByText("1 pages verified")).toBeVisible();
    await expect(page.getByText(/Auto-filled via Photo OCR/)).toBeVisible({
      timeout: 25000,
    });
    await expect(page.getByPlaceholder("Code (e.g. CS405)")).toHaveValue(/CA305/i);
    await expect(page.getByPlaceholder("Full subject name")).toHaveValue(
      /Computer Vision/i
    );
  });
});
