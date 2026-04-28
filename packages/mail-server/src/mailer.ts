import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

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
