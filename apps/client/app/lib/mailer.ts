import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);
export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  await resend.emails.send({ from: 'no-reply@buildmarket.com', to, subject, html });
}