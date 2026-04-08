"use client";
import Link from "next/link";
import { ROUTES } from "@/lib/links";
import { MobileNav } from "./MobileNav";
import Image from "next/image";
import { SignInButton, useUser } from "@clerk/nextjs";
import ProfileButton from "../shared/ProfileButton";
export const Header = () => {
  const { isSignedIn } = useUser();

  const navLinkClass =
    "min-h-11 px-2 py-2 text-md font-medium text-foreground leading-loose rounded-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2";

  return (
    <header className="border-b border-border bg-background">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center">
            <Image
              src="/bm-logo-main.png"
              alt="Build Market"
              width={36}
              height={36}
              className="w-6 h-6 md:w-9 md:h-9"
            />
            <p className="hidden md:block text-md font-medium tracking-wider">
              BUILD MARKET.
            </p>
          </Link>
          <div className="flex items-center gap-6">
            <nav
              className="hidden md:flex items-center gap-8"
              role="navigation"
              aria-label="Main navigation"
            >
              <Link href={ROUTES.ideaBooks} className={navLinkClass}>
                Idea Books
              </Link>
              <Link href={ROUTES.findProfessional} className={navLinkClass}>
                Find Professionals
              </Link>
              <Link href={ROUTES.speakWithAdvisor} className={navLinkClass}>
                Guidance
              </Link>
              <div className="flex items-center gap-6">
                {!isSignedIn ? (
                  <SignInButton forceRedirectUrl={ROUTES.authCallback} />
                ) : (
                  <ProfileButton />
                )}
              </div>
            </nav>
          </div>
          <MobileNav />
        </div>
      </div>
    </header>
  );
};
