import type { ReactNode } from "react";

type ProfilePageHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
};

export function ProfilePageHeader({
  title,
  subtitle,
  leading,
  trailing,
}: ProfilePageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-between gap-4 items-start border-b border-zinc-100 pb-6">
      <div className="flex items-center gap-4">
        {leading}
        <div>
          <div className="flex items-center gap-3 flex-wrap">{title}</div>
          {subtitle ? <p className="text-zinc-500 mt-1">{subtitle}</p> : null}
        </div>
      </div>
      {trailing}
    </div>
  );
}
