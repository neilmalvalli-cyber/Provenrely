/** Skeleton shown while a console page streams in. */
export default function ConsoleLoading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="pb-8">
        <div className="skeleton h-3 w-28" />
        <div className="skeleton mt-3 h-8 w-72" />
        <div className="skeleton mt-3 h-3 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="glass rounded-2xl p-5">
            <div className="skeleton h-3 w-20" />
            <div className="skeleton mt-5 h-7 w-24" />
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="glass rounded-2xl p-5 xl:col-span-2">
          <div className="skeleton h-3 w-40" />
          <div className="skeleton mt-6 h-44 w-full" />
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="skeleton h-3 w-32" />
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="skeleton mt-4 h-4 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
