"use client";

import { useEffect } from "react";
import { extractErrorDigest, formatUiServerError } from "@/lib/env";

const FALLBACK_GLOBAL_MESSAGE =
  "The server encountered a configuration or connection error while rendering this page. Verify DATABASE_URL, STORAGE_PROVIDER, and S3 credentials in Vercel Environment Variables.";

export default function GlobalError({
  error,
  retry,
  reset,
}: {
  error: unknown;
  retry?: () => void;
  reset?: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  const digest = extractErrorDigest(error);
  const safeMessage = formatUiServerError(error, FALLBACK_GLOBAL_MESSAGE);

  const handleRecover = () => {
    if (typeof retry === "function") {
      retry();
    } else if (typeof reset === "function") {
      reset();
    } else {
      window.location.reload();
    }
  };

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          fontFamily: "system-ui, -apple-system, sans-serif",
          backgroundColor: "#fafafa",
          color: "#171717",
        }}
      >
        <div
          style={{
            maxWidth: "460px",
            width: "100%",
            backgroundColor: "#ffffff",
            border: "1px solid rgba(23, 23, 23, 0.12)",
            borderRadius: "16px",
            padding: "24px",
            textAlign: "center",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.06)",
          }}
        >
          <h1 style={{ fontSize: "1.25rem", margin: "0 0 8px 0" }}>
            Unable to load B.Tech PaperVault
          </h1>
          <p
            style={{
              fontSize: "0.9375rem",
              lineHeight: 1.5,
              color: "#525252",
              margin: "0 0 16px 0",
            }}
          >
            {safeMessage}
          </p>
          {digest && (
            <p
              style={{
                fontSize: "0.75rem",
                fontFamily: "monospace",
                color: "#737373",
                margin: "0 0 16px 0",
              }}
            >
              Error digest: {digest}
            </p>
          )}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              justifyContent: "center",
            }}
          >
            <button
              type="button"
              onClick={handleRecover}
              style={{
                height: "36px",
                padding: "0 16px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: "#2563EB",
                color: "#ffffff",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <a
              href="/api/v1/health"
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: "36px",
                padding: "0 14px",
                borderRadius: "8px",
                border: "1px solid rgba(23, 23, 23, 0.14)",
                backgroundColor: "#f4f4f5",
                color: "#171717",
                textDecoration: "none",
                fontSize: "0.875rem",
                fontWeight: 500,
              }}
            >
              Check /api/v1/health
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
