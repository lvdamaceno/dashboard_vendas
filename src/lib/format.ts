const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlCompact = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });
const num = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

export const money = (v: number) => brl.format(v);
export const moneyCompact = (v: number) => brlCompact.format(v);
export const number = (v: number) => num.format(v);
