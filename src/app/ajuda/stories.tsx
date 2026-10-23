"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Logo } from "@/components/logo";

export type Story = { section: number | null; content: React.ReactNode };

// Tempo para ler uma tela: devagar (150 palavras por minuto) e um pouco mais quando tem imagem.
// Animações (GIF) marcam a própria duração em data-duracao: a tela fica pelo menos até a animação terminar.
function readingTime(slide: HTMLElement) {
  const words = (slide.textContent ?? "").split(/\s+/).filter(Boolean).length;
  const images = slide.querySelectorAll("figure").length;
  const anim = [...slide.querySelectorAll<HTMLElement>("[data-duracao]")].reduce((max, el) => Math.max(max, Number(el.dataset.duracao) || 0), 0);
  return Math.max(5000, anim + 2500, Math.min(25000, 2000 + words * 400 + images * 2500));
}

/**
 * Guia em formato de "status do WhatsApp": uma tela por vez, passando para o lado.
 * Arrastar, tocar nas laterais, os botões de baixo ou as setas do teclado trocam de tela.
 * As telas passam sozinhas no tempo de leitura; segurar o dedo na tela ou o botão de pausa param.
 * No topo, uma barrinha por seção vai enchendo conforme a leitura.
 */
export function Stories({ sections, slides }: { sections: readonly (readonly [string, string])[]; slides: Story[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [holding, setHolding] = useState(false);
  // Quanto da tela atual já passou no tempo de leitura (0 a 1)
  const [progress, setProgress] = useState(0);
  const elapsed = useRef(0);
  const pressedAt = useRef(0);
  const total = slides.length;

  const goTo = useCallback(
    (i: number, behavior: ScrollBehavior = "smooth") => {
      const el = track.current;
      if (!el) return;
      const target = Math.max(0, Math.min(total - 1, i));
      el.scrollTo({ left: target * el.clientWidth, behavior });
    },
    [total],
  );

  const goToSection = useCallback(
    (id: string, behavior?: ScrollBehavior) => {
      const s = sections.findIndex(([sid]) => sid === id);
      const i = slides.findIndex((slide) => slide.section === s);
      if (s >= 0 && i >= 0) goTo(i, behavior);
    },
    [sections, slides, goTo],
  );

  // Abre direto na seção do endereço (ex.: /ajuda#cartao)
  useEffect(() => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (id) goToSection(id, "instant");
  }, [goToSection]);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => setIndex(Math.round(el.scrollLeft / el.clientWidth));
    // Ao girar o celular, mantém a mesma tela
    const onResize = () => el.scrollTo({ left: index * el.clientWidth, behavior: "instant" });
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goTo(index + 1);
      else if (e.key === "ArrowLeft") goTo(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, goTo]);

  useEffect(() => {
    elapsed.current = 0;
    setProgress(0);
  }, [index]);

  useEffect(() => {
    const slide = track.current?.children[index] as HTMLElement | undefined;
    if (paused || holding || !slide || index === total - 1) return;
    const duration = readingTime(slide);
    let last = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      // Limita o salto ao voltar de outra aba, quando o navegador para de desenhar
      elapsed.current += Math.min(now - last, 100);
      last = now;
      const p = Math.min(1, elapsed.current / duration);
      setProgress(p);
      if (p < 1) frame = requestAnimationFrame(tick);
      else goTo(index + 1);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [index, paused, holding, total, goTo]);

  const current = slides[index]?.section ?? null;

  // Guarda a seção no endereço, para compartilhar ou voltar ao mesmo ponto
  useEffect(() => {
    const hash = current === null ? "" : `#${sections[current][0]}`;
    if (location.hash !== hash) history.replaceState(null, "", `${location.pathname}${location.search}${hash}`);
  }, [current, sections]);

  function fill(s: number) {
    if (index === total - 1) return 1;
    if (current === null || s > current) return 0;
    if (s < current) return 1;
    const inSection = slides.flatMap((slide, i) => (slide.section === s ? [i] : []));
    return (inSection.indexOf(index) + progress) / inSection.length;
  }

  // Toque na lateral esquerda volta; no resto da tela, avança
  function onTap(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    const link = target.closest("a");
    if (link?.getAttribute("href")?.startsWith("#")) {
      e.preventDefault();
      goToSection(link.getAttribute("href")!.slice(1));
      return;
    }
    // Soltar o dedo depois de segurar (pausa) não troca de tela
    if (link || target.closest("button") || performance.now() - pressedAt.current > 400) return;
    if (e.clientX < window.innerWidth / 3) goTo(index - 1);
    else goTo(index + 1);
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-bg">
      <header className="bg-[#d71921] pt-[env(safe-area-inset-top)] text-white">
        <div className="mx-auto max-w-3xl px-3 pt-2">
          <div
            className="flex gap-1"
            role="progressbar"
            aria-label="Progresso da leitura"
            aria-valuemin={1}
            aria-valuemax={total}
            aria-valuenow={index + 1}
          >
            {sections.map(([id, title], s) => (
              <button
                key={id}
                type="button"
                onClick={() => goToSection(id)}
                aria-label={`Ir para ${title}`}
                className="h-4 flex-1 py-1.5"
              >
                <span className="block h-1 overflow-hidden rounded-full bg-white/35">
                  <span
                    className={`block h-full rounded-full bg-white ${s === current ? "" : "transition-[width] duration-300 motion-reduce:transition-none"}`}
                    style={{ width: `${fill(s) * 100}%` }}
                  />
                </span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 pt-1 pb-2.5">
            <Logo variant="white" className="h-6 w-auto shrink-0" title="Casa Contente" />
            <p className="min-w-0 flex-1 truncate font-title text-sm text-white/90">
              {current === null ? "Como usar o painel" : `${current + 1}. ${sections[current][1]}`}
            </p>
            <span className="tabular shrink-0 rounded-full bg-black/15 px-2.5 py-1 font-title text-sm font-medium" aria-live="polite">
              {index + 1}/{total}
            </span>
            <button
              type="button"
              onClick={() => setPaused(!paused)}
              aria-label={paused ? "Continuar passando sozinho" : "Pausar"}
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
            >
              {paused ? (
                <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
                  <path d="M8 5v14l11-7z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
                  <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
                </svg>
              )}
            </button>
            <Link
              href="/dashboard"
              aria-label="Fechar o guia e abrir o painel"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-lg leading-none hover:bg-white/25"
            >
              ✕
            </Link>
          </div>
        </div>
      </header>

      <div
        ref={track}
        onClick={onTap}
        onPointerDown={() => {
          pressedAt.current = performance.now();
          setHolding(true);
        }}
        onPointerUp={() => setHolding(false)}
        onPointerCancel={() => setHolding(false)}
        onPointerLeave={() => setHolding(false)}
        onContextMenu={(e) => e.preventDefault()}
        className="flex flex-1 snap-x snap-mandatory overflow-x-auto select-none [-webkit-touch-callout:none] overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((slide, i) => (
          <section
            key={i}
            aria-roledescription="tela"
            aria-label={`${i + 1} de ${total}`}
            aria-hidden={i !== index}
            inert={i !== index}
            className="h-full w-full shrink-0 snap-start snap-always overflow-y-auto"
          >
            <div className="mx-auto flex min-h-full max-w-md flex-col px-5 py-6">{slide.content}</div>
          </section>
        ))}
      </div>

      <nav className="border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]" aria-label="Navegação do guia">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            disabled={index === 0}
            className="h-11 rounded-full px-4 font-title text-base font-medium text-ink-2 hover:bg-bg-alt disabled:opacity-0"
          >
            ‹ Voltar
          </button>
          <p className="flex-1 text-center text-xs text-ink-3">{paused ? "Pausado" : index === 0 ? "Segure a tela para pausar" : ""}</p>
          {index < total - 1 ? (
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              className="h-11 rounded-full bg-accent px-6 font-title text-base font-medium text-white hover:bg-accent-dark"
            >
              Avançar ›
            </button>
          ) : (
            <Link href="/dashboard" className="flex h-11 items-center rounded-full bg-accent px-6 font-title text-base font-medium text-white hover:bg-accent-dark">
              Abrir o painel
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
}
