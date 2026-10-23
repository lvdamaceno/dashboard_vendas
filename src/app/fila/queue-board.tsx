"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { SMILE, SMILE_BOX } from "@/components/logo";
import { PushToggle } from "@/components/push-toggle";
import type { QueueView } from "@/lib/fila-access";
import type { Session } from "@/lib/session";
import { enterQueue, exitQueue, finishCustomer, removeFromQueue, removePhoto, reorder, serveCustomer, uploadPhoto, type QueueResult } from "./actions";
import type { LossReason, ServiceResult } from "@/lib/fila";
import { Select } from "@/components/select";

const POLL_MS = 4000;

interface Props {
  initial: QueueView | null;
  error?: string;
  role: Session["role"];
  /** Vendedor que está vendo: para a foto */
  me: { codvend: number; nome: string; foto: number | null } | null;
  /** Loja da fila, para as ações e a atualização (master/admin; o vendedor e o gerente usam a da sessão) */
  loja?: number;
  lojaNome?: string;
  /** Seletor de loja (master e admin); vazio = sem seletor */
  stores: { codigo: number; nome: string }[];
  /** Admin: o seletor tem "Todas as lojas" (ver todas as filas de uma vez) */
  allOption?: boolean;
  /** Versão resumida, para a tela com todas as filas: só a lista, com o nome da loja no título */
  compact?: boolean;
}

/** Seletor de loja da fila (master e admin). */
export function StorePicker({ stores, loja, allOption }: { stores: { codigo: number; nome: string }[]; loja?: number; allOption?: boolean }) {
  const router = useRouter();
  return (
    <Select
      aria-label="Loja"
      value={loja ?? ""}
      onChange={(e) => router.push(e.target.value ? `/fila?loja=${e.target.value}` : "/fila")}
      className="h-11 rounded-full border border-line bg-surface pl-4 text-base md:text-sm"
      wrapperClassName="w-full md:w-72"
    >
      <option value="">{allOption ? "Todas as lojas" : "Escolha a loja"}</option>
      {stores.map((s) => (
        <option key={s.codigo} value={s.codigo}>
          {s.nome}
        </option>
      ))}
    </Select>
  );
}

const button = "h-12 rounded-full px-6 font-title text-base font-medium transition disabled:opacity-60";
const small = "flex size-9 shrink-0 items-center justify-center rounded-full border border-line text-ink-2 hover:bg-bg-alt disabled:opacity-40";

/** Sem foto: uma pessoa nas cores da marca, com o sorriso do logotipo no rosto. */
function SmilingPerson({ className }: { className: string }) {
  const clip = useId();
  return (
    <svg viewBox="0 0 48 48" className={`${className} shrink-0`} aria-hidden>
      <clipPath id={clip}>
        <circle cx="24" cy="24" r="24" />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <rect width="48" height="48" fill="var(--accent-soft)" />
        <path d="M6 50c0-10.5 8-17 18-17s18 6.5 18 17Z" fill="var(--accent)" />
        <circle cx="24" cy="18.5" r="10" fill="var(--accent)" />
        {/* o mesmo sorriso amarelo do logotipo */}
        <svg x="15.6" y="19.2" width="16.8" height="5.2" viewBox={SMILE_BOX}>
          <path d={SMILE} fill="var(--smile)" />
        </svg>
      </g>
    </svg>
  );
}

export function Avatar({ codvend, nome, versao, size = "size-12" }: { codvend: number; nome: string; versao: number | null; size?: string }) {
  return versao ? (
    <img src={`/api/foto/${codvend}?v=${versao}`} alt="" className={`${size} shrink-0 rounded-full object-cover`} />
  ) : (
    <SmilingPerson className={size} />
  );
}

/** Fila de atendimento da loja: atualiza sozinha em todas as telas abertas. */
export function QueueBoard({ initial, error: initialError, role, me, loja, lojaNome, stores, allOption, compact }: Props) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [error, setError] = useState(initialError);
  const [pending, start] = useTransition();
  const busy = useRef(false);

  // Atualiza a cada poucos segundos enquanto a tela está aberta, e na hora ao voltar para ela
  useEffect(() => {
    if (!initial) return;
    let stopped = false;
    async function poll() {
      if (busy.current || document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/fila${loja ? `?loja=${loja}` : ""}`, { cache: "no-store" });
        if (res.status === 401) return router.refresh();
        if (!res.ok || stopped) return;
        setView(await res.json());
        setError(undefined);
      } catch {
        // sem internet: tenta de novo no próximo ciclo
      }
    }
    const timer = setInterval(poll, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [initial, loja, router]);

  function run(action: () => Promise<QueueResult>) {
    busy.current = true;
    start(async () => {
      const res = await action();
      busy.current = false;
      if (res.ok) {
        setView(res.view);
        setError(undefined);
      } else setError(res.error);
    });
  }

  const fila = view?.fila ?? [];
  const mine = view?.eu ? fila.find((f) => f.codvend === view.eu) : undefined;
  const proximo = fila.find((f) => !f.atendendo);
  const esperando = fila.filter((f) => !f.atendendo);
  const minhaVez = mine && !mine.atendendo && proximo?.codvend === mine.codvend;
  const lugar = mine && !mine.atendendo ? esperando.findIndex((f) => f.codvend === mine.codvend) + 1 : 0;

  function move(index: number, delta: number) {
    const order = fila.map((f) => f.codvend);
    const [item] = order.splice(index, 1);
    order.splice(index + delta, 0, item);
    run(() => reorder(loja, order));
  }

  return (
    <div className="space-y-3">
      {!compact && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl">Fila de atendimento</h1>
            <p className="text-sm text-ink-3">
              {lojaNome ?? "Escolha a loja"} · zera todo dia às 7h
            </p>
          </div>
          <Link href="/dashboard" className="h-10 rounded-full border border-line bg-surface px-4 font-title text-sm leading-10 font-medium text-ink-2 hover:bg-bg-alt">
            Voltar ao painel
          </Link>
        </div>
      )}

      {!compact && stores.length > 0 && <StorePicker stores={stores} loja={loja} allOption={allOption} />}

      {error && (
        <p role="alert" className="rounded-2xl bg-accent-soft px-4 py-3 text-sm text-bad">
          {error}
        </p>
      )}

      {/* Ações do vendedor */}
      {role === "vendedor" && view && (
        <section className={`rounded-3xl border p-5 text-center ${minhaVez ? "border-accent bg-accent-soft" : "border-line bg-surface"}`}>
          {!mine ? (
            <>
              <p className="text-ink-2">Você não está na fila.</p>
              <button type="button" disabled={pending} onClick={() => run(enterQueue)} className={`${button} mt-3 bg-accent text-white hover:bg-accent-dark`}>
                Entrar na fila
              </button>
            </>
          ) : mine.atendendo ? (
            <FinishService pending={pending} onFinish={(resultado, motivo) => run(() => finishCustomer(resultado, motivo))} />
          ) : (
            <>
              <p className="font-title text-lg font-medium">{minhaVez ? "É a sua vez! 🎉" : `Você é o ${lugar}º da fila`}</p>
              <p className="text-sm text-ink-2">Ao atender um cliente, toque abaixo: você vai para o fim da fila.</p>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(serveCustomer)}
                className={`${button} mt-3 ${minhaVez ? "bg-accent text-white hover:bg-accent-dark" : "border border-line bg-surface text-ink hover:bg-bg-alt"}`}
              >
                Atender cliente
              </button>
            </>
          )}
          {mine && (
            <button type="button" disabled={pending} onClick={() => run(exitQueue)} className="mt-3 block w-full text-sm text-ink-3 underline-offset-4 hover:underline">
              Sair da fila
            </button>
          )}
        </section>
      )}

      {/* A fila */}
      {view && (
        <section className="overflow-hidden rounded-3xl border border-line bg-surface">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 className="text-base">{compact ? lojaNome : "Na fila agora"}</h2>
            <span className="text-xs text-ink-3">
              {esperando.length} esperando · {fila.length - esperando.length} atendendo
            </span>
          </div>
          {fila.length === 0 ? (
            <p className="px-5 pb-8 pt-2 text-center text-sm text-ink-3">Ninguém na fila ainda.</p>
          ) : (
            <ol className="divide-y divide-line border-t border-line">
              {fila.map((f, i) => {
                const next = proximo?.codvend === f.codvend;
                const isMe = view.eu === f.codvend;
                return (
                  <li key={f.codvend} className={`flex items-center gap-3 px-5 py-3 ${next ? "bg-accent-soft" : ""}`}>
                    <span className="tabular w-6 shrink-0 text-center font-title text-sm text-ink-3">{i + 1}</span>
                    <Avatar codvend={f.codvend} nome={f.nome} versao={f.fotoVersao} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {f.nome}
                        {isMe && <span className="ml-1 text-sm font-normal text-ink-3">(você)</span>}
                      </p>
                      <p className="text-xs">
                        {f.atendendo ? (
                          <span className="font-medium text-good">Atendendo</span>
                        ) : next ? (
                          <span className="font-medium text-accent">Próximo a atender</span>
                        ) : (
                          <span className="text-ink-3">Esperando</span>
                        )}
                      </p>
                    </div>
                    {view.gerencia && (
                      <div className="flex shrink-0 items-center gap-1">
                        <button type="button" aria-label={`Subir ${f.nome}`} disabled={pending || i === 0} onClick={() => move(i, -1)} className={small}>
                          ↑
                        </button>
                        <button type="button" aria-label={`Descer ${f.nome}`} disabled={pending || i === fila.length - 1} onClick={() => move(i, 1)} className={small}>
                          ↓
                        </button>
                        <button
                          type="button"
                          aria-label={`Tirar ${f.nome} da fila`}
                          disabled={pending}
                          onClick={() => confirm(`Tirar ${f.nome} da fila?`) && run(() => removeFromQueue(loja, f.codvend))}
                          className={`${small} hover:text-bad`}
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      )}

      {me && !compact && <PhotoPicker me={me} onChanged={() => router.refresh()} />}

      {/* Vendedor: "É a sua vez!" chega no celular mesmo com o painel fechado */}
      {role === "vendedor" && !compact && <PushToggle />}
    </div>
  );
}

const RESULTADOS: { value: ServiceResult; label: string; icon: string }[] = [
  { value: "vendeu", label: "Vendeu", icon: "✅" },
  { value: "nao_vendeu", label: "Não vendeu", icon: "❌" },
  { value: "so_olhando", label: "Só olhando", icon: "👀" },
];
const MOTIVOS: { value: LossReason; label: string }[] = [
  { value: "preco", label: "Preço" },
  { value: "sem_produto", label: "Não tinha o produto" },
  { value: "vai_voltar", label: "Vai voltar" },
  { value: "outro", label: "Outro" },
];

/** "Você está atendendo": ao terminar, a pessoa diz como foi (e, se não vendeu, o motivo). */
function FinishService({ pending, onFinish }: { pending: boolean; onFinish: (r?: ServiceResult, m?: LossReason) => void }) {
  const [etapa, setEtapa] = useState<"atendendo" | "resultado" | "motivo">("atendendo");
  const choice = "flex h-14 flex-col items-center justify-center rounded-2xl border border-line bg-surface font-title text-sm font-medium hover:bg-bg-alt disabled:opacity-60";

  if (etapa === "atendendo")
    return (
      <>
        <p className="font-title text-lg font-medium">Você está atendendo</p>
        <p className="text-sm text-ink-2">Você já foi para o fim da fila. Quando terminar, toque abaixo.</p>
        <button type="button" disabled={pending} onClick={() => setEtapa("resultado")} className={`${button} mt-3 bg-accent text-white hover:bg-accent-dark`}>
          Terminei o atendimento
        </button>
      </>
    );

  if (etapa === "resultado")
    return (
      <>
        <p className="font-title text-lg font-medium">Como foi o atendimento?</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {RESULTADOS.map((r) => (
            <button
              key={r.value}
              type="button"
              disabled={pending}
              onClick={() => (r.value === "nao_vendeu" ? setEtapa("motivo") : onFinish(r.value))}
              className={choice}
            >
              <span className="text-xl" aria-hidden>
                {r.icon}
              </span>
              {r.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setEtapa("atendendo")} className="mt-3 text-sm text-ink-3 underline-offset-4 hover:underline">
          Voltar
        </button>
      </>
    );

  return (
    <>
      <p className="font-title text-lg font-medium">Por que não vendeu?</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {MOTIVOS.map((m) => (
          <button key={m.value} type="button" disabled={pending} onClick={() => onFinish("nao_vendeu", m.value)} className={`${choice} h-12`}>
            {m.label}
          </button>
        ))}
      </div>
      <button type="button" disabled={pending} onClick={() => onFinish("nao_vendeu")} className="mt-3 text-sm text-ink-3 underline-offset-4 hover:underline">
        Pular
      </button>
    </>
  );
}

/** Recorta no centro, reduz para 256x256 e gera JPEG no próprio aparelho (a foto sobe pequena). */
async function toJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  canvas.getContext("2d")!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 256, 256);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("falha ao gerar a imagem"))), "image/jpeg", 0.85));
}

function PhotoPicker({ me, onChanged }: { me: { codvend: number; nome: string; foto: number | null }; onChanged: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [versao, setVersao] = useState(me.foto);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function pick(file: File | undefined) {
    if (!file) return;
    setError(undefined);
    start(async () => {
      try {
        const form = new FormData();
        form.set("foto", new File([await toJpeg(file)], "foto.jpg", { type: "image/jpeg" }));
        const res = await uploadPhoto(form);
        if (!res.ok) return setError(res.error);
        setVersao(Date.now());
        onChanged();
      } catch {
        setError("Não foi possível ler essa imagem. Tente outra foto.");
      } finally {
        if (input.current) input.current.value = "";
      }
    });
  }

  return (
    <section className="flex flex-wrap items-center gap-4 rounded-3xl border border-line bg-surface p-5">
      <Avatar codvend={me.codvend} nome={me.nome} versao={versao} size="size-16" />
      {/* No celular os botões descem para a linha de baixo, sem espremer o texto */}
      <div className="min-w-0 flex-1 basis-40">
        <h2 className="text-base">Sua foto na fila</h2>
        <p className="text-sm text-ink-2">Aparece ao lado do seu nome para a equipe.</p>
        {error && <p className="mt-1 text-sm text-bad">{error}</p>}
      </div>
      <div className="flex w-full gap-2 sm:w-auto">
        <input ref={input} type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} aria-label="Escolher foto" />
        <button
          type="button"
          disabled={pending}
          onClick={() => input.current?.click()}
          className="h-10 rounded-full bg-accent px-5 font-title text-sm font-medium text-white hover:bg-accent-dark disabled:opacity-60"
        >
          {pending ? "Enviando…" : versao ? "Trocar foto" : "Enviar foto"}
        </button>
        {versao && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              confirm("Remover sua foto?") &&
              start(async () => {
                const res = await removePhoto();
                if (!res.ok) return setError(res.error);
                setVersao(null);
                onChanged();
              })
            }
            className="h-10 rounded-full border border-line px-4 text-sm text-ink-2 hover:bg-bg-alt"
          >
            Remover
          </button>
        )}
      </div>
    </section>
  );
}
