export default function Loading() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-8 pb-10">
      <div className="border-b border-zinc-100 pb-6">
        <div className="h-8 w-44 animate-pulse rounded bg-zinc-200" />
        <div className="mt-2 h-4 w-80 animate-pulse rounded bg-zinc-100" />
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="h-10 w-full animate-pulse rounded bg-zinc-100 md:w-96" />
        <div className="flex gap-2">
          <div className="h-10 w-24 animate-pulse rounded bg-zinc-100" />
          <div className="h-10 w-56 animate-pulse rounded bg-zinc-100" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="overflow-hidden rounded-xl border border-zinc-200 bg-white"
          >
            <div className="h-40 animate-pulse bg-zinc-100" />
            <div className="space-y-4 p-6">
              <div className="h-5 w-2/3 animate-pulse rounded bg-zinc-100" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-zinc-100" />
              <div className="h-2 animate-pulse rounded bg-zinc-100" />
              <div className="h-10 animate-pulse rounded bg-zinc-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
