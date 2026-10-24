import { describe, expect, it } from "vitest";
import { parseCoords } from "@/lib/coords";

const ok = (lat: number, lng: number) => ({ ok: true, lat, lng });

describe("coordenadas coladas do Google Maps", () => {
  it("par copiado com o botão direito", () => {
    expect(parseCoords("-1.4295874376482127, -48.48514198871012")).toEqual(ok(-1.4295874, -48.485142));
    expect(parseCoords(" -1.4558,-48.4902 ")).toEqual(ok(-1.4558, -48.4902));
  });

  it("vírgula decimal (digitado à mão)", () => {
    expect(parseCoords("-1,4558 -48,4902")).toEqual(ok(-1.4558, -48.4902));
    expect(parseCoords("-1,4558; -48,4902")).toEqual(ok(-1.4558, -48.4902));
  });

  it("graus, minutos e segundos do cartão do local", () => {
    const r = parseCoords(`1°25'46.5"S 48°29'06.5"W`);
    expect(r.ok && [r.lat.toFixed(5), r.lng.toFixed(5)]).toEqual(["-1.42958", "-48.48514"]);
  });

  it("link do Google Maps: o marcador vale mais que o centro do mapa", () => {
    expect(parseCoords("https://www.google.com/maps/place/Loja/@-1.4300,-48.4900,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d-1.4295874!4d-48.4851419")).toEqual(
      ok(-1.4295874, -48.4851419),
    );
    expect(parseCoords("https://www.google.com/maps/@-1.4300,-48.4900,17z")).toEqual(ok(-1.43, -48.49));
  });

  it("recusa invertidas, sem sinal de menos ou texto sem coordenadas", () => {
    expect(parseCoords("-48.4902, -1.4558")).toMatchObject({ ok: false, error: expect.stringContaining("invertidas") });
    expect(parseCoords("1.4558, 48.4902")).toMatchObject({ ok: false, error: expect.stringContaining("fora do Brasil") });
    expect(parseCoords("Tv. Padre Eutíquio, 1198 - Campina")).toMatchObject({ ok: false });
    expect(parseCoords("")).toMatchObject({ ok: false });
  });
});
