# B.Tech PaperVault

Archive, filter, preview, download, and moderate college B.Tech question papers organized by **Year & Semester (`1-1` .. `4-2`)**, **Branch** (`CAI`, `CSM`, `CSD`, `CSE`, `ECE`, `EEE`, `MECH`, `CIVI`, `COMMON`), **Regulation**, and **Exam Category** (`Regular`, `Supply`, `Midterm 1`, `Midterm 2`).

## Key Features
- **Student Archive (`/`)**: Year & Sem matrix, Regular/Supply quick tabs, Branch/Regulation/Year filters, Folder Tree view (`Year -> Sem -> Branch -> Exam Type`), single PDF preview (`pdfjs-dist`), and batch ZIP folder downloads (`/api/v1/papers/download-zip`).
- **Mobile-First Upload + Photo-to-PDF + Offline Scan (`/upload`)**:
  - Upload a PDF or up to 12 camera/gallery photos (auto-converted into an A4 PDF up to **4 MB**).
  - Offline in-browser scanning extracts Subject Code, Subject Name, Branch, Regulation, Year/Sem, Exam Type, and Exam Session using PDF text extraction (`pdfjs-dist`) and local WASM OCR (`tesseract.js` assets in `public/tesseract/`).
- **Moderation Pipeline (`/admin/queue`, `/admin/catalog`, `/track`)**:
  - Public uploads go strictly to private `quarantine/` storage (`PENDING`) until an admin inspects the PDF, adjusts metadata, and approves (`APPROVED` -> `published/`) or rejects with a reason.

## Local Development

```powershell
Copy-Item .env.example .env
npm install
npm run db:seed
npm run dev
```

Default seeded local admin: `admin@college.edu` / password from `.env` (or `Admin@12345`).

## Deploying on Vercel + PostgreSQL + R2/S3

1. Push the repository to GitHub and import it into Vercel (Node.js 20.x/22.x).
2. Provision a managed PostgreSQL database (**Neon** or **Supabase**) and an **S3-compatible private bucket** (**Cloudflare R2** or AWS S3).
3. Configure these Environment Variables in **Vercel -> Settings -> Environment Variables**:
   - `DATABASE_URL` — PostgreSQL connection string (`postgresql://...?sslmode=require`)
   - `STORAGE_PROVIDER` — `s3`
   - `S3_BUCKET`, `S3_REGION` (`auto` for R2), `S3_ENDPOINT` (R2 S3 endpoint), `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
   - `SESSION_SECRET` — random string, minimum 32 characters
   - `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD`, `ADMIN_SEED_NAME` — creates your initial admin account automatically on first boot (or run `npm run db:seed` once against your cloud env vars to include sample papers).
4. Upload cap is configured to **4 MB** (`MAX_PDF_BYTES = 4 * 1024 * 1024`) to fit within Vercel Serverless Function request limits.

## Verification Scripts

```powershell
npx tsc --noEmit
npm run lint
npm run test:coverage
npm run build
npm run test:e2e
```
