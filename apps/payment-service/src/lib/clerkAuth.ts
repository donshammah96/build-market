import {
  createClerkClient,
  type AuthObject,
  type ClerkClient,
} from "@clerk/backend";
import type { MiddlewareHandler } from "hono";

type ClerkAuthVariables = {
  clerkAuth: AuthObject | null;
};

type ClerkConfig = {
  secretKey: string;
  publishableKey: string;
  apiUrl?: string;
  apiVersion?: string;
};

let clerkClient: ClerkClient | null = null;
let clerkConfig: ClerkConfig | null = null;

const getRequiredEnv = (name: "CLERK_SECRET_KEY" | "CLERK_PUBLISHABLE_KEY") => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
};

const getClerkConfig = (): ClerkConfig => {
  if (clerkConfig) {
    return clerkConfig;
  }

  clerkConfig = {
    secretKey: getRequiredEnv("CLERK_SECRET_KEY"),
    publishableKey: getRequiredEnv("CLERK_PUBLISHABLE_KEY"),
    apiUrl: process.env.CLERK_API_URL,
    apiVersion: process.env.CLERK_API_VERSION,
  };

  return clerkConfig;
};

const getClerkClient = (): ClerkClient => {
  if (clerkClient) {
    return clerkClient;
  }

  const config = getClerkConfig();

  clerkClient = createClerkClient({
    secretKey: config.secretKey,
    publishableKey: config.publishableKey,
    apiUrl: config.apiUrl,
    apiVersion: config.apiVersion,
  });

  return clerkClient;
};

export const clerkMiddleware = (): MiddlewareHandler<{
  Variables: ClerkAuthVariables;
}> => {
  return async (c, next) => {
    const client = getClerkClient();
    const config = getClerkConfig();
    const requestState = await client.authenticateRequest(c.req.raw, {
      secretKey: config.secretKey,
      publishableKey: config.publishableKey,
      acceptsToken: "any",
    });

    requestState.headers.forEach((value, key) => {
      c.res.headers.append(key, value);
    });

    const redirectLocation = requestState.headers.get("location");
    if (redirectLocation) {
      return c.redirect(redirectLocation, 307);
    }

    if (requestState.status === "handshake") {
      return c.json({ message: "Authentication handshake required." }, 401);
    }

    c.set("clerkAuth", requestState.toAuth());

    await next();
  };
};

export const getAuth = <
  TContext extends { get: (key: "clerkAuth") => AuthObject | null },
>(
  c: TContext,
): AuthObject | null => {
  return c.get("clerkAuth");
};
