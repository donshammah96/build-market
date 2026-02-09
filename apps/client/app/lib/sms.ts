/**
 * SMS Service - Placeholder/Stub Implementation
 * 
 * This module provides a stub implementation for SMS sending functionality.
 * Replace with actual SMS provider integration (e.g., Twilio, Africa's Talking)
 * when ready for production.
 */

export interface SMSPayload {
  to: string;
  message: string;
}

export interface SMSResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Sends an SMS message to the specified phone number.
 * 
 * @param payload - The SMS payload containing recipient and message
 * @returns Promise resolving to the SMS response
 * 
 * @example
 * ```typescript
 * await sendSMS({
 *   to: '+254712345678',
 *   message: 'Your verification code is 123456'
 * });
 * ```
 */
export async function sendSMS(payload: SMSPayload): Promise<SMSResponse> {
  const { to, message } = payload;

  // Validate phone number (basic validation)
  if (!to || !to.match(/^\+?[1-9]\d{6,14}$/)) {
    console.warn(`[SMS Stub] Invalid phone number: ${to}`);
    return {
      success: false,
      error: 'Invalid phone number format',
    };
  }

  // Validate message
  if (!message || message.trim().length === 0) {
    console.warn('[SMS Stub] Empty message provided');
    return {
      success: false,
      error: 'Message cannot be empty',
    };
  }

  // Log the SMS for development/debugging
  console.log('[SMS Stub] ====================================');
  console.log(`[SMS Stub] To: ${to}`);
  console.log(`[SMS Stub] Message: ${message}`);
  console.log(`[SMS Stub] Length: ${message.length} characters`);
  console.log('[SMS Stub] ====================================');

  // TODO: Replace with actual SMS provider integration
  // Example providers:
  // - Twilio: https://www.twilio.com/docs/sms
  // - Africa's Talking: https://africastalking.com/sms
  // - Nexmo/Vonage: https://developer.vonage.com/messaging/sms/overview

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 100));

  // Generate a mock message ID
  const mockMessageId = `sms_stub_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  return {
    success: true,
    messageId: mockMessageId,
  };
}

/**
 * Sends bulk SMS messages to multiple recipients.
 * 
 * @param recipients - Array of phone numbers
 * @param message - The message to send
 * @returns Promise resolving to an array of SMS responses
 */
export async function sendBulkSMS(
  recipients: string[],
  message: string
): Promise<SMSResponse[]> {
  console.log(`[SMS Stub] Sending bulk SMS to ${recipients.length} recipients`);
  
  const results = await Promise.all(
    recipients.map(to => sendSMS({ to, message }))
  );

  const successCount = results.filter(r => r.success).length;
  console.log(`[SMS Stub] Bulk SMS complete: ${successCount}/${recipients.length} successful`);

  return results;
}
