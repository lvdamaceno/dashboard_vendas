interface Props {
  label: string;
  value: string;
  current: number;
  previous: number;
  prevLabel: string;
  note?: string;
}

export function KpiCard({ label, value, current, previous, prevLabel, note }: Props) {
  // Math.abs: com devoluções o período anterior pode ser negativo
  const delta = previous ? ((current - previous) / Math.abs(previous)) * 100 : null;
  const up = delta !== null && delta >= 0;

  return (
    <div className="rounded-xl border border-line bg-surface p-3.5 md:p-4">
      <p className="text-xs text-ink-2 md:text-sm">{label}</p>
      <p className="tabular mt-1 truncate text-lg font-semibold md:text-2xl tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-ink-3" title={`Comparado a ${prevLabel}`}>
        {delta === null ? (
          "sem base de comparação"
        ) : (
          <>
            <span className={`tabular font-medium ${up ? "text-good" : "text-bad"}`}>
              {up ? "▲" : "▼"} {Math.abs(delta).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
            </span>
            <span className="hidden sm:inline"> vs. período anterior</span>
          </>
        )}
      </p>
      {note && <p className="tabular mt-1 text-xs text-bad">{note}</p>}
    </div>
  );
}
