import "server-only";
import { env } from "./env";
import type { Period } from "./period";
import type { Session } from "./session";
import { query } from "./sankhya/client";
import { date, dayKey, inList, int, limit } from "./sankhya/sql";

/**
 * Restrição de acesso — aplicada SEMPRE no servidor, a partir da sessão
 * criptografada (nunca de parâmetros enviados pelo navegador):
 *  - vendedor: apenas notas com o próprio CODVEND
 *  - gerente:  as notas da sua loja (TGFCAB.CODEMP = empresa do gerente)
 * O filtro opcional de vendedor do gerente é somado (AND) à restrição, então
 * nunca amplia o que ele pode ver.
 */
function scopeWhere(session: Session, vendedor?: number) {
  if (session.role === "vendedor") return [`CAB.CODVEND = ${int(session.codvend)}`];

  const clauses = [`CAB.CODEMP = ${int(session.codemp)}`];
  if (vendedor) clauses.push(`CAB.CODVEND = ${int(vendedor)}`);
  return clauses;
}

// Vendas somam, devoluções (na data em que ocorreram) subtraem
const isVenda = () => `CAB.CODTIPOPER IN (${inList(env().SALES_TOPS_VENDA)})`;
const isDevolucao = () => `CAB.CODTIPOPER IN (${inList(env().SALES_TOPS_DEVOLUCAO)})`;
const sign = () => `(CASE WHEN ${isDevolucao()} THEN -1 ELSE 1 END)`;
const countVendas = () => `SUM(CASE WHEN ${isVenda()} THEN 1 ELSE 0 END)`;

function salesWhere(session: Session, from: string, to: string, vendedor?: number) {
  const { SALES_TOPS_VENDA, SALES_TOPS_DEVOLUCAO } = env();
  const clauses = [
    `CAB.CODTIPOPER IN (${inList([...SALES_TOPS_VENDA, ...SALES_TOPS_DEVOLUCAO])})`,
    // Só notas com série (as notas fiscais emitidas)
    `CAB.SERIENOTA IS NOT NULL`,
    `CAB.SERIENOTA > 0`,
    `CAB.DTNEG >= ${date(from)}`,
    `CAB.DTNEG < ${date(addOneDay(to))}`,
    ...scopeWhere(session, vendedor),
  ];
  return `WHERE ${clauses.join("\n AND ")}`;
}

function addOneDay(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const n = (v: unknown) => (v == null || v === "" ? 0 : Number(v));
const s = (v: unknown) => (v == null ? "" : String(v).trim());

export interface Summary {
  /** faturamento líquido (vendas − devoluções) */
  total: number;
  devolucoes: number;
  pedidos: number;
  clientes: number;
  ticket: number;
}

export interface DashboardData {
  atual: Summary;
  anterior: Summary;
  diario: { dia: string; total: number; pedidos: number }[];
  produtos: { codigo: number; nome: string; quantidade: number; total: number }[];
  clientes: { codigo: number; nome: string; pedidos: number; total: number }[];
  vendedores: { codigo: number; nome: string; pedidos: number; total: number }[];
  pedidos: {
    nunota: number;
    numnota: number;
    dia: string;
    cliente: string;
    vendedor: string;
    total: number;
    devolucao: boolean;
  }[];
}

async function summary(session: Session, from: string, to: string, vendedor?: number): Promise<Summary> {
  const [row] = await query(
    `SELECT ${countVendas()} AS PEDIDOS,
            COALESCE(SUM(CASE WHEN ${isVenda()} THEN CAB.VLRNOTA ELSE 0 END), 0) AS BRUTO,
            COALESCE(SUM(CASE WHEN ${isDevolucao()} THEN CAB.VLRNOTA ELSE 0 END), 0) AS DEVOLUCOES,
            COUNT(DISTINCT CASE WHEN ${isVenda()} THEN CAB.CODPARC END) AS CLIENTES
       FROM TGFCAB CAB
     ${salesWhere(session, from, to, vendedor)}`,
  );
  const pedidos = n(row?.PEDIDOS);
  const devolucoes = n(row?.DEVOLUCOES);
  const total = n(row?.BRUTO) - devolucoes;
  return { total, devolucoes, pedidos, clientes: n(row?.CLIENTES), ticket: pedidos ? total / pedidos : 0 };
}

export async function getDashboardData(session: Session, period: Period, vendedor?: number): Promise<DashboardData> {
  const where = salesWhere(session, period.from, period.to, vendedor);
  const day = dayKey("CAB.DTNEG");
  const isManager = session.role === "gerente";

  const [atual, anterior, diario, produtos, clientes, vendedores, pedidos] = await Promise.all([
    summary(session, period.from, period.to, vendedor),
    summary(session, period.prevFrom, period.prevTo, vendedor),
    query(
      `SELECT ${day} AS DIA, SUM(CAB.VLRNOTA * ${sign()}) AS TOTAL, ${countVendas()} AS PEDIDOS
         FROM TGFCAB CAB
       ${where}
        GROUP BY ${day}
        ORDER BY 1`,
    ),
    query(
      limit(
        `SELECT PRO.CODPROD, PRO.DESCRPROD, SUM(ITE.QTDNEG * ${sign()}) AS QTD,
                SUM((ITE.VLRTOT - COALESCE(ITE.VLRDESC, 0)) * ${sign()}) AS TOTAL
           FROM TGFITE ITE
           JOIN TGFCAB CAB ON CAB.NUNOTA = ITE.NUNOTA
           JOIN TGFPRO PRO ON PRO.CODPROD = ITE.CODPROD
         ${where}
          GROUP BY PRO.CODPROD, PRO.DESCRPROD
          ORDER BY TOTAL DESC`,
        8,
      ),
    ),
    query(
      limit(
        `SELECT PAR.CODPARC, PAR.NOMEPARC, ${countVendas()} AS PEDIDOS, SUM(CAB.VLRNOTA * ${sign()}) AS TOTAL
           FROM TGFCAB CAB
           JOIN TGFPAR PAR ON PAR.CODPARC = CAB.CODPARC
         ${where}
          GROUP BY PAR.CODPARC, PAR.NOMEPARC
          ORDER BY TOTAL DESC`,
        8,
      ),
    ),
    isManager
      ? query(
          `SELECT VEN.CODVEND, VEN.APELIDO, ${countVendas()} AS PEDIDOS, SUM(CAB.VLRNOTA * ${sign()}) AS TOTAL
             FROM TGFCAB CAB
             JOIN TGFVEN VEN ON VEN.CODVEND = CAB.CODVEND
           ${where}
            GROUP BY VEN.CODVEND, VEN.APELIDO
            ORDER BY TOTAL DESC`,
        )
      : Promise.resolve([]),
    query(
      limit(
        `SELECT CAB.NUNOTA, CAB.NUMNOTA, ${day} AS DIA, PAR.NOMEPARC, VEN.APELIDO,
                CAB.VLRNOTA * ${sign()} AS VALOR,
                CASE WHEN ${isDevolucao()} THEN 'S' ELSE 'N' END AS DEVOLUCAO
           FROM TGFCAB CAB
           LEFT JOIN TGFPAR PAR ON PAR.CODPARC = CAB.CODPARC
           LEFT JOIN TGFVEN VEN ON VEN.CODVEND = CAB.CODVEND
         ${where}
          ORDER BY CAB.DTNEG DESC, CAB.NUNOTA DESC`,
        15,
      ),
    ),
  ]);

  return {
    atual,
    anterior,
    diario: diario.map((r) => ({ dia: s(r.DIA), total: n(r.TOTAL), pedidos: n(r.PEDIDOS) })),
    produtos: produtos.map((r) => ({ codigo: n(r.CODPROD), nome: s(r.DESCRPROD), quantidade: n(r.QTD), total: n(r.TOTAL) })),
    clientes: clientes.map((r) => ({ codigo: n(r.CODPARC), nome: s(r.NOMEPARC), pedidos: n(r.PEDIDOS), total: n(r.TOTAL) })),
    vendedores: vendedores.map((r) => ({ codigo: n(r.CODVEND), nome: s(r.APELIDO), pedidos: n(r.PEDIDOS), total: n(r.TOTAL) })),
    pedidos: pedidos.map((r) => ({
      nunota: n(r.NUNOTA),
      numnota: n(r.NUMNOTA),
      dia: s(r.DIA),
      cliente: s(r.NOMEPARC),
      vendedor: s(r.APELIDO),
      total: n(r.VALOR),
      devolucao: r.DEVOLUCAO === "S",
    })),
  };
}

/** Vendedores que o gerente pode filtrar (dentro do seu escopo). */
export async function getTeam(session: Session) {
  if (session.role !== "gerente") return [];
  const rows = await query(
    `SELECT VEN.CODVEND, VEN.APELIDO FROM TGFVEN VEN
      WHERE VEN.ATIVO = 'S' AND (VEN.CODEMP = ${int(session.codemp)} OR VEN.CODGER = ${int(session.codvend)})
      ORDER BY VEN.APELIDO`,
  );
  return rows.map((r) => ({ codigo: n(r.CODVEND), nome: s(r.APELIDO) }));
}
