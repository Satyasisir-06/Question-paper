import type { NextConfig } from "next";

const isVercelBuild =
  process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV);

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "archiver"],
  ...(isVercelBuild
    ? {
        outputFileTracingExcludes: {
          "/*": [
            "./node_modules/@electric-sql/pglite/**/*",
            "./node_modules/@playwright/**/*",
            "./public/tesseract/**/*",
            "./public/pdf.worker.min.mjs",
            "./data/**/*",
            "./storage/**/*",
          ],
        },
      }
    : {}),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
