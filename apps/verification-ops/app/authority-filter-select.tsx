"use client";

/**
 * AuthorityFilterSelect — Client Component
 *
 * Extracted from app/page.tsx (Server Component) because the `onChange`
 * event handler on <select> cannot be serialized to a Client Component prop
 * from a Server Component. Wrapping it here keeps the parent page purely
 * server-rendered while restoring the auto-submit-on-change UX.
 */

import { Filter } from "lucide-react";

interface Option {
  key: string;
  label: string;
}

interface AuthorityFilterSelectProps {
  currentQueue: string;
  currentAuthority?: string;
  authorities: Option[];
}

export function AuthorityFilterSelect({
  currentQueue,
  currentAuthority,
  authorities,
}: AuthorityFilterSelectProps) {
  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const form = e.target.form;
    if (form) form.submit();
  }

  return (
    <div className="flex items-center gap-2">
      <Filter className="w-3.5 h-3.5 text-zinc-400" />
      <form action="/" method="GET" className="inline-block">
        <input type="hidden" name="queue" value={currentQueue} />
        <select
          name="authority"
          defaultValue={currentAuthority || ""}
          onChange={handleChange}
          className="bg-zinc-900 border border-zinc-700 text-xs text-zinc-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
        >
          {authorities.map((auth) => (
            <option key={auth.key} value={auth.key}>
              {auth.label}
            </option>
          ))}
        </select>
      </form>
    </div>
  );
}
