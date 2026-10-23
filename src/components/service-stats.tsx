import Link from "next/link";
import { number, percent } from "@/lib/format";
import { conversao, type ServiceRow, type ServiceStats } from "@/lib/atendimentos";

const MOTIVOS = { preco: "Preço", sem_produto: "Não tinha o produto", vai_voltar: "Vai voltar", outro: "Outro" } as const;
const minutos = (m: number | null) => (m === null ? "—" : `${number(m)} min`);

function somar(linhas: ServiceRow[]) {
  const s = { total: 0, vendeu: 0, naoVendeu: 0, soOlhando: 0, semRegistro: 0, minutos: 0, comTempo: 0 };
  for (const l of linhas) {
    s.total += l.total;
    s.vendeu += l.vendeu;
    s.naoVendeu += l.naoVendeu;
    s.soOlhando += l.soOlhando;
    s.semRegistro += l.semRegistro;
    const encerrados = l.vendeu + l.naoVendeu + l.soOlhando;
    if (l.tempoMedio !== null) {
      s.minutos += l.tempoMedio * encerrados;
      s.comTempo += encerrados;
    }
  }
  return { ...s, tempoMedio: s.comTempo ? Math.round((s.minutos / s.comTempo) * 10) / 10 : null };
}

function Numero({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line p-3">
      <p className="text-xs text-ink-3">{label}</p>
      <p className="tabular mt-0.5 font-title text-xl font-semibold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-3">{hint}</p>}
    </div>
  );
}

/**
 * Atendimentos da fila no período: conversão (vendeu ÷ atendimentos com resultado), tempo médio e motivos de perda.
 * notas: notas de venda no Sankhya no mesmo período (por vendedor ou loja), para comparar com os atendimentos.
 */
export function ServiceStatsSection({
  stats,
  agrupar,
  notas,
  lojas,
}: {
  stats: ServiceStats;
  /** "vendedor": tabela por pessoa (gerente); "loja": por loja (diretoria); "nenhum": só o resumo (vendedor) */
  agrupar: "vendedor" | "loja" | "nenhum";
  notas?: { total: number; porChave: Map<number, number> };
  lojas?: { codigo: number; nome: string }[];
}) {
  const tot = somar(stats.linhas);
  // Sem atendimentos no período: o quadro aparece vazio, explicando de onde vêm os números
  if (!tot.total)
    return (
      <section className="rounded-3xl border border-dashed border-line bg-surface p-5">
        <h2 className="text-base">Atendimentos da fila</h2>
        <p className="mt-1 text-sm text-ink-2">
          {agrupar === "nenhum"
            ? "Você ainda não registrou atendimentos neste período. Na Fila, toque em Atender cliente quando começar e, ao terminar, em Terminei o atendimento, dizendo se vendeu."
            : "Ainda não há atendimentos registrados pela fila neste período. Eles aparecem quando os vendedores usam Atender cliente e Terminei o atendimento na Fila."}
        </p>
        <Link href="/fila" className="mt-3 inline-flex h-10 items-center rounded-full border border-line px-4 font-title text-sm font-medium text-accent hover:bg-bg-alt">
          Abrir a fila
        </Link>
      </section>
    );
  const conv = conversao(tot);

  // Por loja: soma as pessoas de cada loja
  const linhas =
    agrupar === "loja"
      ? [...Map.groupBy(stats.linhas, (l) => l.codemp)].map(([codemp, ls]) => ({
          chave: codemp,
          nome: lojas?.find((s) => s.codigo === codemp)?.nome.replace(/^CASA CONTENTE - /i, "") ?? `Loja ${codemp}`,
          ...somar(ls),
        }))
      : stats.linhas.map((l) => ({ chave: l.codvend, ...l }));
  const perdas = stats.motivos.reduce((a, m) => a + m.total, 0);

  return (
    <section className="rounded-3xl border border-line bg-surface p-5">
      <h2 className="text-base">Atendimentos da fila</h2>
      <p className="mb-3 text-xs text-ink-3">Registrados ao tocar em “Terminei o atendimento”</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Numero label="Atendimentos" value={number(tot.total)} hint={tot.semRegistro ? `${tot.semRegistro} sem resultado` : undefined} />
        <Numero label="Conversão" value={conv === null ? "—" : percent(conv)} hint={`${tot.vendeu} ${tot.vendeu === 1 ? "venda" : "vendas"}`} />
        <Numero label="Tempo médio" value={minutos(tot.tempoMedio)} />
        {notas ? (
          <Numero label="Notas no Sankhya" value={number(notas.total)} hint="vendas emitidas no período" />
        ) : (
          <Numero label="Só olhando" value={number(tot.soOlhando)} />
        )}
      </div>

      {agrupar !== "nenhum" && linhas.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-3">
                <th className="py-2 font-normal">{agrupar === "loja" ? "Loja" : "Vendedor"}</th>
                <th className="py-2 text-right font-normal">Atend.</th>
                <th className="py-2 text-right font-normal">Vendeu</th>
                <th className="py-2 text-right font-normal">Não vendeu</th>
                <th className="py-2 text-right font-normal">Só olhando</th>
                <th className="py-2 text-right font-normal">Conversão</th>
                <th className="py-2 text-right font-normal">Tempo médio</th>
                {notas && <th className="py-2 text-right font-normal">Notas</th>}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const c = conversao(l);
                return (
                  <tr key={l.chave} className="tabular border-b border-line last:border-0">
                    <td className="max-w-40 truncate py-2 font-medium">{l.nome}</td>
                    <td className="py-2 text-right">{l.total}</td>
                    <td className="py-2 text-right text-good">{l.vendeu}</td>
                    <td className="py-2 text-right text-bad">{l.naoVendeu}</td>
                    <td className="py-2 text-right">{l.soOlhando}</td>
                    <td className="py-2 text-right font-medium">{c === null ? "—" : percent(c)}</td>
                    <td className="py-2 text-right">{minutos(l.tempoMedio)}</td>
                    {notas && <td className="py-2 text-right">{notas.porChave.get(l.chave) ?? 0}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {perdas > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-medium">Por que não vendeu</h3>
          <ul className="space-y-2">
            {stats.motivos.map((m) => (
              <li key={m.motivo} className="text-sm">
                <div className="flex justify-between">
                  <span>{MOTIVOS[m.motivo]}</span>
                  <span className="tabular text-ink-3">
                    {m.total} · {percent(m.total / perdas)}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-bg-alt">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(m.total / perdas) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
