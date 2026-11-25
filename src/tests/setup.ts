import "@testing-library/jest-dom/vitest";

process.env.SESSION_SECRET =
  process.env.SESSION_SECRET ??
  "test-session-secret-that-is-longer-than-32-characters-12345";
