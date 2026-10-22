export default function Loading() {
  const block = "animate-pulse rounded-3xl border border-line bg-surface";
  return (
    <div className="mx-auto max-w-6xl space-y-3 px-4 py-4 pt-20">
      <div className={`${block} h-12`} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={`${block} h-24`} />
        ))}
      </div>
      <div className={`${block} h-64`} />
      <div className={`${block} h-80`} />
    </div>
  );
}
