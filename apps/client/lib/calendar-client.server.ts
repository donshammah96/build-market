/**
 * Server-side Calendar Client — delegates to existing server-only implementation.
 * This file is intended for server components and other server-only code.
 */
import { calendarClient as serverClient } from "./calendar-client";

// Explicitly export only the public API to avoid exposing private/protected members
type CalendarClientPublic = Pick<typeof serverClient, keyof typeof serverClient>;

export const calendarClient: CalendarClientPublic = serverClient;
export default calendarClient;
