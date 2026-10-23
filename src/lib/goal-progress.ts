import "server-only";
import { monthWorkdays } from "./feriados";
import { listGoalPeople, listGoals } from "./metas";
import { todayIso } from "./period";
import { goalMath, type GoalMath } from "./goal-math";
import { salesByStoreAndVendor } from "./sales";
import type { Session } from "./session";

/** Andamento das metas do mês atual. A conta (meta diária, saldo, ausências) está em goal-math.ts. */
export interface GoalLine extends GoalMath {
  chave: number;
  nome: string;
  realizado: number;
  hoje: number;
  /** loja da pessoa (na lista de vendedores de todas as lojas) */
  loja?: string;
}

export interface GoalProgress {
  mes: string;
  diasUteis: number;
  hojeUtil: boolean;
  principal: GoalLine;
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

  const line = (chave: number, nome: string, meta: number, realizado: number, hoje: number): GoalLine => ({
    chave,
    nome,
    realizado,
    hoje,
    ...goalMath({ meta, realizado, hoje, diasUteis: calendario.dias, today }),
  });
  const sum = (rows: typeof vendas) => ({ total: rows.reduce((a, r) => a + r.total, 0), hoje: rows.reduce((a, r) => a + r.hoje, 0) });
  const byRatio = (a: GoalLine, b: GoalLine) => b.realizado / (b.meta || 1) - a.realizado / (a.meta || 1);
  const base = { mes, diasUteis: calendario.dias.length, hojeUtil: calendario.dias.includes(today) };

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
