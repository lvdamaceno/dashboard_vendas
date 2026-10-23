import "server-only";
import { monthWorkdays } from "./feriados";
import { listGoals } from "./metas";
import { todayIso } from "./period";
import { getStoreVendors, salesByStoreAndVendor } from "./sales";
import type { Session } from "./session";

/**
 * Andamento das metas do mês atual.
 *  - meta diária base = meta do mês ÷ dias úteis do mês;
 *  - saldo = vendido até ontem − base × dias úteis que já passaram (positivo = sobra; negativo = devendo);
 *  - meta de hoje = base − saldo: quem vendeu mais tem meta menor hoje, quem vendeu menos, maior.
 */
export interface GoalLine {
  chave: number;
  nome: string;
  meta: number;
  realizado: number;
  hoje: number;
  /** meta diária base */
  base: number;
  saldo: number;
  /** null quando hoje não é dia útil */
  metaHoje: number | null;
  /** faturamento esperado no fim do mês, no ritmo atual (por dia útil) */
  projecao: number;
}

export interface GoalProgress {
  mes: string;
  diasUteis: number;
  /** dias úteis depois de hoje */
  restantes: number;
  hojeUtil: boolean;
  principal: GoalLine;
  /** Detalhe por vendedor (loja) ou por loja (todas as lojas) */
  detalhe: { titulo: string; linhas: GoalLine[] } | null;
}

export async function getGoalProgress(view: Session, stores: { codigo: number; nome: string }[], vendedor?: number): Promise<GoalProgress | null> {
  const today = todayIso();
  const mes = today.slice(0, 7);
  const loja = view.codemp;
  const allStores = (view.role === "master" || view.role === "admin") && !loja;

  const [calendario, metas, vendas] = await Promise.all([
    monthWorkdays(mes),
    listGoals(`${mes}-01`, view.role === "vendedor" || allStores ? undefined : loja),
    salesByStoreAndVendor(view, `${mes}-01`, today),
  ]);
  if (!metas.length || !calendario.dias.length) return null;

  const n = calendario.dias.length;
  const passados = calendario.dias.filter((d) => d < today).length;
  const hojeUtil = calendario.dias.includes(today);
  const decorridos = passados + (hojeUtil ? 1 : 0);

  const line = (chave: number, nome: string, meta: number, realizado: number, hoje: number): GoalLine => {
    const base = meta / n;
    const saldo = realizado - hoje - base * passados;
    return {
      chave,
      nome,
      meta,
      realizado,
      hoje,
      base,
      saldo,
      metaHoje: hojeUtil ? Math.max(0, base - saldo) : null,
      projecao: decorridos ? (realizado / decorridos) * n : 0,
    };
  };
  const sum = (rows: typeof vendas) => ({ total: rows.reduce((a, r) => a + r.total, 0), hoje: rows.reduce((a, r) => a + r.hoje, 0) });
  const base = { mes, diasUteis: n, restantes: n - decorridos, hojeUtil };

  // Vendedor: a própria meta (a consulta já vem só com as vendas dele)
  if (view.role === "vendedor") {
    const meta = metas.filter((m) => m.codvend === view.codvend).reduce((a, m) => a + m.valor, 0);
    if (!meta) return null;
    const s = sum(vendas);
    return { ...base, principal: line(view.codvend, view.apelido, meta, s.total, s.hoje), detalhe: null };
  }

  // Todas as lojas: soma das metas gerais, com o detalhe por loja
  if (allStores) {
    const gerais = metas.filter((m) => m.codvend === 0);
    if (!gerais.length) return null;
    const s = sum(vendas);
    const linhas = gerais
      .map((m) => {
        const t = sum(vendas.filter((v) => v.codemp === m.codemp));
        return line(m.codemp, stores.find((x) => x.codigo === m.codemp)?.nome ?? `Loja ${m.codemp}`, m.valor, t.total, t.hoje);
      })
      .sort((a, b) => b.realizado / b.meta - a.realizado / a.meta);
    const meta = gerais.reduce((a, m) => a + m.valor, 0);
    return { ...base, principal: line(0, "Todas as lojas", meta, s.total, s.hoje), detalhe: { titulo: "Metas por loja", linhas } };
  }

  // Uma loja (gerente, ou master/admin com loja escolhida)
  const nomes = await getStoreVendors(loja).catch(() => []);
  const nome = (codvend: number) => nomes.find((v) => v.codvend === codvend)?.nome ?? `Vendedor ${codvend}`;
  const individuais = metas
    .filter((m) => m.codvend > 0)
    .map((m) => {
      const t = sum(vendas.filter((v) => v.codvend === m.codvend));
      return line(m.codvend, nome(m.codvend), m.valor, t.total, t.hoje);
    })
    .sort((a, b) => b.realizado / b.meta - a.realizado / a.meta);

  if (vendedor) {
    const propria = individuais.find((l) => l.chave === vendedor);
    return propria ? { ...base, principal: propria, detalhe: null } : null;
  }
  const geral = metas.find((m) => m.codvend === 0);
  const s = sum(vendas);
  const principal = geral ? line(0, "Loja", geral.valor, s.total, s.hoje) : null;
  if (!principal && !individuais.length) return null;
  return {
    ...base,
    // Sem meta geral, o resumo soma as metas individuais
    principal: principal ?? line(0, "Equipe", individuais.reduce((a, l) => a + l.meta, 0), s.total, s.hoje),
    detalhe: individuais.length ? { titulo: "Metas da equipe", linhas: individuais } : null,
  };
}
