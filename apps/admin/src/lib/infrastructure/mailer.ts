import { Resend } from "resend";
import { adminEnvConfig } from "@/lib/infrastructure/env";
import { omitUndefined } from "@/lib/utils";

const resend = new Resend(adminEnvConfig.RESEND_API_KEY);

interface EmailAttachment {
  filename: string;
  content: string | Buffer;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}

export async function sendEmail({
  to,
  subject,
  html,
  attachments,
}: SendEmailOptions) {
  await resend.emails.send({
    from: "no-reply@buildmarket.app",
    to,
    subject,
    html,
    ...omitUndefined({
      attachments: attachments?.map((att) => ({
        filename: att.filename,
        content: att.content,
      })),
    }),
  });
}
