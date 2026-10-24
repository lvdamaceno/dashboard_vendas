"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { sendNotice, type FormState } from "../painel-actions";
import { addPlaceAction, addReminder, saveAccessRuleAction, saveMaster, searchAddress, type AdminState } from "./actions";
import type { Endereco, Janela, Papel } from "@/lib/acesso";
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

/** Novo local de acesso: endereço buscado no mapa, localização atual do aparelho ou coordenadas coladas do Google Maps. */
export function PlaceForm() {
  const [state, action, pending] = useActionState<AdminState, FormData>(addPlaceAction, {});
  const form = useResetOnOk(state);
  const [endereco, setEndereco] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [resultados, setResultados] = useState<Endereco[]>([]);
  const [aviso, setAviso] = useState<string>();
  const [buscando, startBusca] = useTransition();

  useEffect(() => {
    if (!state.ok) return;
    setEndereco("");
    setLat("");
    setLng("");
    setResultados([]);
    setAviso(undefined);
  }, [state]);

  const usar = (p: { lat: number; lng: number }) => {
    setLat(p.lat.toFixed(6));
    setLng(p.lng.toFixed(6));
    setResultados([]);
  };
  const buscar = () =>
    startBusca(async () => {
      setAviso(undefined);
      const r = await searchAddress(endereco);
      if (!r.ok) return setAviso(r.error);
      if (r.resultados.length === 1) usar(r.resultados[0]);
      else setResultados(r.resultados);
    });
  const aqui = () => {
    setAviso("Pegando a localização deste aparelho…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        usar({ lat: p.coords.latitude, lng: p.coords.longitude });
        setAviso(`Localização deste aparelho (margem de ${Math.round(p.coords.accuracy)} m).`);
      },
      () => setAviso("Não foi possível pegar a localização deste aparelho."),
      { enableHighAccuracy: true, timeout: 20_000 },
    );
  };
  const coords = Number(lat) && Number(lng) ? `${lat},${lng}` : null;

  return (
    <form ref={form} action={action} className="space-y-2">
      <input name="nome" required maxLength={120} placeholder="Nome (ex.: Loja Pedreira, Escritório)" className={field} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          name="endereco"
          maxLength={300}
          value={endereco}
          onChange={(e) => setEndereco(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              buscar();
            }
          }}
          placeholder="Endereço (rua, número, bairro, cidade)"
          className={`${field} sm:flex-1`}
        />
        <button type="button" onClick={buscar} disabled={buscando} className="h-10 shrink-0 rounded-full border border-line px-4 text-sm font-medium hover:bg-bg-alt">
          {buscando ? "Buscando…" : "Buscar no mapa"}
        </button>
        <button type="button" onClick={aqui} className="h-10 shrink-0 rounded-full border border-line px-4 text-sm font-medium hover:bg-bg-alt">
          Estou no local
        </button>
      </div>
      {resultados.length > 0 && (
        <ul className="divide-y divide-line rounded-2xl border border-line text-sm">
          {resultados.map((r) => (
            <li key={`${r.lat},${r.lng}`}>
              <button type="button" onClick={() => usar(r)} className="w-full px-4 py-2 text-left hover:bg-bg-alt">
                {r.nome}
              </button>
            </li>
          ))}
        </ul>
      )}
      {aviso && <p className="text-sm text-ink-2">{aviso}</p>}
      <div className="grid gap-2 sm:grid-cols-3">
        <input name="lat" required inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="Latitude (ex.: -1.4558)" className={field} />
        <input name="lng" required inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="Longitude (ex.: -48.4902)" className={field} />
        <Select name="raio" aria-label="Raio aceito" defaultValue="150" className={field}>
          {[50, 100, 150, 200, 300, 500, 1000].map((m) => (
            <option key={m} value={m}>
              Até {m} m do ponto
            </option>
          ))}
        </Select>
      </div>
      {coords && (
        <p className="text-sm">
          <a href={`https://www.google.com/maps?q=${coords}`} target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-4 hover:underline">
            Conferir o ponto no Google Maps ↗
          </a>
        </p>
      )}
      {state.error && <p className="text-sm text-bad">{state.error}</p>}
      {state.ok && <p className="text-sm text-good">Local salvo.</p>}
      <button type="submit" disabled={pending} className={submit}>
        {pending ? "Salvando…" : "Adicionar local"}
      </button>
    </form>
  );
}
