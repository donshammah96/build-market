// ***********************************************************
// This file runs before every E2E test file.
// It's a great place to put global configuration and behavior.
// https://on.cypress.io/configuration
// ***********************************************************

import "./commands";
import "./staging-test-control";

// Prevent uncaught exceptions from failing tests
Cypress.on("uncaught:exception", (err, runnable) => {
  // Returning false prevents Cypress from failing the test
  // Ignore hydration errors (including React 18/19 minified codes) and Next.js specific errors
  const msg = err?.message || "";
  if (
    msg.includes("Hydration") ||
    msg.includes("hydration") ||
    msg.includes("Minified React error #418") ||
    msg.includes("Minified React error #422") ||
    msg.includes("Minified React error #423") ||
    msg.includes("Minified React error #425") ||
    msg.includes("NEXT_NOT_FOUND") ||
    msg.includes("ResizeObserver")
  ) {
    return false;
  }
  // Log unexpected client-side exception with context before failing (S-7)
  // Note: cy.* commands (e.g. cy.task) cannot be invoked inside uncaught:exception listeners
  const testTitle = runnable?.title || "unknown test";
  Cypress.log({
    name: "uncaught exception",
    message: `[CYPRESS UNCAUGHT EXCEPTION in "${testTitle}"]: ${msg}`,
  });
  console.error(
    `[CYPRESS UNCAUGHT EXCEPTION in "${testTitle}"]: ${msg}\n${err?.stack || ""}`,
  );
  return true;
});

// Log test name before each test
beforeEach(() => {
  cy.task("log", `Running: ${Cypress.currentTest.title}`);
});

// Clear cookies and local storage between tests
beforeEach(() => {
  cy.clearCookies();
  cy.clearLocalStorage();
});

// Ensure cy.request:
// 1. Clamps __client_uat to <= __session token iat so Clerk backend never rejects with session-token-iat-before-client-uat
// 2. Always carries a trusted Origin header on mutations (POST/PUT/PATCH/DELETE) to satisfy withAuth CSRF validation
Cypress.Commands.overwrite("request", (originalFn, ...args) => {
  const baseUrl =
    Cypress.config("baseUrl") || "https://staging.buildmarket.app";
  let origin = baseUrl;
  try {
    origin = new URL(baseUrl).origin;
  } catch {}

  return cy.getCookies({ log: false }).then((cookies) => {
    const sessionCookie = cookies.find((c) => c.name.startsWith("__session"));
    let iatStr: string | null = null;
    if (sessionCookie?.value) {
      try {
        const parts = sessionCookie.value.split(".");
        const payloadPart = parts[1];
        if (parts.length >= 2 && payloadPart) {
          const raw =
            typeof atob !== "undefined"
              ? atob(payloadPart)
              : Buffer.from(payloadPart, "base64").toString("utf8");
          const payload = JSON.parse(raw);
          if (typeof payload.iat === "number") {
            iatStr = String(payload.iat);
          }
        }
      } catch {}
    }

    if (iatStr) {
      cookies
        .filter((c) => c.name.startsWith("__client_uat"))
        .forEach((uatCookie) => {
          if (Number(uatCookie.value) > Number(iatStr)) {
            cy.setCookie(uatCookie.name, iatStr!, {
              domain: uatCookie.domain,
              path: uatCookie.path,
              secure: uatCookie.secure,
              log: false,
            });
          }
        });
    }

    let options: any;
    if (typeof args[0] === "string") {
      options = { url: args[0] };
    } else if (args[0] && typeof args[0] === "object") {
      options = { ...args[0] };
    } else {
      options = {};
    }

    const method = (options.method || "GET").toUpperCase();
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      options.headers = {
        Origin: origin,
        ...options.headers,
      };
    }

    return originalFn(options);
  });
});
