export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-10">
      <div className="flex items-center justify-between">
        <div className="h-10 w-40 animate-pulse rounded bg-zinc-100" />
        <div className="flex gap-2">
          <div className="h-10 w-24 animate-pulse rounded bg-zinc-100" />
          <div className="h-10 w-28 animate-pulse rounded bg-zinc-100" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        <div className="space-y-6 md:col-span-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <div className="h-6 w-40 animate-pulse rounded bg-zinc-200" />
            <div className="mt-6 space-y-4">
              <div className="h-5 w-2/3 animate-pulse rounded bg-zinc-100" />
              <div className="h-4 w-1/3 animate-pulse rounded bg-zinc-100" />
              <div className="h-20 animate-pulse rounded bg-zinc-100" />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <div className="h-5 w-32 animate-pulse rounded bg-zinc-200" />
            <div className="mt-4 h-12 animate-pulse rounded bg-zinc-100" />
            <div className="mt-3 h-8 animate-pulse rounded bg-zinc-100" />
          </div>
        </div>
      </div>
    </div>
  );
}
