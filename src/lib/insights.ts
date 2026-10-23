import "server-only";
import { env } from "./env";
import { addDays, todayIso, type Period } from "./period";
import { countVendas, isDevolucao, isVenda, n, s, salesWhere, scopeWhere, serieValida, sign } from "./sales";
import { listDismissedClients } from "./painel";
import { isManagerial, type Session } from "./session";
import { query } from "./sankhya/client";
import { date, dayKey, inList, limit } from "./sankhya/sql";

/**
 * Indicadores complementares do painel. Cada um roda numa consulta própria e, se falhar
 * (ex.: coluna que não existe nesta base do Sankhya), só aquele bloco deixa de aparecer.
 * Todas usam o mesmo escopo de vendas.ts (vendedor/loja vindos da sessão).
 */

const item = `(ITE.VLRTOT - COALESCE(ITE.VLRDESC, 0))`;

export interface VendorStats {
  codigo: number;
  nome: string;
  /** TGFVEN.ATIVO: inativos saem da tabela, mas contam nos totais da loja */
  ativo: boolean;
  /** peças vendidas (QTDNEG) e notas de venda */
  pecas: number;
  pedidos: number;
  /** valor dos itens antes do desconto e desconto concedido nos itens */
  bruto: number;
  desconto: number;
  /** valor líquido dos itens devolvidos */
  devolvido: number;
}

export interface Margin {
  /** receita dos itens que têm custo cadastrado */
  receita: number;
  custo: number;
  /** fração da receita total que tem custo (para avisar quando a margem é parcial) */
  cobertura: number;
}

/** Cada indicador chega por conta própria (a tela mostra cada bloco quando o dele termina). */
export type InsightPromises = { [K in keyof Insights]: Promise<Insights[K]> };

export interface Insights {
  vendedores: { atual: VendorStats[]; anterior: VendorStats[] } | null;
  margem: { atual: Margin; anterior: Margin } | null;
  clientes: { total: number; novos: number } | null;
  categorias: { codigo: number; nome: string; quantidade: number; total: number }[] | null;
  devolvidos: { codigo: number; nome: string; quantidade: number; total: number }[] | null;
  /** 0 = segunda-feira */
  semana: { dia: number; total: number; pedidos: number }[] | null;
  horas: { hora: number; total: number; pedidos: number }[] | null;
  sumidos: { codigo: number; nome: string; telefone: string | null; ultima: string; compras: number; total: number }[] | null;
}

/** Clientes "sumidos": compraram ao menos SUMIDO_COMPRAS vezes no último ano e não voltam há SUMIDO_DIAS dias. */
export const SUMIDO_DIAS = 60;
export const SUMIDO_COMPRAS = 2;
/** Quantos clientes sumidos trazer (a tela mostra de 10 em 10) */
const SUMIDO_MAX = 100;

async function safe<T>(name: string, run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch (err) {
    console.error(`[indicadores] ${name}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

async function vendorStats(session: Session, from: string, to: string, vendedor?: number): Promise<VendorStats[]> {
  const rows = await query(
    `SELECT CAB.CODVEND, VEN.APELIDO, VEN.ATIVO,
            SUM(CASE WHEN ${isVenda()} THEN ITE.QTDNEG ELSE 0 END) AS PECAS,
            COUNT(DISTINCT CASE WHEN ${isVenda()} THEN CAB.NUNOTA END) AS PEDIDOS,
            SUM(CASE WHEN ${isVenda()} THEN ITE.VLRTOT ELSE 0 END) AS BRUTO,
            SUM(CASE WHEN ${isVenda()} THEN COALESCE(ITE.VLRDESC, 0) ELSE 0 END) AS DESCONTO,
            SUM(CASE WHEN ${isDevolucao()} THEN ${item} ELSE 0 END) AS DEVOLVIDO
       FROM TGFITE ITE
       JOIN TGFCAB CAB ON CAB.NUNOTA = ITE.NUNOTA
       LEFT JOIN TGFVEN VEN ON VEN.CODVEND = CAB.CODVEND
     ${salesWhere(session, from, to, vendedor)}
      GROUP BY CAB.CODVEND, VEN.APELIDO, VEN.ATIVO`,
  );
  return rows.map((r) => ({
    codigo: n(r.CODVEND),
    nome: s(r.APELIDO) || `Vendedor ${n(r.CODVEND)}`,
    ativo: r.ATIVO === "S",
    pecas: n(r.PECAS),
    pedidos: n(r.PEDIDOS),
    bruto: n(r.BRUTO),
    desconto: n(r.DESCONTO),
    devolvido: n(r.DEVOLVIDO),
  }));
}

// Custo do produto na data da venda: o registro mais recente de TGFCUS até aquele dia
async function margin(session: Session, from: string, to: string, vendedor?: number): Promise<Margin> {
  const [row] = await query(
    `SELECT SUM(${item} * ${sign()}) AS RECEITA,
            SUM(CASE WHEN CUS.CUSTO IS NOT NULL THEN ${item} * ${sign()} ELSE 0 END) AS RECEITA_COM_CUSTO,
            SUM(COALESCE(CUS.CUSTO, 0) * ITE.QTDNEG * ${sign()}) AS CUSTO
       FROM TGFITE ITE
       JOIN TGFCAB CAB ON CAB.NUNOTA = ITE.NUNOTA
      OUTER APPLY (
            SELECT TOP 1 C.${env().MARGEM_CUSTO} AS CUSTO
              FROM TGFCUS C
             WHERE C.CODPROD = ITE.CODPROD AND C.CODEMP = CAB.CODEMP AND C.DTATUAL <= CAB.DTNEG
             ORDER BY C.DTATUAL DESC) CUS
     ${salesWhere(session, from, to, vendedor)}`,
  );
  const receita = n(row?.RECEITA);
  const comCusto = n(row?.RECEITA_COM_CUSTO);
  return { receita: comCusto, custo: n(row?.CUSTO), cobertura: receita ? comCusto / receita : 0 };
}

export function getInsights(session: Session, period: Period, vendedor?: number): InsightPromises {
  const where = salesWhere(session, period.from, period.to, vendedor);
  const vendas = `${where}\n AND ${isVenda()}`;
  const today = todayIso();
  const isManager = isManagerial(session);
  const weekday = `(DATEDIFF(DAY, ${date("1900-01-01")}, CAB.DTNEG) % 7)`; // 01/01/1900 foi segunda-feira
  const hhmm = `FLOOR(CAB.HRMOV / 100)`;

  const [vendedores, margem, clientes, categorias, devolvidos, semana, horas, sumidos] = [
    safe("vendedores", async () => {
      const [atual, anterior] = await Promise.all([
        vendorStats(session, period.from, period.to, vendedor),
        vendorStats(session, period.prevFrom, period.prevTo, vendedor),
      ]);
      return { atual, anterior };
    }),
    isManager
      ? safe("margem", async () => {
          const [atual, anterior] = await Promise.all([
            margin(session, period.from, period.to, vendedor),
            margin(session, period.prevFrom, period.prevTo, vendedor),
          ]);
          return { atual, anterior };
        })
      : Promise.resolve(null),
    // Novo = a primeira compra (em qualquer loja) foi dentro do período
    safe("clientes novos", async () => {
      const [row] = await query(
        `SELECT COUNT(*) AS CLIENTES,
                SUM(CASE WHEN P.PRIMEIRA >= ${date(period.from)} THEN 1 ELSE 0 END) AS NOVOS
           FROM (SELECT DISTINCT CAB.CODPARC FROM TGFCAB CAB ${vendas}) C
          OUTER APPLY (
                SELECT MIN(OLD.DTNEG) AS PRIMEIRA
                  FROM TGFCAB OLD
                 WHERE OLD.CODPARC = C.CODPARC
                   AND OLD.CODTIPOPER IN (${inList(env().SALES_TOPS_VENDA)})
                   AND ${serieValida("OLD")}) P`,
      );
      return { total: n(row?.CLIENTES), novos: n(row?.NOVOS) };
    }),
    safe("categorias", async () => {
      const rows = await query(
        limit(
          `SELECT GRU.CODGRUPOPROD, GRU.DESCRGRUPOPROD, SUM(ITE.QTDNEG * ${sign()}) AS QTD, SUM(${item} * ${sign()}) AS TOTAL
             FROM TGFITE ITE
             JOIN TGFCAB CAB ON CAB.NUNOTA = ITE.NUNOTA
             JOIN TGFPRO PRO ON PRO.CODPROD = ITE.CODPROD
             JOIN TGFGRU GRU ON GRU.CODGRUPOPROD = PRO.CODGRUPOPROD
           ${where}
            GROUP BY GRU.CODGRUPOPROD, GRU.DESCRGRUPOPROD
            ORDER BY TOTAL DESC`,
          8,
        ),
      );
      return rows.map((r) => ({ codigo: n(r.CODGRUPOPROD), nome: s(r.DESCRGRUPOPROD), quantidade: n(r.QTD), total: n(r.TOTAL) }));
    }),
    safe("produtos devolvidos", async () => {
      const rows = await query(
        limit(
          `SELECT PRO.CODPROD, PRO.DESCRPROD, SUM(ITE.QTDNEG) AS QTD, SUM(${item}) AS TOTAL
             FROM TGFITE ITE
             JOIN TGFCAB CAB ON CAB.NUNOTA = ITE.NUNOTA
             JOIN TGFPRO PRO ON PRO.CODPROD = ITE.CODPROD
           ${where}
              AND ${isDevolucao()}
            GROUP BY PRO.CODPROD, PRO.DESCRPROD
            ORDER BY TOTAL DESC`,
          5,
        ),
      );
      return rows.map((r) => ({ codigo: n(r.CODPROD), nome: s(r.DESCRPROD), quantidade: n(r.QTD), total: n(r.TOTAL) }));
    }),
    safe("dia da semana", async () => {
      const rows = await query(
        `SELECT ${weekday} AS DIA, SUM(CAB.VLRNOTA * ${sign()}) AS TOTAL, ${countVendas()} AS PEDIDOS
           FROM TGFCAB CAB
         ${where}
          GROUP BY ${weekday}`,
      );
      return rows.map((r) => ({ dia: n(r.DIA), total: n(r.TOTAL), pedidos: n(r.PEDIDOS) })).sort((a, b) => a.dia - b.dia);
    }),
    // HRMOV guarda a hora como HHMM ou HHMMSS; agrupa por HRMOV/100 e descobre o formato pelos valores
    safe("horário", async () => {
      const rows = await query(
        `SELECT ${hhmm} AS HHMM, SUM(CAB.VLRNOTA * ${sign()}) AS TOTAL, ${countVendas()} AS PEDIDOS
           FROM TGFCAB CAB
         ${where}
            AND CAB.HRMOV IS NOT NULL
          GROUP BY ${hhmm}`,
      );
      const values = rows.map((r) => ({ v: n(r.HHMM), total: n(r.TOTAL), pedidos: n(r.PEDIDOS) }));
      const seconds = values.some((r) => r.v > 23);
      const byHour = new Map<number, { hora: number; total: number; pedidos: number }>();
      for (const r of values) {
        const hora = seconds ? Math.floor(r.v / 100) : r.v;
        if (hora < 0 || hora > 23) continue;
        const acc = byHour.get(hora) ?? { hora, total: 0, pedidos: 0 };
        acc.total += r.total;
        acc.pedidos += r.pedidos;
        byHour.set(hora, acc);
      }
      return [...byHour.values()].sort((a, b) => a.hora - b.hora);
    }),
    // Não depende do período escolhido: olha o último ano até hoje
    safe("clientes sumidos", async () => {
      const clauses = [
        isVenda(),
        serieValida("CAB"),
        `CAB.CODPARC > 0`,
        `CAB.DTNEG >= ${date(addDays(today, -365))}`,
        ...scopeWhere(session, vendedor),
      ];
      // Dispensados pelo vendedor (não querem voltar) somem até comprarem de novo; sem o banco, mostra todos
      const dismissed = await listDismissedClients().catch((err) => {
        console.error("[indicadores] clientes dispensados:", err instanceof Error ? err.message : err);
        return new Map<number, string>();
      });
      const rows = await query(
        limit(
          `SELECT PAR.CODPARC, PAR.NOMEPARC, PAR.TELEFONE, ${dayKey("MAX(CAB.DTNEG)")} AS ULTIMA,
                  COUNT(DISTINCT CAB.NUNOTA) AS COMPRAS, SUM(CAB.VLRNOTA) AS TOTAL
             FROM TGFCAB CAB
             JOIN TGFPAR PAR ON PAR.CODPARC = CAB.CODPARC
            WHERE ${clauses.join("\n AND ")}
            GROUP BY PAR.CODPARC, PAR.NOMEPARC, PAR.TELEFONE
           HAVING MAX(CAB.DTNEG) < ${date(addDays(today, -SUMIDO_DIAS))} AND COUNT(DISTINCT CAB.NUNOTA) >= ${SUMIDO_COMPRAS}
            ORDER BY TOTAL DESC`,
          SUMIDO_MAX + Math.min(dismissed.size, 200),
        ),
      );
      const visible = rows.filter((r) => {
        const dia = dismissed.get(n(r.CODPARC));
        return !dia || s(r.ULTIMA) > dia;
      });
      return visible.slice(0, SUMIDO_MAX).map((r) => ({
        codigo: n(r.CODPARC),
        nome: s(r.NOMEPARC),
        telefone: phone(r.TELEFONE),
        ultima: s(r.ULTIMA),
        compras: n(r.COMPRAS),
        total: n(r.TOTAL),
      }));
    }),
  ] as const;

  return { vendedores, margem, clientes, categorias, devolvidos, semana, horas, sumidos };
}

/** Celular com DDD (só dígitos, sem 55), ou null se não der para abrir no WhatsApp. */
function phone(v: unknown) {
  const tel = String(v ?? "").replace(/\D/g, "").replace(/^0+/, "").replace(/^55(?=\d{10,11}$)/, "");
  return tel.length === 10 || tel.length === 11 ? tel : null;
}
