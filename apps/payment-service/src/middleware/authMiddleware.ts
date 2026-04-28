import { createMiddleware } from "hono/factory";
import { getAuth } from "../lib/clerkAuth.js";

const resolveUserId = (auth: ReturnType<typeof getAuth>): string | null => {
  if (!auth || !auth.isAuthenticated) {
    return null;
  }

  if ("userId" in auth && typeof auth.userId === "string") {
    return auth.userId;
  }

  return null;
};

export const shouldBeUser = createMiddleware<{
  Variables: {
    userId: string;
  };
}>(async (c, next) => {
  const userId = resolveUserId(getAuth(c));

  if (!userId) {
    return c.json(
      {
        message: "You are not logged in.",
      },
      401,
    );
  }

  c.set("userId", userId);

  await next();
});

export const shouldBeAdmin = createMiddleware(async (c, next) => {
  const userId = resolveUserId(getAuth(c));

  if (!userId) {
    return c.json(
      {
        message: "You are not logged in.",
      },
      401,
    );
  }

  await next();
});
