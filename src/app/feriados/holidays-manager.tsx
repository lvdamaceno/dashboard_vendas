import Link from "next/link";
import { listHolidayAdjustments } from "@/lib/feriados";
import { holidays } from "@/lib/workdays";
import { openOnHoliday, resetHoliday } from "./actions";
import { ConfirmSubmit, CopyHolidaysForm, HolidayForm, OpenDayForm } from "./forms";
import { env } from "@/lib/env";

const card = "rounded-3xl border border-line bg-surface p-5";
const small = "h-9 shrink-0 rounded-full border border-line px-4 text-sm font-medium hover:bg-bg-alt";
const fmtDay = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: "UTC" });
const dia = (d: string) => fmtDay.format(new Date(`${d}T12:00:00Z`));

/** Feriados do ano (calendário calculado + ajustes): usado na área de metas e na aba do admin. */
export async function HolidaysManager({ ano, yearHref }: { ano: number; yearHref: (ano: number) => string }) {
  const ajustes = await listHolidayAdjustments(ano);
  const ajuste = new Map(ajustes.map((a) => [a.dia, a]));
  const calendario = holidays(ano);
  const criados = ajustes.filter((a) => a.fecha && !calendario.some((h) => h.dia === a.dia));
  // Dias abertos fora do expediente normal (ex.: domingos), que não são feriados do calendário
  const semana = env().META_DIAS_SEMANA;
  const extras = ajustes.filter((a) => !a.fecha && !calendario.some((h) => h.dia === a.dia) && !semana.includes(new Date(`${a.dia}T12:00:00Z`).getUTCDay()));

  return (
    <>
      <section className={card}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base">Feriados de {ano}</h2>
          <div className="flex gap-2">
            <Link href={yearHref(ano - 1)} className={`${small} leading-9`}>
              ‹ {ano - 1}
            </Link>
            <Link href={yearHref(ano + 1)} className={`${small} leading-9`}>
              {ano + 1} ›
            </Link>
          </div>
        </div>
        <div className="mb-3">
          <CopyHolidaysForm year={ano} />
        </div>
        <p className="mb-3 text-sm text-ink-2">
          Nacionais, estadual do Pará e municipais de Belém, calculados para cada ano (não precisa cadastrar de novo). Dias sem expediente não
          entram na conta das metas diárias. Se a loja abrir num feriado, toque em <strong>A loja abre</strong>.
        </p>
        <ul className="divide-y divide-line">
          {calendario.map((h) => {
            const abre = ajuste.get(h.dia)?.fecha === false;
            return (
              <li key={h.dia} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className={`font-medium ${abre ? "text-ink-3 line-through" : ""}`}>{h.nome}</p>
                  <p className="text-xs text-ink-3 capitalize">{dia(h.dia)}</p>
                </div>
                {abre && <span className="rounded-full bg-good/15 px-2 py-0.5 text-xs font-medium text-good">Loja abre</span>}
                <form action={abre ? resetHoliday : openOnHoliday}>
                  <input type="hidden" name="dia" value={h.dia} />
                  <input type="hidden" name="nome" value={h.nome} />
                  <button type="submit" className={small}>
                    {abre ? "Voltar a ser feriado" : "A loja abre"}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      </section>
      <section className={card}>
        <h2 className="mb-1 text-base">Criar feriado</h2>
        <p className="mb-3 text-sm text-ink-2">Para decretos, feriados novos ou dias em que as lojas fecham. Vale para todas as lojas.</p>
        <HolidayForm year={ano} />
        {criados.length > 0 && (
          <ul className="mt-4 divide-y divide-line">
            {criados.map((c) => (
              <li key={c.dia} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{c.nome}</p>
                  <p className="text-xs text-ink-3 capitalize">{dia(c.dia)}</p>
                </div>
                <form action={resetHoliday}>
                  <input type="hidden" name="dia" value={c.dia} />
                  <ConfirmSubmit message={`Remover o feriado "${c.nome}"?`} className={small}>
                    Remover
                  </ConfirmSubmit>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className={card}>
        <h2 className="mb-1 text-base">Domingo com expediente</h2>
        <p className="mb-3 text-sm text-ink-2">
          Normalmente a loja abre de segunda a sábado. Quando abrir num domingo, marque aqui: ele passa a contar como dia útil e entra na
          divisão da meta daquele mês. Não é copiado para o ano seguinte.
        </p>
        <OpenDayForm year={ano} />
        {extras.length > 0 && (
          <ul className="mt-4 divide-y divide-line">
            {extras.map((c) => (
              <li key={c.dia} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{c.nome}</p>
                  <p className="text-xs text-ink-3 capitalize">{dia(c.dia)}</p>
                </div>
                <form action={resetHoliday}>
                  <input type="hidden" name="dia" value={c.dia} />
                  <ConfirmSubmit message="Tirar este dia do expediente?" className={small}>
                    Remover
                  </ConfirmSubmit>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
