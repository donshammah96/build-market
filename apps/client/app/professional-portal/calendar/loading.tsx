export default function Loading() {
  return (
    <div className="max-w-[1600px] mx-auto pb-10 space-y-8">
      <div className="border-b border-zinc-100 pb-6">
        <div className="h-8 w-40 rounded bg-zinc-200 animate-pulse" />
        <div className="mt-2 h-4 w-72 rounded bg-zinc-100 animate-pulse" />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-4 xl:col-span-3 space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="h-[320px] rounded-xl bg-zinc-100 animate-pulse" />
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="h-4 w-24 rounded bg-zinc-200 animate-pulse" />
            <div className="mt-4 space-y-3">
              <div className="h-4 rounded bg-zinc-100 animate-pulse" />
              <div className="h-4 rounded bg-zinc-100 animate-pulse" />
              <div className="h-4 rounded bg-zinc-100 animate-pulse" />
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 xl:col-span-9 space-y-4">
          <div className="h-6 w-64 rounded bg-zinc-200 animate-pulse" />
          <div className="h-32 rounded-xl bg-zinc-100 animate-pulse" />
          <div className="h-32 rounded-xl bg-zinc-100 animate-pulse" />
          <div className="h-32 rounded-xl bg-zinc-100 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
