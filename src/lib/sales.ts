import "server-only";
import { env } from "./env";
import { addDays as addDaysIso, todayIso, type Period } from "./period";
import { normalizePhone } from "./phone";
import { isManagerial, type Session } from "./session";
import { query } from "./sankhya/client";
import { date, dayKey, inList, int, limit } from "./sankhya/sql";

/**
 * Restrição de acesso — aplicada SEMPRE no servidor, a partir da sessão
 * criptografada (nunca de parâmetros enviados pelo navegador):
 *  - vendedor: apenas notas com o próprio CODVEND
 *  - gerente:  as notas da sua loja (TGFCAB.CODEMP = empresa do gerente)
 *  - master/admin: a loja escolhida (codemp) ou todas (codemp 0)
 * O filtro opcional de vendedor do gerente é somado (AND) à restrição, então
 * nunca amplia o que ele pode ver.
 */
export function scopeWhere(session: Session, vendedor?: number) {
  if (session.role === "vendedor") return [`CAB.CODVEND = ${int(session.codvend)}`];

  const clauses = session.role === "gerente" || session.codemp ? [`CAB.CODEMP = ${int(session.codemp)}`] : [];
  if (vendedor) clauses.push(`CAB.CODVEND = ${int(vendedor)}`);
  return clauses;
}

// Vendas somam, devoluções (na data em que ocorreram) subtraem
export const isVenda = () => `CAB.CODTIPOPER IN (${inList(env().SALES_TOPS_VENDA)})`;
export const isDevolucao = () => `CAB.CODTIPOPER IN (${inList(env().SALES_TOPS_DEVOLUCAO)})`;
export const sign = () => `(CASE WHEN ${isDevolucao()} THEN -1 ELSE 1 END)`;
export const countVendas = () => `SUM(CASE WHEN ${isVenda()} THEN 1 ELSE 0 END)`;

/**
 * Nota com série numérica maior que zero. SERIENOTA é texto e há séries como 'CF ' (cupom),
 * que quebravam a comparação com número: aqui não há conversão — só dígitos (e espaços)
 * com algum dígito diferente de zero.
 */
export const serieValida = (alias: string) =>
  `(${alias}.SERIENOTA NOT LIKE '%[^0-9 ]%' AND ${alias}.SERIENOTA LIKE '%[1-9]%')`;

export function salesWhere(session: Session, from: string, to: string, vendedor?: number) {
  const { SALES_TOPS_VENDA, SALES_TOPS_DEVOLUCAO } = env();
  const clauses = [
    `CAB.CODTIPOPER IN (${inList([...SALES_TOPS_VENDA, ...SALES_TOPS_DEVOLUCAO])})`,
    // Só notas com série (as notas fiscais emitidas)
    serieValida("CAB"),
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

export const n = (v: unknown) => (v == null || v === "" ? 0 : Number(v));
export const s = (v: unknown) => (v == null ? "" : String(v).trim());

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
  /** só master/admin com todas as lojas */
  lojas: { codigo: number; pedidos: number; total: number }[];
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
  const isManager = isManagerial(session);

  const [atual, anterior, diario, produtos, clientes, vendedores, lojas, pedidos] = await Promise.all([
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
             JOIN TGFVEN VEN ON VEN.CODVEND = CAB.CODVEND AND VEN.ATIVO = 'S'
           ${where}
            GROUP BY VEN.CODVEND, VEN.APELIDO
            ORDER BY TOTAL DESC`,
        )
      : Promise.resolve([]),
    // Todas as lojas (master/admin): ranking por loja
    isManager && !session.codemp
      ? query(
          `SELECT CAB.CODEMP, ${countVendas()} AS PEDIDOS, SUM(CAB.VLRNOTA * ${sign()}) AS TOTAL
             FROM TGFCAB CAB
           ${where}
            GROUP BY CAB.CODEMP
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
    lojas: lojas.map((r) => ({ codigo: n(r.CODEMP), pedidos: n(r.PEDIDOS), total: n(r.TOTAL) })),
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

/**
 * Vendedores para o filtro do gerente (e de master/admin com loja escolhida): só os da
 * mesma loja (TGFVEN.CODEMP) que tiveram venda ou devolução no período. O vendedor já
 * selecionado continua na lista, para a caixa não ficar em branco.
 */
export async function getTeam(session: Session, period: Period, vendedor?: number) {
  if (!isManagerial(session) || !session.codemp) return [];
  const selected = vendedor ? ` OR VEN.CODVEND = ${int(vendedor)}` : "";
  const rows = await query(
    `SELECT VEN.CODVEND, VEN.APELIDO FROM TGFVEN VEN
      WHERE VEN.CODEMP = ${int(session.codemp)} AND VEN.ATIVO = 'S'
        AND (EXISTS (SELECT 1 FROM TGFCAB CAB
                     ${salesWhere(session, period.from, period.to)}
                       AND CAB.CODVEND = VEN.CODVEND)${selected})
      ORDER BY VEN.APELIDO`,
  );
  return rows.map((r) => ({ codigo: n(r.CODVEND), nome: s(r.APELIDO) }));
}

/** Lojas (empresas com vendedor ativo), para o filtro de master/admin e os avisos. */
export async function getStores() {
  const rows = await query(
    `SELECT EMP.CODEMP, EMP.NOMEFANTASIA FROM TSIEMP EMP
      WHERE EXISTS (SELECT 1 FROM TGFVEN VEN WHERE VEN.CODEMP = EMP.CODEMP AND VEN.ATIVO = 'S')
      ORDER BY EMP.CODEMP`,
    { ttlMs: 10 * 60_000 },
  );
  return rows.map((r) => ({ codigo: n(r.CODEMP), nome: s(r.NOMEFANTASIA) || `Loja ${n(r.CODEMP)}` }));
}

/** Lojas que vendem: as de getStores sem as empresas de META_LOJAS_FORA (ex.: Dr. Freitas, Ananindeua, Ultralog). */
export async function getSellingStores() {
  const fora = env().META_LOJAS_FORA;
  return (await getStores()).filter((s) => !fora.includes(s.codigo));
}

export interface Person {
  /** CODVEND (vendedor/gerente) ou painel.usuario_master.id (master) */
  codigo: number;
  nome: string;
  role: "vendedor" | "gerente" | "master";
  /** 0 para master (todas as lojas) */
  codemp: number;
}

/**
 * Vendedores e gerentes ativos (TGFVEN), para o admin escolher de quem ver o painel.
 * Mesma regra do login: TIPVEND S ou G é gerente da loja TGFVEN.CODEMP.
 */
export async function getPeople(): Promise<Person[]> {
  const rows = await query(
    `SELECT VEN.CODVEND, VEN.APELIDO, VEN.CODEMP, VEN.TIPVEND FROM TGFVEN VEN
      WHERE VEN.ATIVO = 'S' AND VEN.CODVEND > 0
      ORDER BY VEN.APELIDO`,
    { ttlMs: 5 * 60_000 },
  );
  return rows.map((r) => ({
    codigo: n(r.CODVEND),
    nome: s(r.APELIDO),
    role: r.TIPVEND === "S" || r.TIPVEND === "G" ? "gerente" : "vendedor",
    codemp: n(r.CODEMP),
  }));
}

/** Monta a visão de um vendedor/gerente para o admin (sempre relida do Sankhya pelo código). */
export async function personView(codvend: number) {
  const [r] = await query(
    `SELECT VEN.CODVEND, VEN.APELIDO, VEN.CODEMP, VEN.TIPVEND, COALESCE(VEN.CODFUNC, 0) AS CODFUNC
       FROM TGFVEN VEN
      WHERE VEN.ATIVO = 'S' AND VEN.CODVEND = ${int(codvend)}`,
    { ttlMs: 0 },
  );
  if (!r) return null;
  const gerente = r.TIPVEND === "S" || r.TIPVEND === "G";
  return {
    codfunc: n(r.CODFUNC),
    codvend: n(r.CODVEND),
    codemp: n(r.CODEMP),
    nome: s(r.APELIDO),
    apelido: s(r.APELIDO),
    role: gerente ? ("gerente" as const) : ("vendedor" as const),
  };
}

/** O cliente comprou dentro do escopo da sessão (vendedor: dele; gerente: da loja)? */
export async function clientInScope(session: Session, codparc: number) {
  const where = [`CAB.CODPARC = ${int(codparc)}`, isVenda(), ...scopeWhere(session)];
  const rows = await query(limit(`SELECT CAB.NUNOTA FROM TGFCAB CAB WHERE ${where.join(" AND ")} ORDER BY CAB.NUNOTA`, 1));
  return rows.length > 0;
}

export interface TeamPhone {
  codvend: number;
  nome: string;
  role: "vendedor" | "gerente";
  codemp: number;
  /** TFPFUN.TELEFONE do funcionário ligado ao vendedor (TSIUSU), já normalizado */
  sankhya: string | null;
}

/**
 * Vendedores e gerentes ativos com o telefone do Sankhya, para editar telefones:
 * com codemp, só os da loja (TGFVEN.CODEMP); sem, todos (admin).
 */
export async function getTeamPhones(codemp?: number): Promise<TeamPhone[]> {
  const rows = await query(
    `SELECT VEN.CODVEND, VEN.APELIDO, VEN.CODEMP, VEN.TIPVEND, FUN.TELEFONE
       FROM TGFVEN VEN
       LEFT JOIN TSIUSU USU ON USU.CODVEND = VEN.CODVEND
       LEFT JOIN TFPFUN FUN ON FUN.CODEMP = USU.CODEMP AND FUN.CODFUNC = USU.CODFUNC
      WHERE VEN.ATIVO = 'S' AND VEN.CODVEND > 0${codemp ? ` AND VEN.CODEMP = ${int(codemp)}` : ""}
      ORDER BY VEN.APELIDO`,
  );
  // Um vendedor pode estar ligado a mais de um usuário: fica o primeiro telefone válido
  const byCode = new Map<number, TeamPhone>();
  for (const r of rows) {
    const codvend = n(r.CODVEND);
    const tel = normalizePhone(r.TELEFONE);
    const current = byCode.get(codvend);
    if (current) {
      current.sankhya ??= tel;
      continue;
    }
    byCode.set(codvend, {
      codvend,
      nome: s(r.APELIDO),
      role: r.TIPVEND === "S" || r.TIPVEND === "G" ? "gerente" : "vendedor",
      codemp: n(r.CODEMP),
      sankhya: tel,
    });
  }
  return [...byCode.values()];
}

/** Loja (TGFVEN.CODEMP) de um vendedor ativo, ou null. ttlMs: 0 nas checagens de permissão. */
export async function vendorStore(codvend: number, ttlMs = 0) {
  const [r] = await query(`SELECT VEN.CODEMP FROM TGFVEN VEN WHERE VEN.ATIVO = 'S' AND VEN.CODVEND = ${int(codvend)}`, { ttlMs });
  return r ? n(r.CODEMP) : null;
}

/** Vendedores e gerentes ativos de uma loja (TGFVEN.CODEMP), para as metas individuais. */
export async function getStoreVendors(codemp: number) {
  const rows = await query(
    `SELECT VEN.CODVEND, VEN.APELIDO, VEN.TIPVEND FROM TGFVEN VEN
      WHERE VEN.ATIVO = 'S' AND VEN.CODVEND > 0 AND VEN.CODEMP = ${int(codemp)}
      ORDER BY VEN.APELIDO`,
    { ttlMs: 5 * 60_000 },
  );
  return rows.map((r) => ({
    codvend: n(r.CODVEND),
    nome: s(r.APELIDO),
    role: r.TIPVEND === "S" || r.TIPVEND === "G" ? ("gerente" as const) : ("vendedor" as const),
  }));
}

/**
 * Faturamento líquido por loja e vendedor de from até hoje, dentro do escopo da sessão (para as metas),
 * com o que foi vendido só hoje separado.
 */
export async function salesByStoreAndVendor(session: Session, from: string, today: string) {
  const rows = await query(
    `SELECT CAB.CODEMP, CAB.CODVEND, SUM(CAB.VLRNOTA * ${sign()}) AS TOTAL,
            SUM(CASE WHEN CAB.DTNEG >= ${date(today)} THEN CAB.VLRNOTA * ${sign()} ELSE 0 END) AS HOJE
       FROM TGFCAB CAB
     ${salesWhere(session, from, today)}
      GROUP BY CAB.CODEMP, CAB.CODVEND`,
  );
  return rows.map((r) => ({ codemp: n(r.CODEMP), codvend: n(r.CODVEND), total: n(r.TOTAL), hoje: n(r.HOJE) }));
}

/**
 * Quem vendeu em cada loja nos últimos dias (candidatos às "pessoas consideradas" das metas). O cadastro de
 * vendedores (TGFVEN) tem caixas e códigos internos; quem realmente vende aparece nas notas. Só master e admin usam.
 */
export async function salesPeopleByStore(days = 90) {
  const today = todayIso();
  const rows = await query(
    `SELECT CAB.CODEMP, VEN.CODVEND, VEN.APELIDO, COUNT(*) AS NOTAS
       FROM TGFCAB CAB
       JOIN TGFVEN VEN ON VEN.CODVEND = CAB.CODVEND AND VEN.ATIVO = 'S'
      WHERE ${isVenda()} AND ${serieValida("CAB")} AND CAB.DTNEG >= ${date(addDaysIso(today, -days))}
      GROUP BY CAB.CODEMP, VEN.CODVEND, VEN.APELIDO
      ORDER BY CAB.CODEMP, NOTAS DESC`,
    { ttlMs: 10 * 60_000 },
  );
  return rows.map((r) => ({ codemp: n(r.CODEMP), codvend: n(r.CODVEND), nome: s(r.APELIDO), notas: n(r.NOTAS) }));
}

/** Faturamento líquido (vendas − devoluções) de um intervalo, no escopo da sessão. */
export async function netSales(session: Session, from: string, to: string, vendedor?: number) {
  return (await summary(session, from, to, vendedor)).total;
}
