export default function Loading() {
  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      <div className="h-10 w-40 rounded bg-zinc-100 animate-pulse" />
      <div className="flex flex-col gap-4 border-b border-zinc-100 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <div className="h-8 w-64 rounded bg-zinc-200 animate-pulse" />
          <div className="h-4 w-48 rounded bg-zinc-100 animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-28 rounded bg-zinc-100 animate-pulse" />
          <div className="h-10 w-24 rounded bg-zinc-100 animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <div className="h-6 w-48 rounded bg-zinc-200 animate-pulse" />
            <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <div className="h-4 w-24 rounded bg-zinc-100 animate-pulse" />
                <div className="h-5 w-40 rounded bg-zinc-100 animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-24 rounded bg-zinc-100 animate-pulse" />
                <div className="h-5 w-40 rounded bg-zinc-100 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <div className="h-6 w-32 rounded bg-zinc-200 animate-pulse" />
            <div className="mt-4 h-4 rounded bg-zinc-100 animate-pulse" />
            <div className="mt-2 h-4 w-3/4 rounded bg-zinc-100 animate-pulse" />
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <div className="h-6 w-28 rounded bg-zinc-200 animate-pulse" />
            <div className="mt-4 h-4 rounded bg-zinc-100 animate-pulse" />
            <div className="mt-2 h-4 w-2/3 rounded bg-zinc-100 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
