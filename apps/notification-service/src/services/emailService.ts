import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

export function initializeEmailService() {
  // TODO: Configure with actual SMTP settings
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  console.log("✓ Email service initialized");
}

export async function sendEmail(
  to: string,
  subject: string,
  content: string
): Promise<boolean> {
  if (!transporter) {
    console.error("Email service not initialized");
    return false;
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || "noreply@buildmarket.com",
      to,
      subject,
      html: content,
    });

    console.log(`Email sent to ${to}`);
    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}

