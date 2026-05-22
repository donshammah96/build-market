import type { AuthContext } from "@/app/lib/security/auth-context";

export type AuthorizationDecision = {
  allowed: boolean;
  policy: string;
  reason?: string;
};

export interface AuthorizationPolicy<TResource = unknown> {
  id: string;
  evaluate(input: {
    context: AuthContext;
    resource: TResource;
  }): AuthorizationDecision;
}

export function allow(policy: string): AuthorizationDecision {
  return { allowed: true, policy };
}

export function deny(policy: string, reason: string): AuthorizationDecision {
  return { allowed: false, policy, reason };
}

export function evaluatePolicy<TResource>(
  policy: AuthorizationPolicy<TResource>,
  context: AuthContext,
  resource: TResource,
): AuthorizationDecision {
  return policy.evaluate({ context, resource });
}
