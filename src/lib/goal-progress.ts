import "server-only";
import { monthWorkdays } from "./feriados";
import { listGoalPeople, listGoals } from "./metas";
import { todayIso } from "./period";
import { salesByStoreAndVendor } from "./sales";
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
  /** quanto vender por dia útil, depois de hoje, para bater a meta (null: não restam dias ou já bateu) */
  ritmoNecessario: number | null;
  /** loja da pessoa (na lista de vendedores de todas as lojas) */
  loja?: string;
}

export interface GoalProgress {
  mes: string;
  diasUteis: number;
  /** dias úteis depois de hoje */
  restantes: number;
  hojeUtil: boolean;
  principal: GoalLine;
  /** dias úteis depois de hoje (para o ritmo necessário) */
  diasDepoisDeHoje: number;
  /** Listas de detalhe: por vendedor (loja) ou por loja e por vendedor (todas as lojas) */
  detalhes: { titulo: string; linhas: GoalLine[] }[];
}

export async function getGoalProgress(view: Session, stores: { codigo: number; nome: string }[], vendedor?: number): Promise<GoalProgress | null> {
  const today = todayIso();
  const mes = today.slice(0, 7);
  const loja = view.codemp;
  const allStores = (view.role === "master" || view.role === "admin") && !loja;

  const [calendario, metas, pessoas, vendas] = await Promise.all([
    monthWorkdays(mes),
    listGoals(`${mes}-01`, view.role === "vendedor" || allStores ? undefined : loja),
    // Quem conta na meta individual de cada loja (marcado em /metas)
    listGoalPeople(`${mes}-01`),
    salesByStoreAndVendor(view, `${mes}-01`, today),
  ]);
  if (!metas.size || !calendario.dias.length) return null;

  const n = calendario.dias.length;
  const passados = calendario.dias.filter((d) => d < today).length;
  const hojeUtil = calendario.dias.includes(today);
  const decorridos = passados + (hojeUtil ? 1 : 0);

  const depois = n - decorridos;
  const line = (chave: number, nome: string, meta: number, realizado: number, hoje: number): GoalLine => {
    const base = meta / n;
    const saldo = realizado - hoje - base * passados;
    return {
      ritmoNecessario: depois > 0 && realizado < meta ? (meta - realizado) / depois : null,
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
  const byRatio = (a: GoalLine, b: GoalLine) => b.realizado / b.meta - a.realizado / a.meta;
  const base = { mes, diasUteis: n, restantes: n - decorridos, hojeUtil, diasDepoisDeHoje: depois };

  // Vendedor: a meta individual da loja em que foi considerado, com as vendas dele nessa loja
  if (view.role === "vendedor") {
    const eu = pessoas.find((p) => p.codvend === view.codvend);
    const meta = eu ? metas.get(eu.codemp)?.vendedor : null;
    if (!eu || !meta) return null;
    const s = sum(vendas.filter((v) => v.codemp === eu.codemp));
    return { ...base, principal: line(view.codvend, view.apelido, meta, s.total, s.hoje), detalhes: [] };
  }

  // Todas as lojas: soma das metas das lojas, com o detalhe por loja
  if (allStores) {
    const linhas = [...metas]
      .filter(([, g]) => g.loja)
      .map(([codemp, g]) => {
        const t = sum(vendas.filter((v) => v.codemp === codemp));
        return line(codemp, stores.find((x) => x.codigo === codemp)?.nome ?? `Loja ${codemp}`, g.loja!, t.total, t.hoje);
      })
      .sort(byRatio);
    if (!linhas.length) return null;
    const s = sum(vendas);
    const meta = linhas.reduce((a, l) => a + l.meta, 0);
    // Todas as pessoas consideradas, de todas as lojas, num ranking só (vendas de cada uma na loja dela)
    const nomeLoja = (codemp: number) => stores.find((x) => x.codigo === codemp)?.nome.replace(/^CASA CONTENTE - /i, "") ?? `Loja ${codemp}`;
    const pessoasLinhas = pessoas
      .filter((p) => metas.get(p.codemp)?.vendedor)
      .map((p) => {
        const t = sum(vendas.filter((v) => v.codemp === p.codemp && v.codvend === p.codvend));
        return { ...line(p.codvend, p.nome, metas.get(p.codemp)!.vendedor!, t.total, t.hoje), loja: nomeLoja(p.codemp) };
      })
      .sort(byRatio);
    return {
      ...base,
      principal: line(0, "Todas as lojas", meta, s.total, s.hoje),
      detalhes: [{ titulo: "Metas por loja", linhas }, ...(pessoasLinhas.length ? [{ titulo: "Metas por vendedor (todas as lojas)", linhas: pessoasLinhas }] : [])],
    };
  }

  // Uma loja (gerente, ou master/admin com loja escolhida)
  const metaLoja = metas.get(loja);
  if (!metaLoja) return null;
  const porVendedor = metaLoja.vendedor;
  // Pessoas marcadas nesta loja, com as vendas delas aqui
  const individuais = porVendedor
    ? pessoas
        .filter((p) => p.codemp === loja)
        .map((p) => {
          const t = sum(vendas.filter((x) => x.codvend === p.codvend));
          return line(p.codvend, p.nome, porVendedor, t.total, t.hoje);
        })
        .sort(byRatio)
    : [];

  if (vendedor) {
    const propria = individuais.find((l) => l.chave === vendedor);
    return propria ? { ...base, principal: propria, detalhes: [] } : null;
  }
  const s = sum(vendas);
  // Sem meta da loja, o resumo usa a soma das metas dos vendedores
  const metaTotal = metaLoja.loja ?? individuais.reduce((a, l) => a + l.meta, 0);
  if (!metaTotal) return null;
  return {
    ...base,
    principal: line(0, "Loja", metaTotal, s.total, s.hoje),
    detalhes: individuais.length ? [{ titulo: "Metas da equipe", linhas: individuais }] : [],
  };
}
