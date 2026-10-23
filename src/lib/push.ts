import "server-only";
import webpush from "web-push";
import { sql } from "./db";
import { userKey, type Session } from "./session";

// Notificações no celular (Web Push). As chaves VAPID são geradas na primeira vez e ficam em painel.config,
// então não há nada para configurar na hospedagem. Cada celular inscrito é uma linha em painel.push_inscricao.

let ready: Promise<string> | undefined;

/** Chave pública (o navegador precisa dela para se inscrever); configura o envio na primeira chamada. */
export function vapidPublicKey() {
  ready ??= (async () => {
    let rows = await sql<{ chave: string; valor: string }>(`SELECT chave, valor FROM painel.config WHERE chave IN ('vapid_publica', 'vapid_privada')`);
    if (rows.length < 2) {
      const keys = webpush.generateVAPIDKeys();
      // ON CONFLICT: se dois servidores gerarem ao mesmo tempo, vale a primeira gravada
      await sql(
        `INSERT INTO painel.config (chave, valor) VALUES ('vapid_publica', $1), ('vapid_privada', $2) ON CONFLICT (chave) DO NOTHING`,
        [keys.publicKey, keys.privateKey],
      );
      rows = await sql(`SELECT chave, valor FROM painel.config WHERE chave IN ('vapid_publica', 'vapid_privada')`);
    }
    const pub = rows.find((r) => r.chave === "vapid_publica")!.valor;
    const priv = rows.find((r) => r.chave === "vapid_privada")!.valor;
    webpush.setVapidDetails(process.env.PUSH_SUBJECT || "https://vendedor.casacontente.com.br", pub, priv);
    return pub;
  })();
  ready.catch(() => (ready = undefined));
  return ready;
}

export interface PushSubscriptionJSON {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function saveSubscription(session: Session, sub: PushSubscriptionJSON) {
  await sql(
    `INSERT INTO painel.push_inscricao (endpoint, p256dh, auth, usuario, papel, codemp, codvend) VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, usuario = EXCLUDED.usuario,
       papel = EXCLUDED.papel, codemp = EXCLUDED.codemp, codvend = EXCLUDED.codvend`,
    [sub.endpoint, sub.keys.p256dh, sub.keys.auth, userKey(session), session.role, session.codemp || null, session.codvend || null],
  );
}

export async function removeSubscription(endpoint: string) {
  await sql(`DELETE FROM painel.push_inscricao WHERE endpoint = $1`, [endpoint]);
}

export interface PushMessage {
  title: string;
  body: string;
  /** Tela que abre ao tocar */
  url: string;
  /** Mesma tag substitui a notificação anterior (ex.: a vez na fila) */
  tag?: string;
}

interface Audience {
  /** Só este vendedor (ex.: a vez na fila) */
  codvend?: number;
  /** Só esta loja (vendedores e gerentes) */
  codemp?: number | null;
  /** Só este papel */
  papel?: "master" | "gerente" | "vendedor" | null;
}

/** Envia para os celulares do público; inscrições que deixaram de existir (404/410) são apagadas. */
export async function sendPush(audience: Audience, msg: PushMessage, opts: { ttl?: number; urgent?: boolean } = {}) {
  await vapidPublicKey();
  const subs = await sql<{ endpoint: string; p256dh: string; auth: string }>(
    `SELECT endpoint, p256dh, auth FROM painel.push_inscricao
      WHERE ($1::int IS NULL OR (codvend = $1 AND papel = 'vendedor'))
        AND ($2::int IS NULL OR (codemp = $2 AND papel IN ('vendedor', 'gerente')))
        AND ($3::text IS NULL OR papel = $3)`,
    [audience.codvend ?? null, audience.codemp ?? null, audience.papel ?? null],
  );
  if (!subs.length) return 0;
  const payload = JSON.stringify(msg);
  let enviados = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
          TTL: opts.ttl ?? 3600,
          urgency: opts.urgent ? "high" : "normal",
          topic: msg.tag?.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || undefined,
        });
        enviados++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await removeSubscription(s.endpoint).catch(() => undefined);
        else console.warn(`[push] falha ao enviar (${status ?? "?"}):`, err instanceof Error ? err.message : err);
      }
    }),
  );
  console.info(`[push] "${msg.title}" enviada para ${enviados} de ${subs.length} celulares`);
  return enviados;
}

/** Dispara sem segurar quem chamou (o envio não pode atrasar a tela). */
export function sendPushLater(audience: Audience, msg: PushMessage, opts?: { ttl?: number; urgent?: boolean }) {
  void sendPush(audience, msg, opts).catch((err) => console.error("[push] erro:", err instanceof Error ? err.message : err));
}
