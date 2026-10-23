/**
 * Caixa de seleção com a seta desenhada, afastada da borda arredondada (a seta nativa fica colada no canto).
 * className vai para o <select> (aparência do campo); wrapperClassName, para o contêiner (largura no layout).
 */
export function Select({ className = "", wrapperClassName = "", ...props }: React.ComponentProps<"select"> & { wrapperClassName?: string }) {
  return (
    <div className={`relative ${wrapperClassName}`}>
      <select {...props} className={`${className} w-full cursor-pointer appearance-none pr-11`} />
      <svg
        viewBox="0 0 20 20"
        className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-ink-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden
      >
        <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
