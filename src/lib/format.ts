const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlCompact = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });
const num = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

export const money = (v: number) => brl.format(v);
export const moneyCompact = (v: number) => brlCompact.format(v);
export const number = (v: number) => num.format(v);

const pct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });
/** fração (0,123) como porcentagem (12,3%) */
export const percent = (v: number) => pct.format(v);
