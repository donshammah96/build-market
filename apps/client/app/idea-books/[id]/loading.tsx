export default function Loading() {
  return (
    <div className="min-h-screen bg-zinc-50/50 px-4 py-24 md:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="h-5 w-36 animate-pulse rounded bg-zinc-200" />

        <div className="flex gap-4">
          <div className="h-14 w-14 animate-pulse rounded-xl bg-zinc-200" />
          <div className="flex-1 space-y-2">
            <div className="h-9 w-2/3 animate-pulse rounded bg-zinc-200" />
            <div className="h-5 w-1/2 animate-pulse rounded bg-zinc-100" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <div
              key={index}
              className="aspect-square animate-pulse rounded-xl border border-zinc-200 bg-white"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
