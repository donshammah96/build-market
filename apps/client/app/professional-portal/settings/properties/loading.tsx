export default function Loading() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-6 pb-10">
      <div className="border-b border-zinc-100 pb-6">
        <div className="h-8 w-64 animate-pulse rounded bg-zinc-200" />
        <div className="mt-2 h-4 w-96 animate-pulse rounded bg-zinc-100" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded border border-zinc-200 bg-zinc-50"
          />
        ))}
      </div>

      <div className="rounded border border-zinc-200 bg-white p-6">
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded border border-zinc-100 bg-zinc-50"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
