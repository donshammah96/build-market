/**
 * Notification Templates for Verification Outcomes
 *
 * Centralized configuration for all verification-related notifications.
 * Templates can be customized per entity type and outcome.
 */

import type { EntityType } from "./types";
import { buildVerificationLink } from "./entity-routes";

/**
 * Sanitize user input for safe HTML rendering in emails
 * Prevents XSS attacks in email clients
 */
function sanitizeHtml(input: string | undefined | null): string {
  if (!input) return "";
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export type NotificationType =
  | "VERIFIED"
  | "REJECTED"
  | "NEEDS_CORRECTION"
  | "DOCUMENT_APPROVED"
  | "DOCUMENT_REJECTED";

export interface NotificationTemplate {
  title: string;
  message: string;
  type: "success" | "error" | "warning" | "info";
  link: string;
  // Optional email subject for external notifications
  emailSubject?: string;
  // Optional email body template
  emailBody?: string;
}

/**
 * Get notification template for a verification outcome
 */
export function getVerificationTemplate(
  notificationType: NotificationType,
  entityType: EntityType,
  options?: {
    entityName?: string;
    entityId?: string;
    rejectionReason?: string;
    correctionNotes?: string;
    adminNotes?: string;
  }
): NotificationTemplate {
  // Handle certificate as a document notification
  if (entityType === "certificate") {
    return getDocumentNotificationTemplate(notificationType, options);
  }

  const entityTypeLabel = capitalizeEntityType(entityType);
  // Sanitize user-provided entity name to prevent XSS in emails
  const entityName = sanitizeHtml(options?.entityName) || "your submission";
  const safeRejectionReason = sanitizeHtml(options?.rejectionReason);
  const safeCorrectionNotes = sanitizeHtml(options?.correctionNotes);
  const safeAdminNotes = sanitizeHtml(options?.adminNotes);
  const baseLink = buildVerificationLink(entityType, notificationType, {
    entityId: options?.entityId,
  });

  switch (notificationType) {
    case "VERIFIED":
      return {
        title: `${entityTypeLabel} Verified Successfully`,
        message: `Congratulations! ${entityName} has been verified and is now live on Build Market.`,
        type: "success",
        link: baseLink,
        emailSubject: `Your ${entityTypeLabel} Has Been Verified`,
        emailBody: `
          <h2>Verification Successful!</h2>
          <p>Great news! Your ${entityType} "${entityName}" has been successfully verified by our team.</p>
          <p>${safeAdminNotes ? `Admin notes: ${safeAdminNotes}` : ""}</p>
          <p><a href="${baseLink}">View your ${entityType}</a></p>
        `,
      };

    case "REJECTED":
      return {
        title: `${entityTypeLabel} Verification Rejected`,
        message: `Unfortunately, ${entityName} was not approved. ${safeRejectionReason || "Please review the feedback and resubmit."}`,
        type: "error",
        link: baseLink,
        emailSubject: `Action Required: ${entityTypeLabel} Verification Rejected`,
        emailBody: `
          <h2>Verification Rejected</h2>
          <p>We're sorry, but your ${entityType} "${entityName}" was not approved during verification.</p>
          ${safeRejectionReason ? `<p><strong>Reason:</strong> ${safeRejectionReason}</p>` : ""}
          ${safeAdminNotes ? `<p><strong>Admin Notes:</strong> ${safeAdminNotes}</p>` : ""}
          <p>Please review the feedback and make the necessary corrections before resubmitting.</p>
          <p><a href="${baseLink}">Update your ${entityType}</a></p>
        `,
      };

    case "NEEDS_CORRECTION":
      return {
        title: `${entityTypeLabel} Needs Correction`,
        message: `${entityName} requires some corrections. ${safeCorrectionNotes || "Please review the admin notes and update accordingly."}`,
        type: "warning",
        link: baseLink,
        emailSubject: `Action Required: ${entityTypeLabel} Needs Correction`,
        emailBody: `
          <h2>Corrections Required</h2>
          <p>Your ${entityType} "${entityName}" needs some corrections before it can be verified.</p>
          ${safeCorrectionNotes ? `<p><strong>Required Corrections:</strong> ${safeCorrectionNotes}</p>` : ""}
          ${safeAdminNotes ? `<p><strong>Admin Notes:</strong> ${safeAdminNotes}</p>` : ""}
          <p>Please make the necessary updates and resubmit for verification.</p>
          <p><a href="${baseLink}">Update your ${entityType}</a></p>
        `,
      };

    case "DOCUMENT_APPROVED":
      return {
        title: "Document Approved",
        message: `A document for ${entityName} has been approved.`,
        type: "success",
        link: baseLink,
        emailSubject: `Document Approved for Your ${entityTypeLabel}`,
        emailBody: `
          <h2>Document Approved</h2>
          <p>A document for your ${entityType} "${entityName}" has been approved by our verification team.</p>
          ${safeAdminNotes ? `<p><strong>Notes:</strong> ${safeAdminNotes}</p>` : ""}
          <p><a href="${baseLink}">View your ${entityType}</a></p>
        `,
      };

    case "DOCUMENT_REJECTED": {
      // For document rejection, append tab=documents if not already in route
      const documentLink = baseLink.includes("tab=")
        ? baseLink
        : `${baseLink}${baseLink.includes("?") ? "&" : "?"}tab=documents`;
      return {
        title: "Document Rejected",
        message: `A document for ${entityName} was rejected. ${safeRejectionReason || "Please review and upload a new document."}`,
        type: "error",
        link: documentLink,
        emailSubject: `Document Rejected for Your ${entityTypeLabel}`,
        emailBody: `
          <h2>Document Rejected</h2>
          <p>A document for your ${entityType} "${entityName}" was rejected during verification.</p>
          ${safeRejectionReason ? `<p><strong>Reason:</strong> ${safeRejectionReason}</p>` : ""}
          ${safeAdminNotes ? `<p><strong>Admin Notes:</strong> ${safeAdminNotes}</p>` : ""}
          <p>Please review the feedback and upload a new document.</p>
          <p><a href="${documentLink}">Update documents</a></p>
        `,
      };
    }

    default:
      return {
        title: `${entityTypeLabel} Status Updated`,
        message: `The status of ${entityName} has been updated.`,
        type: "info",
        link: baseLink,
      };
  }
}

/**
 * Get document notification template (for certificates)
 */
function getDocumentNotificationTemplate(
  notificationType: NotificationType,
  options?: {
    entityName?: string;
    entityId?: string;
    rejectionReason?: string;
    correctionNotes?: string;
    adminNotes?: string;
  }
): NotificationTemplate {
  // Sanitize user-provided inputs to prevent XSS in emails
  const entityName = sanitizeHtml(options?.entityName) || "your certificate";
  const safeRejectionReason = sanitizeHtml(options?.rejectionReason);
  const safeAdminNotes = sanitizeHtml(options?.adminNotes);
  const baseLink = buildVerificationLink("certificate", notificationType, {
    entityId: options?.entityId,
  });

  switch (notificationType) {
    case "VERIFIED":
    case "DOCUMENT_APPROVED":
      return {
        title: "Certificate Approved",
        message: `${entityName} has been approved by our verification team.`,
        type: "success",
        link: baseLink,
        emailSubject: "Certificate Approved",
        emailBody: `
          <h2>Certificate Approved</h2>
          <p>Your certificate "${entityName}" has been approved by our verification team.</p>
          ${safeAdminNotes ? `<p><strong>Notes:</strong> ${safeAdminNotes}</p>` : ""}
          <p><a href="${baseLink}">View your profile</a></p>
        `,
      };
    case "REJECTED":
    case "DOCUMENT_REJECTED":
      return {
        title: "Certificate Rejected",
        message: `${entityName} was rejected. ${safeRejectionReason || "Please review and upload a new certificate."}`,
        type: "error",
        link: baseLink,
        emailSubject: "Certificate Rejected",
        emailBody: `
          <h2>Certificate Rejected</h2>
          <p>Your certificate "${entityName}" was rejected during verification.</p>
          ${safeRejectionReason ? `<p><strong>Reason:</strong> ${safeRejectionReason}</p>` : ""}
          ${safeAdminNotes ? `<p><strong>Admin Notes:</strong> ${safeAdminNotes}</p>` : ""}
          <p>Please review the feedback and upload a new certificate.</p>
          <p><a href="${baseLink}">Update certificates</a></p>
        `,
      };
    default:
      return {
        title: "Certificate Status Updated",
        message: `The status of ${entityName} has been updated.`,
        type: "info",
        link: baseLink,
      };
  }
}

/**
 * Capitalize entity type for display
 */
function capitalizeEntityType(entityType: EntityType): string {
  // Handle certificate as a special case (shouldn't reach here, but just in case)
  if (entityType === "certificate") {
    return "Certificate";
  }
  return entityType.charAt(0).toUpperCase() + entityType.slice(1);
}

/**
 * Get notification template with dynamic content replacement
 */
export function formatNotificationMessage(
  template: NotificationTemplate,
  variables: Record<string, string>
): NotificationTemplate {
  let title = template.title;
  let message = template.message;
  let emailBody = template.emailBody;

  // Replace variables in format {{variableName}}
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
    title = title.replace(regex, value);
    message = message.replace(regex, value);
    if (emailBody) {
      emailBody = emailBody.replace(regex, value);
    }
  });

  return {
    ...template,
    title,
    message,
    emailBody,
  };
}

/**
 * Predefined templates for common scenarios
 */
export const NotificationTemplates = {
  /**
   * Professional verified template
   */
  professionalVerified: (
    companyName: string,
    adminNotes?: string,
    entityId?: string
  ) =>
    getVerificationTemplate("VERIFIED", "professional", {
      entityName: companyName,
      entityId,
      adminNotes,
    }),

  /**
   * Store verified template
   */
  storeVerified: (storeName: string, adminNotes?: string, entityId?: string) =>
    getVerificationTemplate("VERIFIED", "store", {
      entityName: storeName,
      entityId,
      adminNotes,
    }),

  /**
   * Property verified template
   */
  propertyVerified: (
    propertyTitle: string,
    adminNotes?: string,
    entityId?: string
  ) =>
    getVerificationTemplate("VERIFIED", "property", {
      entityName: propertyTitle,
      entityId,
      adminNotes,
    }),

  /**
   * Generic rejection template
   */
  rejection: (
    entityType: EntityType,
    entityName: string,
    reason: string,
    adminNotes?: string,
    entityId?: string
  ) =>
    getVerificationTemplate("REJECTED", entityType, {
      entityName,
      entityId,
      rejectionReason: reason,
      adminNotes,
    }),

  /**
   * Generic correction request template
   */
  correctionRequest: (
    entityType: EntityType,
    entityName: string,
    notes: string,
    adminNotes?: string,
    entityId?: string
  ) =>
    getVerificationTemplate("NEEDS_CORRECTION", entityType, {
      entityName,
      entityId,
      correctionNotes: notes,
      adminNotes,
    }),
};
