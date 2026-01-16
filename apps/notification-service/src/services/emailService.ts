import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";

let transporter: nodemailer.Transporter | null = null;

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

/**
 * Get SMTP configuration based on provider
 */
function getSmtpConfig(): EmailConfig {
  const provider = process.env.EMAIL_PROVIDER?.toLowerCase() || "gmail";

  const configs: Record<string, Partial<EmailConfig>> = {
    gmail: {
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
    },
    sendgrid: {
      host: "smtp.sendgrid.net",
      port: 587,
      secure: false,
    },
    mailgun: {
      host: "smtp.mailgun.org",
      port: 587,
      secure: false,
    },
    resend: {
      host: "smtp.resend.com",
      port: 465,
      secure: true,
    },
    custom: {
      host: process.env.SMTP_HOST || "localhost",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
    },
  };

  const baseConfig = configs[provider] ?? configs.custom!;

  return {
    host: process.env.SMTP_HOST || baseConfig.host || "localhost",
    port: parseInt(process.env.SMTP_PORT || String(baseConfig.port ?? 587)),
    secure: process.env.SMTP_SECURE === "true" || baseConfig.secure || false,
    auth: {
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASS || "",
    },
  };
}

/**
 * Initialize email service with SMTP configuration
 */
export function initializeEmailService(): boolean {
  const config = getSmtpConfig();

  // Validate required credentials
  if (!config.auth.user || !config.auth.pass) {
    console.warn(
      "⚠ Email service: SMTP credentials not configured. Emails will not be sent."
    );
    console.warn("  Set SMTP_USER and SMTP_PASS environment variables.");
    return false;
  }

  try {
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
      // Connection timeout settings
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });

    console.log(`✓ Email service initialized (${config.host}:${config.port})`);
    return true;
  } catch (error) {
    console.error("✗ Failed to initialize email service:", error);
    return false;
  }
}

/**
 * Verify SMTP connection is working
 */
export async function verifyEmailConnection(): Promise<boolean> {
  if (!transporter) {
    console.error("Email service not initialized");
    return false;
  }

  try {
    await transporter.verify();
    console.log("✓ Email service connection verified");
    return true;
  } catch (error) {
    console.error("✗ Email service connection failed:", error);
    return false;
  }
}

/**
 * Send an email
 */
export async function sendEmail(
  to: string,
  subject: string,
  content: string,
  options?: {
    from?: string;
    replyTo?: string;
    cc?: string | string[];
    bcc?: string | string[];
    attachments?: Mail.Attachment[];
  }
): Promise<boolean> {
  if (!transporter) {
    console.error("Email service not initialized");
    return false;
  }

  const fromAddress =
    options?.from ||
    process.env.SMTP_FROM ||
    process.env.SMTP_USER ||
    "noreply@buildmarket.com";

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      html: content,
      replyTo: options?.replyTo,
      cc: options?.cc,
      bcc: options?.bcc,
      attachments: options?.attachments,
    });

    console.log(`✓ Email sent to ${to} (messageId: ${info.messageId})`);
    return true;
  } catch (error: any) {
    console.error(`✗ Failed to send email to ${to}:`, error.message);
    return false;
  }
}

/**
 * Send a templated email
 */
export async function sendTemplatedEmail(
  to: string,
  template: {
    subject: string;
    title: string;
    body: string;
    ctaText?: string;
    ctaLink?: string;
  }
): Promise<boolean> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${template.subject}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">${template.title}</h1>
      </div>
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
        <div style="font-size: 16px;">
          ${template.body}
        </div>
        ${
          template.ctaText && template.ctaLink
            ? `
        <div style="text-align: center; margin-top: 30px;">
          <a href="${template.ctaLink}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: 600;">
            ${template.ctaText}
          </a>
        </div>
        `
            : ""
        }
      </div>
      <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
        <p>© ${new Date().getFullYear()} Build Market. All rights reserved.</p>
        <p>This email was sent by Build Market notification service.</p>
      </div>
    </body>
    </html>
  `;

  return sendEmail(to, template.subject, html);
}

