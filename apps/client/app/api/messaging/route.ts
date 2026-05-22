import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import { messagingService } from "@/app/lib/domains/messaging";

/**
 * GET /api/messaging
 * Health check endpoint for the messaging subsystem.
 * Returns service status and basic statistics.
 */
export async function GET() {
  try {
    const serviceResult = await messagingService.healthStatus();
    if (!serviceResult.ok) {
      return apiError(
        "Messaging service is unavailable",
        serviceResult.status || HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return apiSuccess(serviceResult.data, HttpStatus.OK);
  } catch {
    return apiError(
      "Messaging service is unavailable",
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
