import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

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

export async function sendEmail({ to, subject, html, attachments }: SendEmailOptions) {
  await resend.emails.send({ 
    from: 'no-reply@buildmarket.com', 
    to, 
    subject, 
    html,
    attachments: attachments?.map(att => ({
      filename: att.filename,
      content: att.content,
    })),
  });
}