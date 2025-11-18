import { SignIn } from '@clerk/nextjs'
import { ROUTES } from '../../lib/links'

export default function Page() {
  return (
    <div className="flex items-center justify-center mt-16">
          <SignIn forceRedirectUrl={ROUTES.onboarding} />
    </div>
  );
}