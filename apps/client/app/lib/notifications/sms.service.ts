/**
 * SMS Notification Service
 *
 * Provides SMS sending functionality for GDPR/compliance notifications.
 * Wraps the base SMS service with domain-specific templates and logic.
 */

import { sendSMS as baseSendSMS } from "@/app/lib/sms";

export interface SMSOptions {
  to: string;
  message: string;
  priority?: "NORMAL" | "HIGH";
}

/**
 * Send a generic SMS
 */
export async function sendSMS(options: SMSOptions) {
  return await baseSendSMS(options);
}

/**
 * Send data breach notification via SMS
 */
export async function sendBreachNotificationSMS(
  phoneNumber: string,
  userName: string,
  incidentId: string,
): Promise<void> {
  const message = `
SECURITY ALERT: BuildMarket - ${userName}, we detected a security incident that may affect your account. Please check your email for details and take immediate action. Ref: ${incidentId}
  `.trim();

  await sendSMS({
    to: phoneNumber,
    message,
    priority: "HIGH",
  });
}

/**
 * Send password reset requirement notification via SMS
 */
export async function sendPasswordResetRequiredSMS(
  phoneNumber: string,
  userName: string,
): Promise<void> {
  const message = `
BuildMarket Security: ${userName}, for your protection, you must reset your password immediately. Visit buildmarket.co.ke to reset. Do not share this message or click suspicious links.
  `.trim();

  await sendSMS({
    to: phoneNumber,
    message,
    priority: "HIGH",
  });
}

/**
 * Send export ready notification via SMS
 */
export async function sendExportReadySMS(
  phoneNumber: string,
  userName: string,
): Promise<void> {
  const message = `
BuildMarket: ${userName}, your data export is ready! Check your email for the download link. Link expires in 7 days.
  `.trim();

  await sendSMS({
    to: phoneNumber,
    message,
    priority: "NORMAL",
  });
}

/**
 * Send account deletion confirmation via SMS
 */
export async function sendAccountDeletionConfirmationSMS(
  phoneNumber: string,
  userName: string,
): Promise<void> {
  const message = `
BuildMarket: ${userName}, your account deletion request has been received. You have 30 days to cancel. Check your email for details.
  `.trim();

  await sendSMS({
    to: phoneNumber,
    message,
    priority: "NORMAL",
  });
}

/**
 * Send consent update confirmation via SMS
 */
export async function sendConsentUpdateSMS(
  phoneNumber: string,
  consentType: string,
  granted: boolean,
): Promise<void> {
  const action = granted ? "granted" : "revoked";
  const message = `
BuildMarket: Your ${consentType} consent has been ${action}. Changes take effect immediately. Questions? Contact support.
  `.trim();

  await sendSMS({
    to: phoneNumber,
    message,
    priority: "NORMAL",
  });
}
