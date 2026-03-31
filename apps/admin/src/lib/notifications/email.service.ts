/**
 * Email Notification Service
 *
 * Provides email sending functionality for GDPR/compliance notifications.
 * Wraps the base mailer with domain-specific templates and logic.
 */

import { sendEmail as baseSendEmail } from "@/app/lib/infrastructure/mailer";

export type DPOEscalationMetadata = Record<string, unknown>;
export interface IncidentSeverityLevel {
  LOW: "LOW";
  MEDIUM: "MEDIUM";
  HIGH: "HIGH";
  CRITICAL: "CRITICAL";
}
export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
}

export interface BreachNotificationEmailData {
  incidentId: string;
  userName: string;
  incidentDate: Date;
  severity: IncidentSeverityLevel;
  affectedData: string[];
  protectiveMeasures: string[];
}

export interface ODPCNotificationEmailData {
  incidentId: string;
  detectedAt: Date;
  severity: string;
  classification: string;
  affectedUserCount: number;
  dataClasses: string[];
  description: string;
}

/**
 * Send a generic email
 */
export async function sendEmail(options: EmailOptions) {
  return await baseSendEmail(options as EmailOptions);
}

/**
 * Send data breach notification to user
 */
export async function sendBreachNotificationEmail(
  to: string,
  data: BreachNotificationEmailData,
): Promise<void> {
  const {
    incidentId,
    userName,
    incidentDate,
    severity,
    affectedData,
    protectiveMeasures,
  } = data;

  const subject = "Important Security Notice - Data Breach Notification";

  const html = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #dc2626;">Security Incident Notification</h1>
          
          <p>Dear ${userName},</p>
          
          <p>We are writing to inform you of a security incident that may have affected your personal data.</p>
          
          <div style="background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Incident Date:</strong> ${incidentDate.toLocaleDateString()}</p>
            <p style="margin: 5px 0 0 0;"><strong>Severity:</strong> ${severity}</p>
            <p style="margin: 5px 0 0 0;"><strong>Incident Reference:</strong> ${incidentId}</p>
          </div>
          
          <h2>Affected Data</h2>
          <p>The following categories of your personal data may have been affected:</p>
          <ul>
            ${affectedData.map((item) => `<li>${item}</li>`).join("\n")}
          </ul>
          
          <h2>What We're Doing</h2>
          <ul>
            <li>Investigating the incident thoroughly</li>
            <li>Implementing additional security measures</li>
            <li>Notifying relevant authorities (Office of the Data Protection Commissioner)</li>
            ${protectiveMeasures.map((measure) => `<li>${measure}</li>`).join("\n")}
          </ul>
          
          <h2>What You Should Do</h2>
          <ul>
            <li>Reset your password immediately using the "Forgot Password" feature</li>
            <li>Enable two-factor authentication if you haven't already</li>
            <li>Monitor your accounts for any suspicious activity</li>
            <li>Be cautious of phishing attempts referencing this incident</li>
          </ul>
          
          <div style="background-color: #f0f9ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Need Help?</strong></p>
            <p style="margin: 5px 0 0 0;">Contact our Data Protection Officer at dpo/buildmarket.co.ke or visit our Help Center.</p>
          </div>
          
          <p>We sincerely apologize for this incident and any inconvenience it may cause. Your trust and security are our top priorities.</p>
          
          <p>Sincerely,<br>
          <strong>BuildMarket Security Team</strong></p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="font-size: 12px; color: #6b7280;">
            This is an important security notification. If you have any questions about this incident, 
            please contact us immediately at security/buildmarket.co.ke.
          </p>
        </div>
      </body>
    </html>
  `;

  const text = `
SECURITY INCIDENT NOTIFICATION

Dear ${userName},

We are writing to inform you of a security incident that may have affected your personal data.

Incident Date: ${incidentDate.toLocaleDateString()}
Severity: ${severity}
Incident Reference: ${incidentId}

AFFECTED DATA:
${affectedData.map((item) => `- ${item}`).join("\n")}

WHAT WE'RE DOING:
- Investigating the incident thoroughly
- Implementing additional security measures
- Notifying relevant authorities (ODPC)
${protectiveMeasures.map((measure) => `- ${measure}`).join("\n")}

WHAT YOU SHOULD DO:
- Reset your password immediately
- Enable two-factor authentication
- Monitor your accounts for suspicious activity
- Be cautious of phishing attempts

Need help? Contact our Data Protection Officer at dpo/buildmarket.co.ke

We sincerely apologize for this incident and any inconvenience it may cause.

Sincerely,
BuildMarket Security Team
  `.trim();

  await sendEmail({
    to,
    subject,
    html,
    text,
  });
}

/**
 * Send ODPC (Office of the Data Protection Commissioner) notification
 */
export async function sendODPCNotificationEmail(
  data: ODPCNotificationEmailData,
): Promise<void> {
  const {
    incidentId,
    detectedAt,
    severity,
    classification,
    affectedUserCount,
    dataClasses,
    description,
  } = data;

  const odpcEmail = process.env.ODPC_EMAIL || "dpo/odpc.go.ke";
  const subject = `MANDATORY NOTIFICATION: Data Breach - ${incidentId}`;

  const body = `
DATA BREACH NOTIFICATION TO ODPC
Submitted by: BuildMarket (www.buildmarket.co.ke)
Data Controller Registration: [Your Registration Number]

INCIDENT DETAILS:
================
Incident Reference: ${incidentId}
Date Detected: ${detectedAt.toISOString()}
Severity: ${severity}
Classification: ${classification}

AFFECTED DATA SUBJECTS:
======================
- Number: ${affectedUserCount}
- Data Classes: ${dataClasses.join(", ")}

DESCRIPTION:
===========
${description}

IMMEDIATE ACTIONS TAKEN:
========================
1. Incident containment initiated
2. Affected systems isolated
3. Investigation underway
4. Affected users being notified
5. Additional security measures implemented

CONTACT INFORMATION:
===================
Data Protection Officer
Email: dpo/buildmarket.co.ke
Phone: +254 XXX XXX XXX

This notification is submitted within 72 hours as required by Section 43 of the Data Protection Act, 2019.
  `.trim();

  await sendEmail({
    to: odpcEmail,
    subject,
    html: `<pre>${body}</pre>`,
    text: body,
    attachments: [
      {
        filename: `incident-report-${incidentId}.txt`,
        content: body,
      },
    ],
  });
}

/**
 * Send DPO escalation email
 */
export async function sendDPOEscalationEmail(
  incidentId: string,
  severity: string,
  metadata: DPOEscalationMetadata,
): Promise<void> {
  const dpoEmail = process.env.DPO_EMAIL || "security/buildmarket.co.ke";

  await sendEmail({
    to: dpoEmail,
    subject: `ESCALATION REQUIRED: ${severity} Security Incident - ${incidentId}`,
    html: `
      <div style="font-family: Arial, sans-serif;">
        <h1 style="color: #dc2626;">🚨 Security Incident Requires Immediate Attention</h1>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 10px; background-color: #f3f4f6;"><strong>Incident ID:</strong></td>
            <td style="padding: 10px;">${incidentId}</td>
          </tr>
          <tr>
            <td style="padding: 10px; background-color: #f3f4f6;"><strong>Severity:</strong></td>
            <td style="padding: 10px; color: #dc2626;"><strong>${severity}</strong></td>
          </tr>
          <tr>
            <td style="padding: 10px; background-color: #f3f4f6;"><strong>Time:</strong></td>
            <td style="padding: 10px;">${new Date().toISOString()}</td>
          </tr>
        </table>
        <h2>Metadata:</h2>
        <pre style="background-color: #f9fafb; padding: 15px; border-radius: 5px; overflow-x: auto;">${JSON.stringify(metadata, null, 2)}</pre>
        <p><strong>Action Required:</strong> Please review this incident immediately and coordinate response efforts.</p>
      </div>
    `,
  });
}

/**
 * Send export ready notification
 */
export async function sendExportReadyEmail(
  to: string,
  userName: string,
  downloadUrl: string,
  expiresAt: Date,
): Promise<void> {
  const subject = "Your Data Export is Ready";

  const html = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #059669;">Your Data Export is Ready</h1>
          
          <p>Hi ${userName},</p>
          
          <p>Your requested data export has been completed and is ready for download.</p>
          
          <div style="background-color: #d1fae5; border-left: 4px solid #059669; padding: 15px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Download Link:</strong></p>
            <p style="margin: 10px 0;">
              <a href="${downloadUrl}" style="color: #059669; font-weight: bold; text-decoration: underline;">
                Click here to download your data
              </a>
            </p>
            <p style="margin: 10px 0 0 0; font-size: 14px; color: #065f46;">
              ⏰ This link expires on ${expiresAt.toLocaleString()}
            </p>
          </div>
          
          <h2>What's Included?</h2>
          <p>Your export includes:</p>
          <ul>
            <li>Profile information</li>
            <li>Project data</li>
            <li>Order history</li>
            <li>Transaction records</li>
            <li>Messages and communications</li>
          </ul>
          
          <p><strong>Note:</strong> The export file is in ZIP format. You'll need to extract it to view the contents.</p>
          
          <p>If you have any questions or did not request this export, please contact us immediately.</p>
          
          <p>Best regards,<br>
          <strong>BuildMarket Team</strong></p>
        </div>
      </body>
    </html>
  `;

  await sendEmail({
    to,
    subject,
    html,
  });
}
