"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { ROUTES } from "@/lib/links";

type JoinAsProIntentLinkProps = {
  children: ReactNode;
  className?: string;
};

export function JoinAsProIntentLink({
  children,
  className,
}: JoinAsProIntentLinkProps) {
  const router = useRouter();

  async function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();

    try {
      const response = await fetch("/api/onboarding/intent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          role: "professional",
          source: "professional_landing",
        }),
      });
      const json = await response.json().catch(() => null);
      const signUpUrl = json?.data?.signUpUrl;
      router.push(typeof signUpUrl === "string" ? signUpUrl : ROUTES.joinAsPro);
    } catch {
      router.push(ROUTES.joinAsPro);
    }
  }

  return (
    <Link href={ROUTES.joinAsPro} className={className} onClick={handleClick}>
      {children}
    </Link>
  );
}
