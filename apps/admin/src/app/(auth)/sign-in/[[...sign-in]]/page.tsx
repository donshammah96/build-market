import { SignIn } from "@clerk/nextjs";

export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <div className="flex items-center justify-center h-screen">
      <SignIn />
    </div>
  );
}