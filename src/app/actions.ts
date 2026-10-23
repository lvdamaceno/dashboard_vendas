"use server";

import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { clearFailures, clientIp, isBlocked, registerFailure } from "@/lib/rate-limit";
import { fetchProfile, ProfileError } from "@/lib/sankhya/profile";
import { fetchContact } from "@/lib/sankhya/contact";
import { photoVersion } from "@/lib/fila";
import { findMaster, getMasterPasswordHash, getPhoneOverrides, setMasterPassword } from "@/lib/painel";
import { hashPassword, MIN_PASSWORD, verifyPassword } from "@/lib/password";
import { formatPhone } from "@/lib/phone";
import { cookies } from "next/headers";
import { CLEAR_ADMIN_HINT, createSession, destroySession, getSession } from "@/lib/session";

/** etapa: depois do CPF, o master informa a senha (ou cria, no primeiro acesso) */
export type LoginState = { error?: string; cpf?: string; etapa?: "senha" | "criar"; nome?: string };

/** CPF só com dígitos e dígitos verificadores corretos. */
function validCpf(cpf: string) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    return ((sum * 10) % 11) % 10;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

// Não grava o CPF completo nos logs
const masked = (cpf: string) => `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const raw = typeof form.get("cpf") === "string" ? String(form.get("cpf")).slice(0, 20) : "";
  const cpf = raw.replace(/\D/g, "");
  if (!validCpf(cpf)) return { error: "Informe um CPF válido.", cpf: raw };

  const ip = await clientIp();
  const keys = [`ip:${ip}`, `cpf:${cpf}`];
  if (keys.some(isBlocked)) {
    console.warn(`[login] bloqueado por excesso de tentativas: ${masked(cpf)} (ip ${ip})`);
    return { error: "Muitas tentativas. Aguarde 15 minutos e tente novamente.", cpf: raw };
  }

  // Diretores (master) cadastrados pelo admin entram com CPF + senha, sem passar pelo Sankhya
  let master: Awaited<ReturnType<typeof findMaster>> = null;
  try {
    master = await findMaster(cpf);
  } catch (err) {
    // Sem o banco do painel, vendedores e gerentes continuam entrando pelo Sankhya
    console.error("[login] não foi possível consultar os masters:", err instanceof Error ? err.message : err);
  }
  if (master) {
    const apelido = master.nome.trim().split(/\s+/)[0];
    const senha = typeof form.get("senha") === "string" ? String(form.get("senha")).slice(0, 200) : "";
    const etapa = master.senhaHash ? "senha" : "criar";
    if (!senha) return { cpf: raw, etapa, nome: apelido };

    if (etapa === "criar") {
      // Primeiro acesso: cria a senha (só se ainda não existir)
      const confirmacao = String(form.get("confirmacao") ?? "").slice(0, 200);
      if (senha.length < MIN_PASSWORD) return { cpf: raw, etapa, nome: apelido, error: `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.` };
      if (senha !== confirmacao) return { cpf: raw, etapa, nome: apelido, error: "As duas senhas não são iguais." };
      if (!(await setMasterPassword(master.id, await hashPassword(senha), true))) {
        return { cpf: raw, etapa: "senha", nome: apelido, error: "A senha já foi criada. Entre com ela." };
      }
      console.info(`[login] senha criada no primeiro acesso: ${master.nome} — master`);
    } else if (!(await verifyPassword(senha, master.senhaHash!))) {
      keys.forEach(registerFailure);
      console.warn(`[login] ${masked(cpf)} sem acesso: senha de master incorreta (ip ${ip})`);
      return { cpf: raw, etapa, nome: apelido, error: "Senha incorreta." };
    }

    await createSession({ role: "master", masterId: master.id, nome: master.nome, apelido, codfunc: 0, codvend: 0, codemp: 0 });
    console.info(`[login] ok ${master.nome} — master`);
    keys.forEach(clearFailures);
    (await cookies()).set(CLEAR_ADMIN_HINT);
    redirect("/dashboard");
  }

  try {
    const profile = await fetchProfile(cpf);
    await createSession(profile);
    console.info(`[login] ok ${profile.nome} — ${profile.role}, vendedor ${profile.codvend}, empresa ${profile.codemp}`);
  } catch (err) {
    if (err instanceof ProfileError) {
      console.warn(`[login] ${masked(cpf)} sem acesso: ${err.message} (ip ${ip})`);
      keys.forEach(registerFailure);
      return { error: err.message, cpf: raw };
    }
    console.error(`[login] erro ao carregar perfil de ${masked(cpf)}:`, err instanceof Error ? err.message : err);
    return { error: "Não foi possível conectar ao Sankhya. Tente novamente.", cpf: raw };
  }

  keys.forEach(clearFailures);
  // Entrou com CPF: este aparelho deixa de voltar para o login de admin
  (await cookies()).set(CLEAR_ADMIN_HINT);
  redirect("/dashboard");
}

export async function logout() {
  const session = await getSession();
  await destroySession();
  // O admin volta para o login de admin
  redirect(session?.role === "admin" ? "/admin" : "/login");
}

export type BusinessCard =
  | {
      ok: true;
      codvend: number;
      nome: string;
      cargo: string;
      telefone: string | null;
      doApp: boolean;
      whatsapp: string | null;
      qrSvg: string | null;
      /** Versão da foto enviada na fila (null = sem foto) */
      foto: number | null;
    }
  | { ok: false; error: string };

// Primeiro e último nome, para caber no cartão
const shortName = (nome: string) => {
  const parts = nome.trim().split(/\s+/);
  return parts.length > 2 ? `${parts[0]} ${parts[parts.length - 1]}` : parts.join(" ");
};

/** Dados do cartão de visita do usuário logado; o QR code abre o WhatsApp dele. */
export async function getBusinessCard(): Promise<BusinessCard> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sessão expirada. Entre novamente." };
  if (session.role === "master" || session.role === "admin") return { ok: false, error: "Cartão disponível só para vendedores e gerentes." };

  try {
    // Telefone atualizado pelo app tem prioridade; sem ele, vale o do Sankhya
    const [contact, overrides, foto] = await Promise.all([
      fetchContact(session.codemp, session.codfunc),
      getPhoneOverrides([session.codvend]).catch((err) => {
        console.error("[cartao] telefones do app:", err instanceof Error ? err.message : err);
        return new Map();
      }),
      // A mesma foto da fila de atendimento, se o vendedor enviou
      photoVersion(session.codvend).catch(() => null),
    ]);
    const telefone: string | null = overrides.get(session.codvend)?.telefone ?? contact.telefone;
    const whatsapp = telefone ? `https://wa.me/55${telefone}` : null;
    return {
      ok: true,
      codvend: session.codvend,
      nome: shortName(contact.nome ?? session.apelido),
      cargo: session.role === "gerente" ? "Gerente" : "Vendedor",
      telefone: telefone ? formatPhone(telefone) : null,
      doApp: overrides.has(session.codvend),
      foto,
      whatsapp,
      qrSvg: whatsapp
        ? await QRCode.toString(whatsapp, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#b0141b", light: "#ffffff" } })
        : null,
    };
  } catch (err) {
    console.error(`[cartao] erro ao carregar contato do funcionário ${session.codfunc} (empresa ${session.codemp}):`, err instanceof Error ? err.message : err);
    return { ok: false, error: "Não foi possível carregar seu cartão. Tente novamente." };
  }
}

export type PasswordState = { ok?: boolean; error?: string };

/** O master troca a própria senha (precisa da atual). */
export async function changeMasterPassword(_prev: PasswordState, form: FormData): Promise<PasswordState> {
  const session = await getSession();
  if (session?.role !== "master" || !session.masterId) return { error: "Só a diretoria tem senha aqui." };
  const atual = String(form.get("atual") ?? "").slice(0, 200);
  const nova = String(form.get("nova") ?? "").slice(0, 200);
  const confirmacao = String(form.get("confirmacao") ?? "").slice(0, 200);
  if (nova.length < MIN_PASSWORD) return { error: `A nova senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.` };
  if (nova !== confirmacao) return { error: "As duas senhas novas não são iguais." };

  const ip = await clientIp();
  const key = `senha:${session.masterId}`;
  if (isBlocked(key) || isBlocked(`ip:${ip}`)) return { error: "Muitas tentativas. Aguarde 15 minutos e tente novamente." };
  try {
    const hash = await getMasterPasswordHash(session.masterId);
    if (!hash || !(await verifyPassword(atual, hash))) {
      registerFailure(key);
      console.warn(`[login] ${session.apelido} errou a senha atual ao trocar (ip ${ip})`);
      return { error: "A senha atual está incorreta." };
    }
    await setMasterPassword(session.masterId, await hashPassword(nova), false);
    clearFailures(key);
    console.info(`[login] ${session.nome} trocou a senha — master`);
  } catch (err) {
    console.error("[login] erro ao trocar senha:", err instanceof Error ? err.message : err);
    return { error: "Não foi possível trocar a senha. Tente novamente." };
  }
  return { ok: true };
}
