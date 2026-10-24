"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { sendNotice, type FormState } from "../painel-actions";
import { addPlaceAction, addReminder, saveAccessRuleAction, saveMaster, updatePlaceAction, type AdminState } from "./actions";
import type { Janela, Local, Papel } from "@/lib/acesso";
import { parseCoords } from "@/lib/coords";
import { Select } from "@/components/select";

const field =
  "w-full rounded-2xl border border-line bg-bg px-4 py-2.5 text-base outline-none focus:border-accent focus:ring-3 focus:ring-accent/15 md:text-sm";
const submit =
  "h-10 rounded-full bg-accent px-5 font-title text-sm font-medium text-white hover:bg-accent-dark disabled:opacity-60";

/** Limpa o formulário depois de salvar. */
function useResetOnOk(state: { ok?: boolean }) {
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);
  return form;
}

export function NoticeForm({ stores }: { stores: { codigo: number; nome: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(sendNotice, {});
  const form = useResetOnOk(state);
  return (
    <form ref={form} action={action} className="space-y-2">
      <input name="titulo" required maxLength={120} placeholder="Título" className={field} />
      <textarea name="mensagem" required maxLength={2000} rows={4} placeholder="Mensagem" className={field} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select name="loja" aria-label="Para quem" defaultValue="" className={field} wrapperClassName="sm:flex-1">
          <option value="">Todo mundo (todas as lojas)</option>
          {stores.map((s) => (
            <option key={s.codigo} value={s.codigo}>
              {s.nome}
            </option>
          ))}
        </Select>
        <button type="submit" disabled={pending} className={submit}>
          {pending ? "Enviando…" : "Enviar aviso"}
        </button>
      </div>
      {state.error && <p className="text-sm text-bad">{state.error}</p>}
      {state.ok && <p className="text-sm text-good">Aviso enviado.</p>}
    </form>
  );
}

export function MasterForm() {
  const [state, action, pending] = useActionState<AdminState, FormData>(saveMaster, {});
  const form = useResetOnOk(state);
  return (
    <form ref={form} action={action} className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input name="nome" required maxLength={120} placeholder="Nome" className={`${field} sm:flex-1`} />
        <input name="cpf" required inputMode="numeric" maxLength={14} placeholder="CPF" className={`${field} sm:w-48`} />
        <button type="submit" disabled={pending} className={submit}>
          {pending ? "Salvando…" : "Adicionar"}
        </button>
      </div>
      {state.error && <p className="text-sm text-bad">{state.error}</p>}
      {state.ok && <p className="text-sm text-good">Master salvo. Ele já pode entrar com o CPF.</p>}
    </form>
  );
}

/** Botão de envio que pede confirmação antes (ex.: remover). */
export function ConfirmButton({ message, children, className }: { message: string; children: React.ReactNode; className?: string }) {
  return (
    <button type="submit" className={className} onClick={(e) => !confirm(message) && e.preventDefault()}>
      {children}
    </button>
  );
}

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/** Novo lembrete recorrente: no dia, vira um aviso no sino do público escolhido. */
export function ReminderForm() {
  const [state, action, pending] = useActionState<AdminState, FormData>(addReminder, {});
  const form = useResetOnOk(state);
  const [recorrencia, setRecorrencia] = useState("mensal");
  return (
    <form ref={form} action={action} className="space-y-2">
      <input name="titulo" required maxLength={120} placeholder="Título (ex.: Preencher as metas do mês)" className={field} />
      <textarea name="mensagem" required maxLength={2000} rows={3} placeholder="Mensagem" className={field} />
      <div className="grid gap-2 sm:grid-cols-3">
        <Select name="publico" aria-label="Para quem" defaultValue="master" className={field}>
          <option value="master">Diretoria (master)</option>
          <option value="gerente">Gerentes</option>
          <option value="vendedor">Vendedores</option>
          <option value="todos">Todo mundo</option>
        </Select>
        <Select name="recorrencia" aria-label="Quando" value={recorrencia} onChange={(e) => setRecorrencia(e.target.value)} className={field}>
          <option value="mensal">Todo mês, no dia…</option>
          <option value="semanal">Toda semana, na…</option>
          <option value="diaria">Todo dia</option>
          <option value="unica">Uma vez, na data…</option>
        </Select>
        {recorrencia === "mensal" && (
          <Select name="diaMes" aria-label="Dia do mês" defaultValue="1" className={field}>
            {Array.from({ length: 31 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                Dia {i + 1}
                {i + 1 > 28 ? " (ou o último do mês)" : ""}
              </option>
            ))}
          </Select>
        )}
        {recorrencia === "semanal" && (
          <Select name="diaSemana" aria-label="Dia da semana" defaultValue="1" className={field}>
            {WEEKDAYS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </Select>
        )}
        {recorrencia === "unica" && <input name="data" type="date" required aria-label="Data" className={field} />}
      </div>
      {state.error && <p className="text-sm text-bad">{state.error}</p>}
      {state.ok && <p className="text-sm text-good">Lembrete criado.</p>}
      <button type="submit" disabled={pending} className={submit}>
        {pending ? "Salvando…" : "Criar lembrete"}
      </button>
    </form>
  );
}

// Semana começando na segunda (o índice continua 0 = domingo … 6 = sábado)
const SEMANA = [1, 2, 3, 4, 5, 6, 0];
const PADRAO: Janela = { inicio: "08:00", fim: "18:00" };
const check = "size-4 shrink-0 accent-accent";
// Campo de hora estreito, para o dia caber numa linha só
const time = "w-[5.75rem] shrink-0 rounded-xl border border-line bg-bg px-2 py-1.5 text-base outline-none focus:border-accent focus:ring-3 focus:ring-accent/15 md:text-sm";

/** Horário e trava de local de um grupo. Sem regra salva, sugere segunda a sábado, das 8h às 18h. */
export function AccessRuleForm({ papel, label, regra }: { papel: Papel; label: string; regra?: { horario: boolean; janelas: (Janela | null)[]; local: boolean } }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(saveAccessRuleAction, {});
  const [horario, setHorario] = useState(regra?.horario ?? false);
  const [dias, setDias] = useState(() => Array.from({ length: 7 }, (_, d) => (regra ? !!regra.janelas[d] : d !== 0)));
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="papel" value={papel} />
      <h3 className="font-title font-medium">{label}</h3>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="horario" value="1" checked={horario} onChange={(e) => setHorario(e.target.checked)} className={check} />
        Limitar o horário de acesso
      </label>
      {/* Desligado, os dias continuam no formulário (apagados) para não perder o horário já montado */}
      <fieldset className={`space-y-1.5 sm:pl-6 ${horario ? "" : "opacity-50"}`}>
        <legend className="sr-only">Dias e horários</legend>
        {SEMANA.map((d) => {
          const j = regra?.janelas[d] ?? PADRAO;
          return (
            <div key={d} className="flex items-center gap-1.5 text-sm">
              <label className="flex w-[5.5rem] shrink-0 items-center gap-2">
                <input
                  type="checkbox"
                  name={`dia${d}`}
                  value="1"
                  checked={dias[d]}
                  onChange={(e) => setDias((v) => v.map((x, i) => (i === d ? e.target.checked : x)))}
                  className={check}
                />
                {WEEKDAYS[d]}
              </label>
              {dias[d] ? (
                <>
                  <input type="time" name={`inicio${d}`} defaultValue={j.inicio} required aria-label={`Início ${WEEKDAYS[d]}`} className={time} />
                  <span className="text-ink-3">às</span>
                  <input type="time" name={`fim${d}`} defaultValue={j.fim} required aria-label={`Fim ${WEEKDAYS[d]}`} className={time} />
                </>
              ) : (
                <span className="text-ink-3">sem acesso</span>
              )}
            </div>
          );
        })}
      </fieldset>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="local" value="1" defaultChecked={regra?.local ?? false} className={check} />
        Só abrir nos locais cadastrados (pede a localização do aparelho)
      </label>
      {state.error && <p className="text-sm text-bad">{state.error}</p>}
      {state.ok && <p className="text-sm text-good">Salvo. Vale a partir do próximo carregamento de tela.</p>}
      <button type="submit" disabled={pending} className={submit}>
        {pending ? "Salvando…" : "Salvar"}
      </button>
    </form>
  );
}

/** Precisão mínima do "Estou no local": pior que isso, o aparelho está chutando (ex.: computador localizado pelo IP). */
const PRECISAO_LOCAL = 100;

/**
 * Novo local de acesso, ou correção de um já cadastrado (local).
 * As coordenadas vêm coladas do Google Maps ou do GPS do aparelho estando no local; o ponto lido aparece na hora para conferir.
 */
export function PlaceForm({ local, onDone }: { local?: Local; onDone?: () => void }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(local ? updatePlaceAction : addPlaceAction, {});
  const form = useResetOnOk(state);
  const [coordenadas, setCoordenadas] = useState(local ? `${local.lat}, ${local.lng}` : "");
  const [aviso, setAviso] = useState<string>();
  const lido = coordenadas.trim() ? parseCoords(coordenadas) : null;

  useEffect(() => {
    if (!state.ok) return;
    if (local) onDone?.();
    else {
      setCoordenadas("");
      setAviso(undefined);
    }
  }, [state, local, onDone]);

  const aqui = () => {
    setAviso("Pegando a localização deste aparelho…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const margem = Math.round(p.coords.accuracy);
        if (margem > PRECISAO_LOCAL) {
          return setAviso(
            `A localização deste aparelho está imprecisa (margem de ${margem} m), então não foi usada. Use um celular com GPS ligado, estando na loja, ou cole as coordenadas do Google Maps.`,
          );
        }
        setCoordenadas(`${p.coords.latitude.toFixed(7)}, ${p.coords.longitude.toFixed(7)}`);
        setAviso(`Localização deste aparelho (margem de ${margem} m).`);
      },
      () => setAviso("Não foi possível pegar a localização deste aparelho."),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  };

  return (
    <form ref={form} action={action} className="space-y-2">
      {local && <input type="hidden" name="id" value={local.id} />}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input name="nome" required maxLength={120} defaultValue={local?.nome} placeholder="Nome (ex.: Loja Pedreira, Escritório)" aria-label="Nome" className={`${field} sm:w-64`} />
        <input name="endereco" maxLength={300} defaultValue={local?.endereco ?? ""} placeholder="Endereço (só para referência)" aria-label="Endereço" className={`${field} sm:flex-1`} />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          name="coordenadas"
          required
          value={coordenadas}
          onChange={(e) => setCoordenadas(e.target.value)}
          placeholder="Coordenadas do Google Maps (ex.: -1.4295874, -48.4851419)"
          aria-label="Coordenadas"
          className={`${field} sm:flex-1`}
        />
        <button type="button" onClick={aqui} className="h-10 shrink-0 rounded-full border border-line px-4 text-sm font-medium hover:bg-bg-alt">
          Estou no local
        </button>
        <Select name="raio" aria-label="Raio aceito" defaultValue={String(local?.raio ?? 150)} className={field} wrapperClassName="sm:w-52">
          {[50, 100, 150, 200, 300, 500, 1000].map((m) => (
            <option key={m} value={m}>
              Até {m} m do ponto
            </option>
          ))}
        </Select>
      </div>
      {lido &&
        (lido.ok ? (
          <p className="text-sm text-ink-2">
            Ponto lido: latitude <span className="tabular">{lido.lat}</span>, longitude <span className="tabular">{lido.lng}</span> ·{" "}
            <a href={`https://www.google.com/maps/search/?api=1&query=${lido.lat},${lido.lng}`} target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-4 hover:underline">
              conferir no Google Maps ↗
            </a>
          </p>
        ) : (
          <p className="text-sm text-bad">{lido.error}</p>
        ))}
      {aviso && <p className="text-sm text-ink-2">{aviso}</p>}
      {state.error && <p className="text-sm text-bad">{state.error}</p>}
      {state.ok && !local && <p className="text-sm text-good">Local salvo.</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending || (lido !== null && !lido.ok)} className={submit}>
          {pending ? "Salvando…" : local ? "Salvar correção" : "Adicionar local"}
        </button>
        {local && (
          <button type="button" onClick={onDone} className="h-10 rounded-full border border-line px-4 text-sm font-medium hover:bg-bg-alt">
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

/** Linha da lista de locais: o botão "Corrigir" abre o formulário com os dados atuais. */
export function PlaceEditor({ local, children }: { local: Local; children: React.ReactNode }) {
  const [editando, setEditando] = useState(false);
  if (editando) return <PlaceForm local={local} onDone={() => setEditando(false)} />;
  return (
    <div className="flex flex-wrap items-start gap-3">
      <div className="min-w-0 flex-1">{children}</div>
      <button type="button" onClick={() => setEditando(true)} className="h-9 shrink-0 rounded-full border border-line px-4 text-sm font-medium hover:bg-bg-alt">
        Corrigir
      </button>
    </div>
  );
}
