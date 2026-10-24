// Coordenadas coladas do Google Maps, em qualquer dos formatos que ele mostra:
//  - "-1.4295874, -48.4851419" (clique com o botão direito no ponto)
//  - "1°25'46.5"S 48°29'06.5"W" (cartão do local)
//  - link do Google Maps (…/@-1.4295,-48.4851,17z… ou …!3d-1.4295!4d-48.4851…)
// Usado no formulário (mostra o ponto lido na hora) e no servidor (que confere de novo).

export type Coords = { lat: number; lng: number };
export type CoordsResult = ({ ok: true } & Coords) | { ok: false; error: string };

const num = (s: string) => Number(s.replace(",", "."));

function dms(texto: string): Coords | null {
  const re = /(\d{1,3})\s*°\s*(\d{1,2})\s*['′]\s*(\d{1,2}(?:[.,]\d+)?)\s*(?:["″]|'')?\s*([NSLOEW])/gi;
  const partes = [...texto.matchAll(re)].map((m) => {
    const valor = Number(m[1]) + Number(m[2]) / 60 + num(m[3]) / 3600;
    const dir = m[4].toUpperCase();
    return { valor: dir === "S" || dir === "W" || dir === "O" ? -valor : valor, eixo: dir === "N" || dir === "S" ? "lat" : "lng" };
  });
  const lat = partes.find((p) => p.eixo === "lat");
  const lng = partes.find((p) => p.eixo === "lng");
  return lat && lng ? { lat: lat.valor, lng: lng.valor } : null;
}

function find(texto: string): Coords | null {
  // Link: o marcador (!3d…!4d…) é o ponto exato; o @ é o centro do mapa
  const marcador = texto.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (marcador) return { lat: Number(marcador[1]), lng: Number(marcador[2]) };
  const centro = texto.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (centro) return { lat: Number(centro[1]), lng: Number(centro[2]) };
  if (/°/.test(texto)) return dms(texto);
  // Par de números: "-1.42, -48.48", "-1.42 -48.48" ou com vírgula decimal "-1,42 -48,48" / "-1,42; -48,48"
  const par = texto.match(/(-?\d{1,3}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)/);
  return par ? { lat: num(par[1]), lng: num(par[2]) } : null;
}

export function parseCoords(texto: string): CoordsResult {
  const t = texto.trim();
  if (!t) return { ok: false, error: "Cole as coordenadas do Google Maps." };
  const c = find(t);
  if (!c || !Number.isFinite(c.lat) || !Number.isFinite(c.lng)) {
    return { ok: false, error: "Não entendi as coordenadas. No Google Maps, clique com o botão direito no ponto e clique nos números para copiar." };
  }
  // Brasil: latitude de -34 a 6, longitude de -74 a -28. Fora disso, quase sempre é sinal trocado ou ordem invertida.
  const noBrasil = (p: Coords) => p.lat >= -34 && p.lat <= 6 && p.lng >= -74 && p.lng <= -28;
  if (!noBrasil(c)) {
    if (noBrasil({ lat: c.lng, lng: c.lat })) return { ok: false, error: "Latitude e longitude parecem invertidas: a latitude vem primeiro (em Belém, perto de -1,4)." };
    return { ok: false, error: "Essas coordenadas ficam fora do Brasil. Confira se copiou com o sinal de menos (em Belém: -1,4… e -48,4…)." };
  }
  return { ok: true, lat: Math.round(c.lat * 1e7) / 1e7, lng: Math.round(c.lng * 1e7) / 1e7 };
}
