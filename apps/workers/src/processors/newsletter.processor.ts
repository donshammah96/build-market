import { prisma } from "@build/db";
import { StructuredLogger, CorrelationIdManager } from "@build/resilience";
import { sendEmail } from "@build/mail-server";
import type { Job } from "bullmq";
import type {
  NewsletterConfirmationEmailJobData,
  NewsletterEspSyncJobData,
} from "@build/queue-server";
import { validateWorkerEnv } from "../env.js";

const logger = new StructuredLogger("worker-newsletter-processor");

export interface NewsletterJobResult {
  status: "success" | "skipped" | "action_adjusted" | "dead_letter" | "failed";
  subscriberId: string;
  action?: string;
  provider?: string;
  error?: string;
}

/**
 * Sends double opt-in confirmation email to newly subscribed users.
 */
export async function processConfirmationEmailJob(
  job: Job<NewsletterConfirmationEmailJobData>,
): Promise<NewsletterJobResult> {
  const { subscriberId, email, confirmationToken, unsubscribeToken } = job.data;
  const correlationId = CorrelationIdManager.generate();
  CorrelationIdManager.set(correlationId);
  const env = validateWorkerEnv();

  logger.info("[NewsletterProcessor] Sending confirmation email", {
    correlationId,
    subscriberId,
    jobId: job.id,
  });

  const baseUrl = process.env.APP_URL || "https://buildmarket.co.ke";
  const confirmUrl = `${baseUrl}/newsletter/confirm?token=${encodeURIComponent(confirmationToken)}`;
  const unsubscribeUrl = `${baseUrl}/newsletter/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; max-width: 600px; margin: 0 auto; color: #334155;">
      <h2 style="color: #0f172a;">Confirm your subscription to BuildMarket</h2>
      <p>Thank you for subscribing to updates and insights from BuildMarket.</p>
      <p style="margin: 24px 0;">
        <a href="${confirmUrl}" style="background-color: #0f172a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Confirm Subscription</a>
      </p>
      <p style="font-size: 13px; color: #64748b;">
        If you did not request this, you can safely ignore this email or <a href="${unsubscribeUrl}" style="color: #64748b;">unsubscribe</a>.
      </p>
    </div>
  `;

  try {
    if (env.RESEND_API_KEY) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Build Market <updates@mail.buildmarket.app>",
          to: email,
          subject: "Confirm your Build Market newsletter subscription",
          html,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        throw new Error(`Resend API error (${res.status}): ${errorText}`);
      }
    } else {
      await sendEmail({
        to: email,
        subject: "Confirm your Build Market newsletter subscription",
        html,
      });
    }

    await prisma.newsletterSubscriber.update({
      where: { id: subscriberId },
      data: {
        confirmationEmailStatus: "SENT",
        lastConfirmationSentAt: new Date(),
        confirmationEmailLastError: null,
      },
    });

    logger.info("[NewsletterProcessor] Confirmation email sent successfully", {
      correlationId,
      subscriberId,
    });

    return { status: "success", subscriberId };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error(
      "[NewsletterProcessor] Failed to send confirmation email",
      err instanceof Error ? err : new Error(errorMsg),
      {
        correlationId,
        subscriberId,
      },
    );

    try {
      await prisma.newsletterSubscriber.update({
        where: { id: subscriberId },
        data: {
          confirmationEmailStatus: "FAILED",
          confirmationEmailLastError: errorMsg,
        },
      });
    } catch {
      // Non-fatal if DB status update fails
    }

    throw err;
  }
}

/**
 * Synchronizes confirmed subscriber status to external ESP (Resend / Mailchimp).
 */
export async function processEspSyncJob(
  job: Job<NewsletterEspSyncJobData>,
): Promise<NewsletterJobResult> {
  const { subscriberId, action } = job.data;
  const correlationId = CorrelationIdManager.generate();
  CorrelationIdManager.set(correlationId);
  const env = validateWorkerEnv();

  logger.info("[NewsletterProcessor] Syncing subscriber to ESP", {
    correlationId,
    subscriberId,
    action,
    jobId: job.id,
  });

  const subscriber = await prisma.newsletterSubscriber.findUnique({
    where: { id: subscriberId },
  });

  if (!subscriber) {
    logger.warn(
      "[NewsletterProcessor] Subscriber not found (possibly deleted)",
      {
        correlationId,
        subscriberId,
      },
    );
    return { status: "skipped", subscriberId };
  }

  let effectiveAction: "subscribe" | "unsubscribe";
  if (subscriber.status === "SUBSCRIBED") {
    effectiveAction = "subscribe";
  } else if (subscriber.status === "UNSUBSCRIBED") {
    effectiveAction = "unsubscribe";
  } else {
    logger.info(
      "[NewsletterProcessor] Subscriber status does not permit ESP sync",
      {
        correlationId,
        subscriberId,
        status: subscriber.status,
      },
    );
    return { status: "skipped", subscriberId };
  }

  try {
    let espContactId: string | undefined;

    if (env.RESEND_API_KEY) {
      const res = await fetch("https://api.resend.com/audiences", {
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
        },
      });

      if (res.ok) {
        const data = (await res.json()) as { data?: Array<{ id: string }> };
        const audienceId = data.data?.[0]?.id;

        if (audienceId) {
          if (effectiveAction === "subscribe") {
            const createRes = await fetch(
              `https://api.resend.com/audiences/${audienceId}/contacts`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${env.RESEND_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  email: subscriber.email,
                  unsubscribed: false,
                }),
              },
            );
            if (createRes.ok) {
              const contactData = (await createRes.json()) as { id?: string };
              espContactId = contactData.id;
            }
          } else {
            // Unsubscribe action
            await fetch(
              `https://api.resend.com/audiences/${audienceId}/contacts/${subscriber.email}`,
              {
                method: "PATCH",
                headers: {
                  Authorization: `Bearer ${env.RESEND_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ unsubscribed: true }),
              },
            );
          }
        }
      }
    }

    await prisma.newsletterSubscriber.update({
      where: { id: subscriberId },
      data: {
        espSyncStatus: "SYNCED",
        espLastSyncAt: new Date(),
        espContactId: espContactId ?? subscriber.espContactId,
        espProvider: "resend",
        espLastSyncError: null,
      },
    });

    logger.info("[NewsletterProcessor] ESP sync completed successfully", {
      correlationId,
      subscriberId,
      action: effectiveAction,
    });

    return {
      status: "success",
      subscriberId,
      action: effectiveAction,
      provider: "resend",
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const attempts = subscriber.espSyncAttempts + 1;
    const isExhausted = attempts >= 5;

    logger.error(
      "[NewsletterProcessor] ESP sync failed",
      err instanceof Error ? err : new Error(errorMsg),
      {
        correlationId,
        subscriberId,
        attempts,
        isExhausted,
      },
    );

    try {
      await prisma.newsletterSubscriber.update({
        where: { id: subscriberId },
        data: {
          espSyncStatus: isExhausted ? "DEAD_LETTER" : "FAILED",
          espSyncAttempts: attempts,
          espLastSyncError: errorMsg,
        },
      });
    } catch {
      // Non-fatal if DB status update fails
    }

    throw err;
  }
}
