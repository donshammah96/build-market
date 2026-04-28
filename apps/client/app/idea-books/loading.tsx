export default function Loading() {
  return (
    <div className="min-h-screen bg-zinc-50/50 px-4 py-24 md:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="space-y-3">
          <div className="h-8 w-56 animate-pulse rounded bg-zinc-200" />
          <div className="h-5 w-80 animate-pulse rounded bg-zinc-100" />
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-72 animate-pulse rounded-2xl border border-zinc-200 bg-white"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
