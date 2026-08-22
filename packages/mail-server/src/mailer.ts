import { Resend } from "resend";

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Missing API key. Pass it via RESEND_API_KEY environment variable.",
      );
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
}

export async function sendEmail({
  to,
  subject,
  html,
  attachments,
  cc,
  bcc,
}: SendEmailOptions) {
  const resend = getResendClient();
  await resend.emails.send({
    from: "no-reply/buildmarket.com",
    to,
    subject,
    html,
    attachments: attachments?.map((att) => ({
      filename: att.filename,
      content: att.content,
      contentType: att.contentType,
    })),
    cc,
    bcc,
  });
}
