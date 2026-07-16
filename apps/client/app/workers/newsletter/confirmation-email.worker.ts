/**
 * Sends the double opt-in confirmation email. Separate from esp-sync: the
 * ESP contact/segment isn't created until confirmSubscription() runs, but
 * the *email carrying the confirmation link* has to go out immediately
 * after signup, via Resend's transactional Emails API (not the
 * Contacts/Segments API used for the marketing list).
 *
 * ASSUMPTION: `envConfig.app.url` is the app's public base URL
 * (e.g. https://buildmarket.app) — adjust to wherever that's actually
 * defined. If the app already has a shared transactional-email sender
 * (for order confirmations, verification emails, etc.), prefer wiring
 * this worker to that instead of calling Resend directly here, so there
 * is exactly one place that owns "from" address / footer / unsubscribe
 * boilerplate across the whole app.
 */
import { Worker, type Job } from "bullmq";
import { createRedisConnection } from "@build/queue-server";
import { envConfig } from "@/app/lib/infrastructure/env";
import type { NewsletterConfirmationEmailJobData } from "@/app/lib/domains/newsletter/contracts";
import { newsletterRepository } from "@/app/lib/domains/newsletter/repository";
import { StructuredLogger } from "@build/resilience";

const logger = new StructuredLogger("newsletter-confirmation-email");

export async function processConfirmationEmailJob(
  job: Job<NewsletterConfirmationEmailJobData>,
) {
  const { subscriberId, email, confirmationToken, unsubscribeToken } = job.data;
  const { resendApiKey } = envConfig.newsletter;
  const baseUrl = envConfig.appUrl;

  logger.info("Sending transactional confirmation email", {
    operationName: "send_confirmation_email",
    outcome: "processing",
    subscriberId,
    jobId: job.id,
  });

  if (!resendApiKey) {
    const err = new Error("RESEND_API_KEY is not configured");
    logger.error("Failed to send transactional confirmation email", err, {
      operationName: "send_confirmation_email",
      outcome: "failure",
      subscriberId,
      jobId: job.id,
    });
    await newsletterRepository.updateConfirmationEmailFailure(
      subscriberId,
      err.message,
    );
    throw err;
  }

  const confirmUrl = new URL("/api/newsletter/confirm", baseUrl);
  confirmUrl.searchParams.set("token", confirmationToken);

  const unsubscribeUrl = new URL("/api/newsletter/unsubscribe", baseUrl);
  unsubscribeUrl.searchParams.set("token", unsubscribeToken);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Build Market <updates@mail.buildmarket.app>",
        to: email,
        subject: "Confirm your Build Market newsletter subscription",
        html: renderConfirmationEmail(
          confirmUrl.toString(),
          unsubscribeUrl.toString(),
        ),
        // RFC 8058 one-click unsubscribe header — most mail clients surface
        // this as a native "Unsubscribe" button next to the sender.
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl.toString()}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      const err = new Error(
        `Resend email send failed (${res.status}): ${errBody}`,
      );
      logger.error("Failed to send transactional confirmation email", err, {
        operationName: "send_confirmation_email",
        outcome: "failure",
        subscriberId,
        jobId: job.id,
      });
      await newsletterRepository.updateConfirmationEmailFailure(
        subscriberId,
        err.message,
      );
      throw err;
    }

    logger.info("Transactional confirmation email sent successfully", {
      operationName: "send_confirmation_email",
      outcome: "success",
      subscriberId,
      jobId: job.id,
    });

    await newsletterRepository.updateConfirmationEmailSuccess(subscriberId);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error(
      "Error during confirmation email dispatch",
      err instanceof Error ? err : new Error(errorMsg),
      {
        operationName: "send_confirmation_email",
        outcome: "error",
        subscriberId,
        jobId: job.id,
      },
    );
    await newsletterRepository.updateConfirmationEmailFailure(
      subscriberId,
      errorMsg,
    );
    throw err;
  }
}

function renderConfirmationEmail(
  confirmUrl: string,
  unsubscribeUrl: string,
): string {
  return `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Confirm your subscription</title>
  <style type="text/css">
    body {
      margin: 0;
      padding: 0;
      width: 100% !important;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
      background-color: #f9fafb;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    img {
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }
    table {
      border-collapse: collapse !important;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #f9fafb;
      padding: 40px 0;
    }
    .content {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      overflow: hidden;
    }
    .header {
      padding: 32px 40px;
      background-color: #0f172a;
      text-align: center;
    }
    .body {
      padding: 40px;
      color: #334155;
      font-size: 16px;
      line-height: 1.6;
    }
    .button-container {
      margin: 32px 0;
      text-align: center;
    }
    .button {
      display: inline-block;
      padding: 14px 28px;
      background-color: #0f172a;
      color: #ffffff !important;
      font-weight: 600;
      text-decoration: none;
      border-radius: 8px;
      font-size: 16px;
    }
    .footer {
      padding: 32px 40px;
      background-color: #f8fafc;
      border-top: 1px solid #f1f5f9;
      color: #64748b;
      font-size: 12px;
      line-height: 1.5;
      text-align: center;
    }
    .footer a {
      color: #64748b;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td align="center">
          <table class="content" width="100%" cellspacing="0" cellpadding="0" border="0">
            <!-- Header -->
            <tr>
              <td class="header">
                <span style="color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.025em;">BUILD MARKET</span>
              </td>
            </tr>
            <!-- Body -->
            <tr>
              <td class="body">
                <h1 style="margin: 0 0 16px; color: #0f172a; font-size: 20px; font-weight: 700; line-height: 1.3;">Confirm your subscription</h1>
                <p style="margin: 0 0 24px;">Confirm your email address to complete your subscription and start receiving newsletter updates from Build Market.</p>
                <div class="button-container">
                  <!--[if mso]>
                  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:vml" href="${confirmUrl}" style="height:48px;v-text-anchor:middle;width:200px;" arcsize="17%" stroke="f" fillcolor="#0f172a">
                    <w:anchorlock/>
                    <center style="color:#ffffff;font-family:sans-serif;font-size:16px;font-weight:bold;">Confirm subscription</center>
                  </v:roundrect>
                  <![endif]-->
                  <!--[if !mso]><!-->
                  <a href="${confirmUrl}" class="button">Confirm subscription</a>
                  <!--<![endif]-->
                </div>
                <p style="margin: 0; font-size: 14px; color: #64748b;">If you did not request this email, you can safely ignore it. You will not be subscribed unless you confirm.</p>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td class="footer">
                <p style="margin: 0 0 12px;">BuildMarket Technologies Inc. &bull; 123 Construction Way &bull; Nairobi, Kenya</p>
                <p style="margin: 0;">
                  <a href="${unsubscribeUrl}" target="_blank">Unsubscribe</a> &bull; 
                  <a href="https://buildmarket.app/privacy" target="_blank">Privacy Policy</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
  `;
}

export const newsletterConfirmationEmailWorker =
  new Worker<NewsletterConfirmationEmailJobData>(
    "newsletter-confirmation-email",
    processConfirmationEmailJob,
    { connection: createRedisConnection(), concurrency: 5 },
  );

newsletterConfirmationEmailWorker.on("failed", (job, error) => {
  logger.error("confirmation-email job failed", error, {
    operationName: "send_confirmation_email",
    outcome: "failure",
    jobId: job?.id,
    subscriberId: job?.data.subscriberId,
  });
});
