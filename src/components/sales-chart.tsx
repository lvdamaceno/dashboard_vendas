"use client";

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { money, moneyCompact } from "@/lib/format";
import { formatDay } from "@/lib/period";

interface Point {
  dia: string;
  total: number;
  pedidos: number;
}

const shortDay = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-md">
      <p className="text-ink-3">{formatDay(p.dia)}</p>
      <p className={`tabular mt-0.5 text-sm font-medium ${p.total < 0 ? "text-bad" : "text-ink"}`}>{money(p.total)}</p>
      <p className="tabular text-ink-2">
        {p.pedidos} {p.pedidos === 1 ? "pedido" : "pedidos"}
      </p>
    </div>
  );
}

export function SalesChart({ data }: { data: Point[] }) {
  return (
    <div className="h-52 md:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="dia"
            tickFormatter={shortDay}
            tick={{ fill: "var(--text-3)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            tickFormatter={(v: number) => moneyCompact(v)}
            tick={{ fill: "var(--text-3)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={64}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--accent-soft)" }} />
          <ReferenceLine y={0} stroke="var(--text-3)" />
          <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false}>
            {/* dia com mais devolução que venda fica negativo, em vermelho */}
            {data.map((p) => (
              <Cell key={p.dia} fill={p.total < 0 ? "var(--bad)" : "var(--accent)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
