import Link from "next/link";

/**
 * Maintenance page shown when maintenanceMode is enabled.
 * Admins and whitelisted IPs bypass this via middleware.
 */
export default function MaintenancePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 px-4">
      <div className="max-w-md text-center space-y-6">
        <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">
          We&apos;ll be back soon
        </h1>
        <p className="text-zinc-600">
          We&apos;re performing scheduled maintenance. Please check back shortly.
        </p>
        <Link
          href="/"
          className="inline-flex items-center text-emerald-600 font-medium hover:text-emerald-700 hover:underline"
        >
          Return to home
        </Link>
      </div>
    </div>
  );
}
