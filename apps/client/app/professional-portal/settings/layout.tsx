import { SettingsErrorBoundary } from "./SettingsErrorBoundary";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SettingsErrorBoundary fallbackTitle="Settings Error">
      {children}
    </SettingsErrorBoundary>
  );
}
