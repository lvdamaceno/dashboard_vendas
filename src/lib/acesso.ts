import "server-only";
import { EncryptJWT, jwtDecrypt } from "jose";
import { sql } from "./db";
import { sessionKey, userKey, type Session } from "./session";

// Controle de acesso configurado no admin (aba "Horário e local"), por grupo (papel):
//  - horário: o painel só abre nas janelas de cada dia da semana (horário de Brasília);
//  - local: só abre com o aparelho perto de um dos locais cadastrados (lojas e outros endereços).
// Quem confere é o proxy (src/proxy.ts), a cada página. Diretoria (master) e admin nunca são bloqueados.
// A localização vem do navegador: impede o uso comum fora da loja, mas quem souber falsificar o GPS passa.

export type Papel = "vendedor" | "gerente";
export const PAPEIS: { value: Papel; label: string }[] = [
  { value: "vendedor", label: "Vendedores" },
  { value: "gerente", label: "Gerentes" },
];

/** Horários "HH:MM", início inclusivo e fim exclusivo */
export interface Janela {
  inicio: string;
  fim: string;
}

export interface Regra {
  papel: Papel;
  horario: boolean;
  /** 7 posições, 0 = domingo … 6 = sábado; null = não abre no dia */
  janelas: (Janela | null)[];
  local: boolean;
  autorNome: string | null;
  atualizadoEm: Date | null;
}

export interface Local {
  id: number;
  nome: string;
  endereco: string | null;
  lat: number;
  lng: number;
  /** Metros */
  raio: number;
  ativo: boolean;
}

// --- horário ---

const TZ = "America/Sao_Paulo";
const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const fmtAgora = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** Dia da semana e minutos desde a meia-noite, no horário de Brasília. */
export function nowInBrasilia(d = new Date()) {
  const parts = Object.fromEntries(fmtAgora.formatToParts(d).map((p) => [p.type, p.value]));
  return { dia: WEEKDAY[parts.weekday], minutos: Number(parts.hour) * 60 + Number(parts.minute) };
}

const minutos = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

export function withinSchedule(janelas: (Janela | null)[], agora = nowInBrasilia()) {
  const j = janelas[agora.dia];
  return !!j && minutos(j.inicio) <= agora.minutos && agora.minutos < minutos(j.fim);
}

/** Mensagem para quem está fora do horário; null = dentro do horário. */
export function scheduleBlock(janelas: (Janela | null)[], agora = nowInBrasilia()): string | null {
  if (withinSchedule(janelas, agora)) return null;
  const hoje = janelas[agora.dia];
  if (hoje && agora.minutos < minutos(hoje.inicio)) return `Fora do horário de acesso. Hoje o painel abre às ${hoje.inicio}.`;
  for (let i = 1; i <= 7; i++) {
    const dia = (agora.dia + i) % 7;
    const j = janelas[dia];
    if (j) return `Fora do horário de acesso. O painel abre ${i === 1 ? "amanhã" : i === 7 ? `na próxima ${DIAS[dia]}` : DIAS[dia]} às ${j.inicio}.`;
  }
  return "O acesso ao painel está fechado em todos os dias da semana. Fale com o administrador.";
}

// --- local ---

/** Distância em metros entre dois pontos (fórmula de haversine). */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/** Localização com precisão pior que isso (ex.: computador sem Wi-Fi, só pelo IP) é recusada. */
export const MAX_PRECISAO = 1000;
/** Folga somada ao raio para compensar o erro do GPS, até este limite. */
const FOLGA_MAX = 100;

export type PlaceCheck =
  | { ok: true; local: Local; distancia: number }
  | { ok: false; motivo: "impreciso" | "longe"; maisPerto?: { nome: string; distancia: number } };

export function checkPlace(locais: Local[], pos: { lat: number; lng: number; precisao: number }): PlaceCheck {
  if (pos.precisao > MAX_PRECISAO) return { ok: false, motivo: "impreciso" };
  const perto = locais
    .filter((l) => l.ativo)
    .map((local) => ({ local, distancia: Math.round(distanceM(local, pos)) }))
    .sort((a, b) => a.distancia - b.distancia);
  const dentro = perto.find((p) => p.distancia <= p.local.raio + Math.min(pos.precisao, FOLGA_MAX));
  if (dentro) return { ok: true, ...dentro };
  return { ok: false, motivo: "longe", maisPerto: perto[0] && { nome: perto[0].local.nome, distancia: perto[0].distancia } };
}

// --- regras no banco (com cache curto: o proxy consulta a cada página) ---

interface Config {
  at: number;
  regras: Map<Papel, Regra>;
  locais: Local[];
}

const TTL_MS = 30_000;
// Em globalThis: o proxy e as páginas podem carregar este módulo separadamente no mesmo processo
const g = globalThis as unknown as { __painelAcesso?: Config | null };

const REGRA_COLS = `papel, horario, janelas, local, autor_nome AS "autorNome", atualizado_em AS "atualizadoEm"`;
const LOCAL_COLS = `id, nome, endereco, lat, lng, raio, ativo`;

async function accessConfig(): Promise<Config> {
  const cached = g.__painelAcesso;
  if (cached && Date.now() - cached.at < TTL_MS) return cached;
  try {
    const [regras, locais] = await Promise.all([listAccessRules(), listPlaces()]);
    g.__painelAcesso = { at: Date.now(), regras: new Map(regras.map((r) => [r.papel, r])), locais };
  } catch (err) {
    // Sem o banco do painel o acesso fica liberado (como o resto do painel, que continua funcionando sem ele)
    console.error("[acesso] não foi possível ler as regras de horário e local; acesso liberado:", err instanceof Error ? err.message : err);
    g.__painelAcesso = { at: Date.now(), regras: new Map(), locais: [] };
  }
  return g.__painelAcesso!;
}

export function invalidateAccessConfig() {
  g.__painelAcesso = null;
}

export interface Exigencias {
  /** Janelas de horário a respeitar; null = qualquer horário */
  horario: (Janela | null)[] | null;
  /** Locais aceitos; null = de qualquer lugar (sem regra ou sem nenhum local ativo) */
  locais: Local[] | null;
}

/** O que vale para quem entrou com este papel. */
export async function requirements(role: Session["role"]): Promise<Exigencias> {
  if (role !== "vendedor" && role !== "gerente") return { horario: null, locais: null };
  const { regras, locais } = await accessConfig();
  const r = regras.get(role);
  const ativos = locais.filter((l) => l.ativo);
  return { horario: r?.horario ? r.janelas : null, locais: r?.local && ativos.length ? ativos : null };
}

export async function listAccessRules() {
  return sql<Regra>(`SELECT ${REGRA_COLS} FROM painel.acesso_regra`);
}

export async function saveAccessRule(r: Pick<Regra, "papel" | "horario" | "janelas" | "local">, autorNome: string) {
  await sql(
    `INSERT INTO painel.acesso_regra (papel, horario, janelas, local, autor_nome) VALUES ($1, $2, $3::jsonb, $4, $5)
     ON CONFLICT (papel) DO UPDATE SET horario = EXCLUDED.horario, janelas = EXCLUDED.janelas, local = EXCLUDED.local,
       autor_nome = EXCLUDED.autor_nome, atualizado_em = now()`,
    [r.papel, r.horario, JSON.stringify(r.janelas), r.local, autorNome],
  );
  invalidateAccessConfig();
}

export async function listPlaces() {
  return sql<Local>(`SELECT ${LOCAL_COLS} FROM painel.acesso_local ORDER BY nome`);
}

export async function addPlace(l: Omit<Local, "id" | "ativo">) {
  await sql(`INSERT INTO painel.acesso_local (nome, endereco, lat, lng, raio) VALUES ($1, $2, $3, $4, $5)`, [l.nome, l.endereco, l.lat, l.lng, l.raio]);
  invalidateAccessConfig();
}

export async function updatePlace(id: number, l: Omit<Local, "id" | "ativo">) {
  await sql(`UPDATE painel.acesso_local SET nome = $2, endereco = $3, lat = $4, lng = $5, raio = $6 WHERE id = $1`, [id, l.nome, l.endereco, l.lat, l.lng, l.raio]);
  invalidateAccessConfig();
}

export async function setPlaceActive(id: number, ativo: boolean) {
  await sql(`UPDATE painel.acesso_local SET ativo = $2 WHERE id = $1`, [id, ativo]);
  invalidateAccessConfig();
}

export async function deletePlace(id: number) {
  await sql(`DELETE FROM painel.acesso_local WHERE id = $1`, [id]);
  invalidateAccessConfig();
}

// --- confirmação de local: cookie curto, renovado pela tela enquanto está aberta (LocationGuard) ---

const isProd = process.env.NODE_ENV === "production";
export const LOCAL_COOKIE = isProd ? "__Host-dv_local" : "dv_local";
const LOCAL_TTL_MIN = 15;

export const CLEAR_LOCAL_COOKIE = { name: LOCAL_COOKIE, value: "", httpOnly: true, secure: isProd, sameSite: "lax", path: "/", maxAge: 0 } as const;

export async function placeCookie(session: Session, localId: number) {
  const value = await new EncryptJWT({ u: userKey(session), l: localId })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${LOCAL_TTL_MIN}m`)
    .encrypt(await sessionKey());
  return { ...CLEAR_LOCAL_COOKIE, value, maxAge: LOCAL_TTL_MIN * 60 };
}

/** O local foi confirmado há pouco, pela mesma pessoa da sessão. */
export async function validPlaceCookie(token: string | undefined, session: Session) {
  if (!token) return false;
  try {
    const { payload } = await jwtDecrypt(token, await sessionKey());
    return payload.u === userKey(session);
  } catch {
    return false;
  }
}
