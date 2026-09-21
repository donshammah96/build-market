/**
 * Outbound ESP integration for the newsletter domain.
 *
 * This file is intentionally only ever called from
 * lib/jobs/newsletter-esp-sync.worker.ts (a BullMQ processor), never from
 * an API route — see service.ts for why sync is decoupled from the
 * request path.
 *
 * Fixes vs. the previous inline implementation:
 *   - No more `any` for parsed response bodies.
 *   - No more string-sniffing an error message body to guess "already
 *     exists" — we do an explicit GET by email instead, which is what
 *     Resend's API is actually for.
 *   - Mailchimp misconfiguration now returns a real error instead of a
 *     fake "created" success.
 *   - The stub provider refuses to run in production instead of silently
 *     no-op'ing every signup if an env var is missing.
 */

import { createHash } from "crypto";
import { envConfig } from "@/app/lib/infrastructure/env";
import { ok, err } from "@/app/lib/errors/result";
import type {
  NewsletterResult,
  NewsletterEspSyncOutcome,
} from "@/app/lib/domains/newsletter/contracts";

type EspSyncAction = "subscribe" | "unsubscribe";

// ---------------------------------------------------------------------------
// Resend
// ---------------------------------------------------------------------------

async function findResendContactIdByEmail(
  email: string,
  apiKey: string,
): Promise<string | null> {
  const res = await fetch(
    `https://api.resend.com/contacts/${encodeURIComponent(email)}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );
  if (!res.ok) return null;

  const body: unknown = await res.json().catch(() => null);
  if (
    body &&
    typeof body === "object" &&
    "id" in body &&
    typeof (body as { id: unknown }).id === "string"
  ) {
    return (body as { id: string }).id;
  }
  return null;
}

async function syncViaResend(
  email: string,
  action: EspSyncAction,
): Promise<NewsletterResult<NewsletterEspSyncOutcome>> {
  const { resendApiKey, resendSegmentId } = envConfig.newsletter;

  if (!resendApiKey || !resendSegmentId) {
    return err({
      error: "esp_misconfigured",
      message: "RESEND_API_KEY or RESEND_SEGMENT_ID is not configured",
      status: 500,
    });
  }

  if (action === "unsubscribe") {
    const contactId = await findResendContactIdByEmail(email, resendApiKey);
    if (!contactId) {
      // No contact on the ESP side to unsubscribe — treat as success;
      // our own DB is already the source of truth for suppression.
      return ok({ status: "SYNCED" });
    }

    const res = await fetch(`https://api.resend.com/contacts/${contactId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ unsubscribed: true }),
    });

    if (!res.ok) {
      return err({
        error: "provider_unavailable",
        message: `Resend unsubscribe update failed (${res.status})`,
        status: 502,
      });
    }
    return ok({ status: "SYNCED", espContactId: contactId });
  }

  // action === "subscribe"
  const createRes = await fetch("https://api.resend.com/contacts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, unsubscribed: false }),
  });

  let contactId: string | null = null;

  if (createRes.ok) {
    const body: unknown = await createRes.json().catch(() => null);
    if (
      body &&
      typeof body === "object" &&
      "id" in body &&
      typeof (body as { id: unknown }).id === "string"
    ) {
      contactId = (body as { id: string }).id;
    }
  } else if (createRes.status === 409 || createRes.status === 422) {
    // Contact may already exist — confirm via GET rather than parsing the
    // error body's message text, which is not a stable API contract.
    contactId = await findResendContactIdByEmail(email, resendApiKey);
  }

  if (!contactId) {
    return err({
      error: "provider_unavailable",
      message: `Resend contact create failed (${createRes.status})`,
      status: 502,
    });
  }

  const segmentRes = await fetch(
    `https://api.resend.com/contacts/${contactId}/segments/${resendSegmentId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
    },
  );

  // 409 = already in the segment; treat as success.
  if (!segmentRes.ok && segmentRes.status !== 409) {
    return err({
      error: "provider_unavailable",
      message: `Resend segment association failed (${segmentRes.status})`,
      status: 502,
    });
  }

  return ok({ status: "SYNCED", espContactId: contactId });
}

// ---------------------------------------------------------------------------
// Mailchimp
// ---------------------------------------------------------------------------

async function syncViaMailchimp(
  email: string,
  action: EspSyncAction,
): Promise<NewsletterResult<NewsletterEspSyncOutcome>> {
  const { apiKey, listId } = envConfig.newsletter;

  if (!apiKey || !listId) {
    // Previously this silently returned a fake "created" success — that
    // told callers a signup succeeded when nothing happened. Fail loudly
    // instead, matching the Resend branch.
    return err({
      error: "esp_misconfigured",
      message: "ESP_API_KEY or ESP_LIST_ID is not configured for Mailchimp",
      status: 500,
    });
  }

  const dc = apiKey.split("-").pop();
  if (!dc) {
    return err({
      error: "esp_misconfigured",
      message: "Mailchimp API key is missing its datacenter suffix",
      status: 500,
    });
  }

  const subscriberHash = createSubscriberHash(email);
  const res = await fetch(
    `https://${dc}.api.mailchimp.com/3.0/lists/${listId}/members/${subscriberHash}`,
    {
      method: "PUT", // upsert — works for both subscribe and unsubscribe
      headers: {
        Authorization: `Basic ${Buffer.from(`anystring:${apiKey}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email_address: email,
        status_if_new: "pending",
        status: action === "unsubscribe" ? "unsubscribed" : undefined,
      }),
    },
  );

  if (!res.ok) {
    return err({
      error: "provider_unavailable",
      message: `Mailchimp upsert failed (${res.status})`,
      status: 502,
    });
  }

  return ok({ status: "SYNCED" });
}

function createSubscriberHash(email: string): string {
  // Mailchimp's member ID is MD5(lowercased email) — required by their API.
  return createHash("md5").update(email.toLowerCase()).digest("hex");
}

// ---------------------------------------------------------------------------
// Stub
// ---------------------------------------------------------------------------

async function syncViaStub(): Promise<
  NewsletterResult<NewsletterEspSyncOutcome>
> {
  if (envConfig.isProd) {
    // A misconfigured production environment must not silently pretend
    // every signup succeeded — that's how a dead ESP integration goes
    // unnoticed for months. Fail loudly instead.
    return err({
      error: "esp_misconfigured",
      message: "Newsletter provider is unset (stub) in production",
      status: 500,
    });
  }
  console.info("[newsletter] Stub ESP sync: no-op (non-production)");
  return ok({ status: "SYNCED" });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function syncSubscriberToEsp(
  email: string,
  action: EspSyncAction,
): Promise<NewsletterResult<NewsletterEspSyncOutcome>> {
  const { provider } = envConfig.newsletter;

  switch (provider) {
    case "resend":
      return syncViaResend(email, action);
    case "mailchimp":
      return syncViaMailchimp(email, action);
    case "stub":
    default:
      return syncViaStub();
  }
}
