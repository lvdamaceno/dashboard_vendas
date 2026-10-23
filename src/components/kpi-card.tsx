interface Props {
  label: string;
  value: string;
  current: number;
  /** sem valor anterior, o cartão não mostra comparação */
  previous?: number;
  prevLabel: string;
  note?: string;
  /** a nota em vermelho (padrão) ou neutra */
  noteTone?: "bad" | "neutral";
  /** quando cair é bom (desconto, devolução): a seta para baixo fica verde */
  lowerIsBetter?: boolean;
}

export function KpiCard({ label, value, current, previous, prevLabel, note, noteTone = "bad", lowerIsBetter, className = "" }: Props & { className?: string }) {
  // Math.abs: com devoluções o período anterior pode ser negativo
  const delta = previous ? ((current - previous) / Math.abs(previous)) * 100 : null;
  const up = delta !== null && delta >= 0;
  const good = lowerIsBetter ? !up : up;

  return (
    <div className={`rounded-3xl border border-line bg-surface p-4 md:p-5 ${className}`}>
      <p className="text-xs text-ink-2 md:text-sm">{label}</p>
      <p className="tabular mt-1 truncate font-title text-xl font-semibold tracking-tight md:text-2xl">{value}</p>
      <p className="mt-1 text-xs text-ink-3" title={`Comparado a ${prevLabel}`}>
        {previous === undefined ? null : delta === null ? (
          "sem base de comparação"
        ) : (
          <>
            <span className={`tabular font-medium ${good ? "text-good" : "text-bad"}`}>
              {up ? "▲" : "▼"} {Math.abs(delta).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
            </span>
            <span className="hidden sm:inline"> vs. período anterior</span>
          </>
        )}
      </p>
      {note && <p className={`tabular mt-1 text-xs ${noteTone === "bad" ? "text-bad" : "text-ink-3"}`}>{note}</p>}
    </div>
  );
}
