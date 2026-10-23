// Conta da meta diária (função pura, sem banco nem Sankhya — testada em tests/goal-math.test.ts).
//
//  - meta diária base = meta do mês ÷ dias úteis do mês;
//  - saldo = vendido até ontem − base × dias úteis que já passaram (positivo = sobra; negativo = devendo);
//  - meta de hoje = base − saldo (nunca abaixo de zero): quem vendeu mais tem meta menor hoje, quem vendeu menos, maior;
//  - folga, férias e atestado não mudam nada: o dia continua valendo, e quem não vendeu fica devendo
//    (folgou um dia, no seguinte a meta é de dois dias);
//  - projeção = vendido ÷ dias úteis decorridos × dias úteis do mês.

export interface GoalInput {
  /** Meta do mês */
  meta: number;
  /** Vendido no mês até agora (inclui hoje) */
  realizado: number;
  /** Vendido hoje */
  hoje: number;
  /** Dias úteis do mês (AAAA-MM-DD) */
  diasUteis: string[];
  today: string;
}

export interface GoalMath {
  meta: number;
  base: number;
  saldo: number;
  /** null quando hoje não é dia útil */
  metaHoje: number | null;
  projecao: number;
  /** Quanto vender por dia útil depois de hoje para bater (null: não restam dias ou já bateu) */
  ritmoNecessario: number | null;
  diasUteis: number;
  /** Dias úteis depois de hoje */
  diasDepoisDeHoje: number;
}

export function goalMath({ meta, realizado, hoje, diasUteis, today }: GoalInput): GoalMath {
  const n = diasUteis.length;
  const passados = diasUteis.filter((d) => d < today).length;
  const hojeUtil = diasUteis.includes(today);
  const decorridos = passados + (hojeUtil ? 1 : 0);
  const depois = n - decorridos;
  const base = n ? meta / n : 0;
  const saldo = realizado - hoje - base * passados;
  return {
    meta,
    base,
    saldo,
    metaHoje: hojeUtil ? Math.max(0, base - saldo) : null,
    projecao: decorridos ? (realizado / decorridos) * n : realizado,
    ritmoNecessario: depois > 0 && realizado < meta ? (meta - realizado) / depois : null,
    diasUteis: n,
    diasDepoisDeHoje: depois,
  };
}
