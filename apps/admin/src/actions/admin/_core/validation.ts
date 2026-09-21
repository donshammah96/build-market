import type { z } from "zod";

export function parseActionInput<T>(
  schema: z.ZodType<T>,
  input: unknown,
  fallbackMessage: string,
): T {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? fallbackMessage);
  }

  return result.data;
}
