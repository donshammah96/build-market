import type { AppRole } from "@/app/lib/security/roles";

export type AuthSource = "clerk" | "internal" | "system" | "unknown";

export type AuthContext = {
  actorId?: string | null;
  role?: AppRole | null;
  isAuthenticated: boolean;
  source: AuthSource;
  scopes?: readonly string[];
};

export function createUserAuthContext(params: {
  actorId: string;
  role?: AppRole | null;
  source?: AuthSource;
  scopes?: readonly string[];
}): AuthContext {
  return {
    actorId: params.actorId,
    role: params.role,
    isAuthenticated: true,
    source: params.source ?? "clerk",
    scopes: params.scopes,
  };
}

export function createAnonymousAuthContext(): AuthContext {
  return {
    actorId: null,
    role: null,
    isAuthenticated: false,
    source: "unknown",
  };
}

export function hasScope(context: AuthContext, scope: string): boolean {
  return !!context.scopes?.includes(scope);
}
