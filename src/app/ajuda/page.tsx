import type { Metadata } from "next";
import { Logo, Smile } from "@/components/logo";
import { Stories, type Story } from "./stories";

export const metadata: Metadata = {
  title: "Como usar · Painel de Vendas",
  description: "Guia passo a passo do Painel de Vendas da Casa Contente",
};

// Capturas de tela em public/ajuda (tiradas com dados de exemplo), com o tamanho real em pixels
const IMAGES = {
  login: [780, 1688],
  "login-cpf": [780, 440],
  "login-erro": [780, 512],
  painel: [780, 1688],
  "painel-vendedor": [780, 1688],
  cabecalho: [780, 128],
  filtros: [764, 252],
  "filtros-vendedor": [764, 148],
  "filtro-periodo": [764, 460],
  "periodo-texto": [756, 72],
  indicadores: [764, 552],
  "indicador-faturamento": [394, 324],
  grafico: [764, 692],
  "grafico-detalhe": [764, 692],
  "grafico-tabela": [680, 1364],
  ranking: [764, 492],
  produtos: [764, 492],
  clientes: [764, 492],
  ultimas: [764, 542],
  "cartao-frente": [640, 1126],
  "cartao-verso": [640, 1126],
  "mais-indicadores": [764, 780],
  "por-vendedor": [764, 510],
  categorias: [764, 756],
  devolvidos: [764, 444],
  "dia-semana": [764, 756],
  horario: [764, 1380],
  sumidos: [764, 974],
} as const;

const SECTIONS = [
  ["o-que-e", "O que é o painel"],
  ["entrar", "Como entrar"],
  ["tela", "Conhecendo a tela"],
  ["periodo", "Escolhendo o período"],
  ["numeros", "Entendendo os números"],
  ["grafico", "O gráfico de vendas por dia"],
  ["listas", "As listas"],
  ["mais", "Mais indicadores"],
  ["gerentes", "Para gerentes"],
  ["cartao", "Cartão de visita (WhatsApp)"],
  ["avisos", "Avisos e sugestões"],
  ["fila", "Fila de atendimento"],
  ["metas", "Metas"],
  ["instalar", "Instalar no celular"],
  ["sair", "Sair e segurança"],
  ["duvidas", "Dúvidas frequentes"],
] as const;

function Shot({ name, alt, caption, narrow }: { name: keyof typeof IMAGES; alt: string; caption?: string; narrow?: boolean }) {
  const [w, h] = IMAGES[name];
  return (
    <figure className={`mx-auto my-3 ${narrow ? "max-w-[300px]" : "max-w-[390px]"}`}>
      <img
        src={`/ajuda/${name}.png`}
        alt={alt}
        width={w / 2}
        height={h / 2}
        className="mx-auto h-auto max-h-[48dvh] w-auto max-w-full rounded-2xl border border-line shadow-sm"
      />
      {caption && <figcaption className="mt-2 text-center text-sm text-ink-2">{caption}</figcaption>}
    </figure>
  );
}

/** Uma tela do guia: o número e o nome da seção, e um pedaço curto do conteúdo. */
function Slide({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <>
      <h2 className="flex items-center gap-3 text-xl">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent font-title text-base text-white">{n}</span>
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-[17px] leading-relaxed">{children}</div>
    </>
  );
}

function Steps({ children, start }: { children: React.ReactNode; start?: number }) {
  return <ol start={start} className="list-decimal space-y-2 pl-6 marker:font-title marker:font-semibold marker:text-accent">{children}</ol>;
}

function Tip({ children, kind = "dica" }: { children: React.ReactNode; kind?: "dica" | "atencao" }) {
  return (
    <div className={`rounded-2xl p-4 text-[15px] ${kind === "dica" ? "bg-bg-alt" : "bg-accent-soft"}`}>
      <p className="mb-1 font-title font-semibold">{kind === "dica" ? "💡 Dica" : "⚠️ Atenção"}</p>
      {children}
    </div>
  );
}

function Term({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="font-title text-lg font-semibold">{name}</p>
      <div className="mt-1 text-[15px] text-ink-2">{children}</div>
    </div>
  );
}

// --- Ilustrações das telas do celular (não dá para capturar a tela do sistema do telefone) ---

function Phone({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <figure className="mx-auto my-4 w-60">
      <div className="overflow-hidden rounded-[2rem] border-[6px] border-[#2b2b2a] bg-[#faf8f5] shadow-lg" aria-hidden>
        <div className="relative flex h-96 flex-col text-[#3c3c3a]">{children}</div>
      </div>
      <figcaption className="mt-2 text-center text-sm text-ink-2">{label}</figcaption>
    </figure>
  );
}

const MiniApp = () => (
  <>
    <div className="flex h-9 items-center bg-[#d71921] px-3">
      <Logo variant="white" className="h-4 w-auto" />
    </div>
    <div className="space-y-2 p-3">
      <div className="h-6 rounded-full bg-white ring-1 ring-[#e7e1d8]" />
      <div className="grid grid-cols-2 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-12 rounded-xl bg-white ring-1 ring-[#e7e1d8]" />
        ))}
      </div>
      <div className="h-24 rounded-xl bg-white ring-1 ring-[#e7e1d8]" />
    </div>
  </>
);

const Highlight = ({ className = "" }: { className?: string }) => (
  <span className={`absolute rounded-full ring-4 ring-[#d71921] ${className}`}>
    <span className="absolute inset-0 animate-ping rounded-full ring-2 ring-[#d71921] motion-reduce:hidden" />
  </span>
);

const ShareIcon = () => (
  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="#0a84ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v12M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
  </svg>
);

function SafariBar({ highlight }: { highlight?: boolean }) {
  return (
    <div className="relative mt-auto border-t border-[#ddd] bg-[#f2f2f2] px-3 pt-2 pb-3">
      <div className="mb-2 rounded-lg bg-white px-2 py-1 text-center text-[10px] text-[#555]">Painel de Vendas</div>
      <div className="flex items-center justify-between px-2 text-[#0a84ff]">
        <span>‹</span>
        <span>›</span>
        <span className="relative">
          <ShareIcon />
          {highlight && <Highlight className="-inset-2" />}
        </span>
        <span className="text-sm">📖</span>
        <span className="text-sm">⧉</span>
      </div>
    </div>
  );
}

function ChromeBar({ highlight }: { highlight?: boolean }) {
  return (
    <div className="flex items-center gap-2 border-b border-[#ddd] bg-white px-2 py-2">
      <span className="text-xs">⌂</span>
      <div className="flex-1 rounded-full bg-[#f1f3f4] px-2 py-1 text-[10px] text-[#555]">Painel de Vendas</div>
      <span className="relative px-1 text-base leading-none font-bold">
        ⋮{highlight && <Highlight className="-inset-1.5" />}
      </span>
    </div>
  );
}

function MenuSheet({ items, active }: { items: string[]; active: string }) {
  return (
    <div className="absolute inset-x-2 bottom-2 rounded-2xl bg-white p-2 text-[11px] shadow-xl ring-1 ring-black/10">
      {items.map((item) => (
        <div
          key={item}
          className={`relative flex items-center justify-between rounded-lg px-2 py-2 ${item === active ? "font-semibold" : "text-[#555]"}`}
        >
          {item}
          {item === active && <Highlight className="-inset-0.5 rounded-lg" />}
        </div>
      ))}
    </div>
  );
}

function HomeScreen() {
  const apps = ["#4cd964", "#5ac8fa", "#ff9500", "#8e8e93", "#ff2d55", "#5856d6"];
  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#3a6ea5] to-[#1f3b5c] p-4">
      <div className="grid grid-cols-4 gap-4">
        {apps.map((c) => (
          <div key={c} className="flex flex-col items-center gap-1">
            <div className="size-10 rounded-xl" style={{ background: c }} />
            <div className="h-1.5 w-8 rounded bg-white/40" />
          </div>
        ))}
        <div className="relative flex flex-col items-center gap-1">
          <img src="/icons/icon-192.png" alt="" className="size-10 rounded-xl" />
          <span className="text-[9px] text-white">Vendas</span>
          <Highlight className="-inset-1 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

// Cada seção vira algumas telas curtas, na mesma ordem do guia
const CONTENT: Record<(typeof SECTIONS)[number][0], React.ReactNode[]> = {
  "o-que-e": [
    <>
      <p>
        O Painel de Vendas é uma página na internet que mostra <strong>quanto você vendeu</strong>: hoje, nesta semana, neste mês ou em
        qualquer intervalo de datas que você escolher.
      </p>
      <p>
        Os números vêm direto do sistema da loja (o <strong>Sankhya</strong>), o mesmo onde os pedidos são lançados. Você não precisa
        digitar nada: é só entrar e olhar.
      </p>
    </>,
    <>
      <ul className="list-disc space-y-1 pl-6">
        <li>
          <strong>Vendedor</strong> vê somente as próprias vendas.
        </li>
        <li>
          <strong>Gerente</strong> vê as vendas da loja dele e de cada vendedor da loja.
        </li>
      </ul>
      <Tip>Funciona em qualquer celular, tablet ou computador com internet. Não precisa baixar nada da loja de aplicativos.</Tip>
    </>,
  ],
  entrar: [
    <>
      <p>
        Para entrar você só precisa do seu <strong>CPF</strong>. Não existe senha.
      </p>
      <Steps>
        <li>Abra o endereço do painel no navegador do celular (o Chrome, no Android, ou o Safari, no iPhone).</li>
        <li>
          Toque no campo <strong>CPF</strong> e digite os 11 números do seu CPF. Pode digitar com ou sem pontos e traço.
        </li>
        <li>
          Toque no botão vermelho <strong>Entrar</strong>.
        </li>
      </Steps>
    </>,
    <Shot key="login" name="login" alt="Tela de entrada com o logotipo da Casa Contente e o campo CPF" caption="A tela de entrada" narrow />,
    <>
      <Shot name="login-cpf" alt="Campo CPF preenchido com 123.456.789-09" caption="CPF digitado, pronto para entrar" />
      <Shot name="login-erro" alt="Mensagem em vermelho: Informe um CPF válido" caption="Se aparecer uma mensagem em vermelho, confira o número" />
    </>,
    <>
      <p className="font-title text-lg font-semibold">E se não conseguir entrar?</p>
      <div className="space-y-2">
        <Term name="“Informe um CPF válido.”">Algum número foi digitado errado. Apague e digite de novo com calma.</Term>
        <Term name="“CPF não encontrado como usuário no Sankhya.”">
          Seu CPF ainda não está ligado a um usuário do sistema. Fale com o seu gerente ou com o setor de TI.
        </Term>
        <Term name="“Seu usuário não possui um vendedor vinculado…” ou “…está inativo.”">
          Seu cadastro de vendedor precisa de ajuste. Fale com o seu gerente ou com o setor de TI.
        </Term>
      </div>
    </>,
    <>
      <p className="font-title text-lg font-semibold">E se não conseguir entrar?</p>
      <div className="space-y-2">
        <Term name="“Muitas tentativas. Aguarde 15 minutos…”">
          Por segurança, depois de 5 tentativas erradas o painel espera 15 minutos. Depois disso, tente de novo.
        </Term>
        <Term name="“Não foi possível conectar ao Sankhya.”">
          O sistema da loja não respondeu. Confira se o celular está com internet e tente de novo em alguns minutos.
        </Term>
      </div>
    </>,
  ],
  tela: [
    <>
      <p>Depois de entrar, você vê a tela principal.</p>
      <Shot name="painel" alt="Tela principal do painel com cabeçalho vermelho, filtros e indicadores" caption="A tela principal do painel" narrow />
    </>,
    <>
      <p>De cima para baixo, ela tem:</p>
      <Steps>
        <li>
          <strong>Faixa vermelha</strong> no topo, com o seu nome, se você é vendedor ou gerente, e o botão <strong>Sair</strong>.
        </li>
        <li>
          <strong>Botões de período</strong> (Hoje, Semana, Mês, Período) e o botão do <strong>cartão de visita</strong>.
        </li>
        <li>
          <strong>Quatro quadros com os números principais</strong>: faturamento, pedidos, ticket médio e clientes.
        </li>
        <li>
          <strong>Gráfico</strong> com quanto foi vendido em cada dia.
        </li>
        <li>
          <strong>Listas</strong>: produtos mais vendidos, principais clientes e últimas vendas.
        </li>
      </Steps>
    </>,
    <>
      <Shot name="cabecalho" alt="Faixa vermelha com o logotipo, o nome LUCAS, a função Gerente e o botão Sair" caption="A faixa do topo mostra quem está usando o painel" />
      <Tip>Para ver tudo, arraste a tela para cima com o dedo, como em qualquer site.</Tip>
    </>,
  ],
  periodo: [
    <>
      <p>
        Os botões arredondados no topo escolhem <strong>de quais dias</strong> você quer ver as vendas. O botão vermelho é o que está
        escolhido.
      </p>
      <Shot name="filtros" alt="Botões Hoje, Semana, Mês e Período, com Mês selecionado em vermelho" />
    </>,
    <div className="space-y-2">
      <Term name="Hoje">Só as vendas de hoje.</Term>
      <Term name="Semana">A semana atual, de segunda-feira a sábado.</Term>
      <Term name="Mês">O mês atual inteiro, do dia 1º até o último dia. É o que aparece quando você entra.</Term>
      <Term name="Período">Você escolhe a data de início e a data de fim. Bom para comparar uma quinzena, por exemplo.</Term>
    </div>,
    <>
      <p>
        Para usar o <strong>Período</strong>: toque nele, toque em cada data para escolher no calendário e depois toque em{" "}
        <strong>Aplicar período</strong>.
      </p>
      <Shot name="filtro-periodo" alt="Campos de data inicial 01/10/2026 e final 22/10/2026 e o botão Aplicar período" caption="Escolhendo um período personalizado" />
    </>,
    <>
      <p>Logo abaixo dos botões aparece, em letras pequenas, o período que está sendo mostrado:</p>
      <Shot name="periodo-texto" alt="Texto: 01/10/2026 – 31/10/2026" />
    </>,
  ],
  numeros: [
    <>
      <p>Os quatro quadros resumem as vendas do período escolhido.</p>
      <Shot name="indicadores" alt="Quatro quadros: Faturamento líquido, Pedidos, Ticket médio e Clientes" />
    </>,
    <div className="space-y-2">
      <Term name="Faturamento líquido">
        Quanto foi vendido em reais, <strong>já descontando as devoluções</strong>. Quando houve devolução, aparece embaixo, em vermelho,
        quanto foi devolvido.
      </Term>
      <Term name="Pedidos">Quantas vendas foram feitas. Devoluções não contam aqui.</Term>
    </div>,
    <div className="space-y-2">
      <Term name="Ticket médio">
        Quanto, em média, cada pedido rendeu. É o faturamento dividido pelo número de pedidos. Se subiu, os clientes estão comprando
        mais em cada compra.
      </Term>
      <Term name="Clientes">Quantos clientes diferentes compraram. Um cliente que comprou duas vezes conta uma vez só.</Term>
    </div>,
    <>
      <p className="font-title text-lg font-semibold">As setinhas verdes e vermelhas</p>
      <Shot name="indicador-faturamento" alt="Quadro de faturamento com seta verde para cima: 13,9%" narrow />
      <ul className="list-disc space-y-1 pl-6">
        <li>
          <span className="font-semibold text-good">▲ verde</span>: você está <strong>melhor</strong> que no período anterior.
        </li>
        <li>
          <span className="font-semibold text-bad">▼ vermelha</span>: você está <strong>abaixo</strong> do período anterior.
        </li>
      </ul>
    </>,
    <Tip key="tip">
      A comparação é justa: se hoje é dia 22, o mês atual é comparado com o mês passado <strong>até o dia 22</strong>, e não com o mês
      passado inteiro. Na semana, vale o mesmo: até o mesmo dia da semana.
    </Tip>,
  ],
  grafico: [
    <>
      <p>
        Cada <strong>barra vermelha é um dia</strong>. Quanto mais alta a barra, mais foi vendido naquele dia. Os dias que ainda não
        chegaram aparecem vazios.
      </p>
      <Shot name="grafico" alt="Gráfico de barras vermelhas do faturamento por dia em outubro" />
    </>,
    <>
      <p>
        <strong>Toque em uma barra</strong> para ver o dia, o valor exato e quantos pedidos foram feitos.
      </p>
      <Shot name="grafico-detalhe" alt="Gráfico com um balão mostrando 11/10/2026, R$ 10.190,00, 3 pedidos" caption="Tocando em uma barra aparecem os detalhes do dia" />
    </>,
    <Tip key="tip" kind="atencao">
      Uma barra <strong>para baixo da linha do zero</strong> é um dia em que as devoluções foram maiores que as vendas.
    </Tip>,
    <>
      <p>
        Prefere números a gráfico? Toque em <strong>Ver em tabela</strong>, embaixo do gráfico, e aparece a lista dia a dia.
      </p>
      <Shot name="grafico-tabela" alt="Tabela com data, número de pedidos e valor de cada dia" narrow />
    </>,
  ],
  listas: [
    <>
      <p>
        Cada lista mostra os maiores primeiro. A <strong>barrinha vermelha</strong> embaixo de cada nome ajuda a comparar: quanto mais
        cheia, mais vendeu.
      </p>
      <Shot name="produtos" alt="Lista de produtos mais vendidos com valor e quantidade" caption="Produtos mais vendidos: valor e quantidade (un. = unidades)" />
    </>,
    <Shot key="clientes" name="clientes" alt="Lista dos principais clientes com valor e número de pedidos" caption="Principais clientes: quem mais comprou no período" />,
    <>
      <p>
        No fim da página ficam as <strong>últimas vendas e devoluções</strong>, da mais recente para a mais antiga, com a data, o número da
        nota e o valor.
      </p>
      <Shot name="ultimas" alt="Lista das últimas vendas, com uma devolução marcada em vermelho" caption="Devoluções aparecem com a etiqueta “Devolução” e o valor em vermelho, com sinal de menos" />
    </>,
  ],
  mais: [
    <>
      <p>
        Logo abaixo dos quatro quadros principais ficam <strong>mais indicadores</strong>, que mostram como as vendas estão sendo feitas.
        Eles também comparam com o período anterior.
      </p>
      <Shot name="mais-indicadores" alt="Quadros de peças por atendimento, desconto médio, taxa de devolução, clientes novos e margem bruta" />
    </>,
    <div key="termos-1" className="space-y-2">
      <Term name="Peças por atendimento">
        Quantas peças, em média, cada cliente levou em uma compra. Se subiu, você está oferecendo mais coisas junto com o que o cliente
        veio buscar.
      </Term>
      <Term name="Desconto médio">
        Quanto de desconto foi dado, em média, sobre o valor dos produtos. Embaixo aparece o total de descontos em reais.
      </Term>
    </div>,
    <>
      <div className="space-y-2">
        <Term name="Taxa de devolução">Quanto do que foi vendido voltou em devolução. Embaixo aparece o valor devolvido.</Term>
        <Term name="Clientes novos">
          Quantos clientes compraram <strong>pela primeira vez</strong> no período. Embaixo, quantos já eram clientes antes.
        </Term>
      </div>
      <Tip>
        No desconto e na devolução, <strong>cair é bom</strong>: por isso a seta para baixo aparece em verde e a seta para cima em
        vermelho.
      </Tip>
    </>,
    <>
      <p>
        <strong>Vendas por categoria</strong> mostra quais tipos de produto mais venderam: cama e banho, cozinha, eletroportáteis e assim
        por diante.
      </p>
      <Shot name="categorias" alt="Lista de vendas por categoria com valor e quantidade" />
    </>,
    <>
      <p>
        <strong>Produtos mais devolvidos</strong> mostra quais produtos voltaram mais em devolução no período. Ajuda a perceber defeito ou
        produto que não atende o que o cliente esperava.
      </p>
      <Shot name="devolvidos" alt="Lista dos produtos mais devolvidos com valor e quantidade" />
    </>,
    <>
      <p>
        <strong>Vendas por dia da semana</strong> mostra em quais dias a loja vende mais. Aparece quando o período tem pelo menos uma
        semana.
      </p>
      <Shot name="dia-semana" alt="Lista de vendas de segunda a sábado, com sábado como o dia mais forte" />
    </>,
    <>
      <p>
        <strong>Vendas por horário</strong> mostra em que horas do dia saem mais vendas. Bom para saber os horários de mais movimento.
      </p>
      <Shot name="horario" alt="Lista de vendas por faixa de horário, das 8h às 20h" narrow />
    </>,
    <>
      <p>
        <strong>Clientes para chamar de volta</strong> lista quem comprou 2 vezes ou mais no último ano e não volta há mais de 60 dias.
        Essa lista não muda com o período escolhido.
      </p>
      <Shot name="sumidos" alt="Lista de clientes que pararam de comprar, com a data da última compra e o botão verde do WhatsApp" />
    </>,
    <Tip key="tip">
      Toque no <strong>botão verde</strong> ao lado do nome para abrir uma conversa com o cliente no WhatsApp. Quando o cadastro do
      cliente não tem celular, aparece “sem celular”. Se o cliente disser que não quer voltar, toque no <strong>×</strong> para tirá-lo
      da lista; se ele comprar de novo, volta a aparecer.
    </Tip>,
  ],
  gerentes: [
    <>
      <p>Quem é gerente tem duas coisas a mais:</p>
      <Steps>
        <li>
          Uma caixa <strong>Todos os vendedores</strong>, logo abaixo dos períodos. Toque nela e escolha um nome para ver só as vendas
          daquele vendedor. Para voltar a ver todos, escolha <strong>Todos os vendedores</strong>.
        </li>
        <li>
          O <strong>Ranking de vendedores</strong>, com quem vendeu mais no período. Tocar no nome de um vendedor abre as vendas dele.
        </li>
      </Steps>
    </>,
    <Shot key="ranking" name="ranking" alt="Ranking de vendedores: LUCAS, ANA e BRUNO, com valores e pedidos" />,
    <>
      <p>Para comparação, o vendedor não tem a caixa de escolher vendedor nem o ranking: ele vê só as próprias vendas.</p>
      <Shot name="filtros-vendedor" alt="Botões de período sem a caixa de escolher vendedor" caption="Como o vendedor vê os botões do topo" />
    </>,
    <>
      <p>
        O gerente também vê os <strong>Indicadores por vendedor</strong>: peças por atendimento, desconto médio e taxa de devolução de
        cada um, lado a lado.
      </p>
      <Shot name="por-vendedor" alt="Tabela com peças por atendimento, desconto e devolução de LUCAS, ANA, BRUNO e CARLA" />
    </>,
    <>
      <Term name="Margem bruta (só gerente)">
        Quanto sobra das vendas depois de tirar o custo dos produtos. Embaixo aparece esse valor em reais, o lucro bruto.
      </Term>
      <Tip kind="atencao">
        A margem depende do <strong>custo cadastrado</strong> de cada produto. Se faltar custo em parte das vendas, o quadro avisa
        embaixo quanto ficou de fora.
      </Tip>
    </>,
  ],
  cartao: [
    <p key="intro">
      O painel tem um <strong>cartão de visita digital</strong> para mostrar ao cliente. Ele tem o seu nome e o seu WhatsApp, e o cliente
      pode falar com você só apontando a câmera do celular.
    </p>,
    <Steps key="passos">
      <li>
        Toque no botão do cartão, ao lado dos períodos (o desenho de um cartãozinho; no computador aparece escrito <strong>Cartão</strong>).
      </li>
      <li>
        Aparece o cartão vermelho com o <strong>QR code</strong> (o quadrado de pontinhos).
      </li>
      <li>
        Se quiser mostrar o seu nome e telefone escritos, <strong>toque no cartão</strong>: ele vira para o lado amarelo. Tocando de novo,
        volta para o QR code.
      </li>
    </Steps>,
    <div key="fotos" className="grid grid-cols-2 gap-3">
      <Shot name="cartao-verso" alt="Lado vermelho do cartão, com o QR code do WhatsApp" caption="Primeiro aparece o QR code" />
      <Shot name="cartao-frente" alt="Lado amarelo do cartão, com logotipo, nome, cargo e telefone" caption="Tocando, aparece nome e telefone" />
    </div>,
    <Steps key="mostrar" start={4}>
      <li>
        Mostre a tela para o cliente. Ele abre a câmera do celular dele, aponta para o QR code e toca no aviso que aparece: o WhatsApp abre
        já na conversa com você.
      </li>
      <li>
        Para fechar, toque em <strong>Fechar</strong> ou fora do cartão.
      </li>
    </Steps>,
    <>
      <Tip>Aumente o brilho da tela antes de mostrar o QR code: a câmera do cliente lê mais rápido.</Tip>
      <Tip kind="atencao">
        Se aparecer “Telefone não cadastrado” ou o número estiver errado, toque em <strong>Atualizar telefone</strong>, embaixo do
        cartão, digite o celular com DDD e toque em <strong>Salvar</strong>. O QR code passa a usar o número novo. O gerente também
        pode atualizar o telefone da equipe em <strong>Telefones da equipe</strong>, no painel.
      </Tip>
    </>,
  ],
  avisos: [
    <>
      <p>
        No canto de cima, à esquerda, fica o <strong>sino de avisos</strong>. Quando chega um aviso novo, aparece uma bolinha amarela nele.
      </p>
      <Steps>
        <li>Toque no sino para ler os avisos. Os novos aparecem destacados.</li>
        <li>
          Gerentes também podem <strong>enviar avisos para a própria equipe</strong>: toque em <strong>+ Novo aviso para a equipe</strong>,
          escreva o título e a mensagem e toque em <strong>Enviar aviso</strong>.
        </li>
      </Steps>
    </>,
    <>
      <p>
        No canto de baixo, à direita, fica um botão redondo com um balãozinho: é o de <strong>Sugestões e erros</strong>. Use para
        pedir uma melhoria ou contar algo que não funcionou: escolha <strong>Sugestão</strong> ou <strong>Erro</strong>, escreva e toque
        em <strong>Enviar</strong>.
      </p>
      <Tip>No erro, conte o que você estava fazendo e o que apareceu na tela. Isso ajuda a resolver mais rápido.</Tip>
    </>,
  ],
  fila: [
    <>
      <p>
        A <strong>fila de atendimento</strong> organiza quem atende o próximo cliente da loja. Toque no botão <strong>Fila</strong>, ao lado
        dos períodos, para abrir.
      </p>
      <Steps>
        <li>
          Toque em <strong>Entrar na fila</strong>. Quem entrou primeiro atende primeiro: o primeiro da vez aparece como{" "}
          <strong>Próximo a atender</strong>.
        </li>
        <li>
          Quando for atender um cliente, toque em <strong>Atender cliente</strong>. Você vai para o fim da fila.
        </li>
        <li>
          Ao terminar, toque em <strong>Terminei o atendimento</strong>. Você continua na fila, esperando a sua vez de novo.
        </li>
      </Steps>
    </>,
    <>
      <Tip>A fila se atualiza sozinha em todos os celulares da loja. Todo dia às 7h ela começa vazia.</Tip>
      <Tip>
        Coloque a sua foto em <strong>Sua foto na fila</strong>, embaixo da lista: ela aparece ao lado do seu nome para a equipe.
      </Tip>
      <p>O gerente da loja também vê a fila e pode mudar a ordem quando precisar.</p>
    </>,
  ],
  metas: [
    <>
      <p>
        Quando a loja tem meta no mês, o painel mostra dois quadros logo abaixo dos números principais. Eles valem sempre para o mês de
        hoje, qualquer que seja o período escolhido.
      </p>
      <Term name="Meta do mês">
        Quanto da sua meta você já vendeu, quanto falta e onde o mês termina se continuar no mesmo ritmo. O gerente vê a meta da loja.
      </Term>
      <Term name="Meta de hoje">
        A meta do mês dividida pelos dias úteis (sem domingos e feriados), com o saldo dos dias anteriores.
      </Term>
    </>,
    <>
      <p>
        <strong>O saldo passa para o dia seguinte:</strong>
      </p>
      <Steps>
        <li>
          Vendeu <strong>mais</strong> que a meta do dia? A diferença vira <span className="text-good">saldo</span> e a meta de amanhã fica menor.
        </li>
        <li>
          Vendeu <strong>menos</strong>? A diferença fica <span className="text-bad">devendo</span> e a meta de amanhã fica maior.
        </li>
      </Steps>
      <Tip>O gerente vê também as <strong>Metas da equipe</strong>: quanto cada vendedor já fez do mês, a meta de hoje e o saldo.</Tip>
    </>,
  ],
  instalar: [
    <p key="intro">
      Você pode colocar o painel na tela inicial do celular, <strong>como se fosse um aplicativo</strong>. Assim não precisa digitar o
      endereço toda vez: é só tocar no ícone.
    </p>,
    <>
      <h3 className="font-title text-xl font-semibold">📱 iPhone (Safari)</h3>
      <Steps>
        <li>
          Abra o painel no <strong>Safari</strong> (o navegador com a bússola azul).
        </li>
        <li>
          Toque no botão <strong>Compartilhar</strong>: o quadrado com uma seta para cima, na barra de baixo.
        </li>
        <li>
          Arraste a lista para cima e toque em <strong>Adicionar à Tela de Início</strong>.
        </li>
        <li>
          Toque em <strong>Adicionar</strong>, no canto de cima.
        </li>
      </Steps>
    </>,
    <Phone key="ios-2" label="Passo 2: toque em Compartilhar">
      <MiniApp />
      <SafariBar highlight />
    </Phone>,
    <Phone key="ios-3" label="Passo 3: Adicionar à Tela de Início">
      <MiniApp />
      <MenuSheet items={["Copiar", "Adicionar aos Favoritos", "Adicionar à Tela de Início", "Imprimir"]} active="Adicionar à Tela de Início" />
    </Phone>,
    <Phone key="ios-ok" label="Pronto: o ícone na tela inicial">
      <HomeScreen />
    </Phone>,
    <>
      <h3 className="font-title text-xl font-semibold">🤖 Android (Chrome)</h3>
      <Steps>
        <li>
          Abra o painel no <strong>Chrome</strong> (o navegador redondo colorido).
        </li>
        <li>
          Toque nos <strong>três pontinhos</strong> (⋮), no canto de cima à direita.
        </li>
        <li>
          Toque em <strong>Instalar app</strong> (em alguns celulares aparece <strong>Adicionar à tela inicial</strong>).
        </li>
        <li>
          Confirme tocando em <strong>Instalar</strong>.
        </li>
      </Steps>
    </>,
    <Phone key="and-2" label="Passo 2: toque nos três pontinhos">
      <ChromeBar highlight />
      <MiniApp />
    </Phone>,
    <Phone key="and-3" label="Passo 3: Instalar app">
      <ChromeBar />
      <MiniApp />
      <MenuSheet items={["Nova guia", "Histórico", "Compartilhar…", "Instalar app", "Configurações"]} active="Instalar app" />
    </Phone>,
    <Phone key="and-ok" label="Pronto: o ícone na tela inicial">
      <HomeScreen />
    </Phone>,
    <>
      <div className="flex items-center gap-4 rounded-2xl bg-bg-alt p-4">
        <img src="/icons/icon-192.png" alt="Ícone do Painel de Vendas" width={56} height={56} className="size-14 rounded-2xl" />
        <p className="text-[15px]">
          Procure este ícone, com o nome <strong>Vendas</strong>, na tela inicial do celular. Tocando nele, o painel abre em tela cheia,
          como um aplicativo.
        </p>
      </div>
      <Tip>
        As telas do seu celular podem ser um pouco diferentes das ilustrações, dependendo da marca e do modelo. Os nomes dos botões
        costumam ser os mesmos.
      </Tip>
    </>,
  ],
  sair: [
    <Steps key="passos">
      <li>
        Para sair, toque em <strong>Sair</strong>, na faixa vermelha do topo. Faça isso sempre que usar um celular ou computador que não é
        seu.
      </li>
      <li>Por segurança, depois de algumas horas o painel pede para você entrar de novo. É só digitar o CPF outra vez.</li>
    </Steps>,
    <Tip key="tip" kind="atencao">
      Como a entrada é só com o CPF, <strong>não passe o seu CPF para colegas</strong> usarem o painel. Cada pessoa deve entrar com o
      próprio CPF.
    </Tip>,
  ],
  duvidas: [
    <div key="1" className="space-y-2">
      <Term name="Uma venda que fiz agora não apareceu.">
        O painel mostra as vendas que já têm <strong>nota fiscal emitida</strong>. Assim que a nota for emitida, a venda aparece. Para
        atualizar, feche o painel e abra de novo.
      </Term>
      <Term name="O valor está diferente do que eu esperava.">
        O faturamento é <strong>líquido</strong>: as devoluções são descontadas no dia em que aconteceram. Confira a lista de últimas
        vendas e devoluções.
      </Term>
    </div>,
    <div key="2" className="space-y-2">
      <Term name="Apareceu “Sua sessão expirou”.">Foi só o tempo de segurança. Digite o CPF de novo para entrar.</Term>
      <Term name="Apareceu “Não foi possível carregar as vendas”.">
        O sistema da loja demorou para responder. Espere um pouco e abra o painel de novo.
      </Term>
      <Term name="Sem internet funciona?">
        Em parte. Com o painel instalado no celular, sem internet ele mostra os números da última vez que você abriu, com um aviso amarelo
        dizendo de quando são. Para trocar o período ou o vendedor, a internet precisa voltar.
      </Term>
    </div>,
  ],
};

export default function HelpPage() {
  const cover: Story = {
    section: null,
    content: (
      <div className="my-auto">
        <div className="rounded-3xl bg-[#d71921] p-6 text-white">
          <h1 className="text-3xl">Como usar o Painel de Vendas</h1>
          <p className="mt-2 text-lg text-white/90">Um guia passo a passo, com imagens, para acompanhar as suas vendas pelo celular.</p>
          <Smile className="mt-4 h-5 w-auto" />
        </div>
        <nav aria-label="Conteúdo" className="mt-5">
          <h2 className="text-xl">Neste guia</h2>
          <ol className="mt-2 grid gap-0.5">
            {SECTIONS.map(([id, title], i) => (
              <li key={id}>
                <a href={`#${id}`} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-bg-alt">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft font-title text-sm font-semibold text-accent">
                    {i + 1}
                  </span>
                  {title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </div>
    ),
  };

  const end: Story = {
    section: null,
    content: (
      <div className="my-auto text-center">
        <p className="text-5xl">🎉</p>
        <h2 className="mt-4 text-2xl">Pronto!</h2>
        <p className="mt-2 text-[17px] text-ink-2">Agora é só abrir o painel e acompanhar as suas vendas.</p>
        <Smile className="mx-auto mt-6 h-5 w-auto" />
      </div>
    ),
  };

  const slides: Story[] = [
    cover,
    ...SECTIONS.flatMap(([id, title], s) =>
      CONTENT[id].map((content) => ({
        section: s,
        content: (
          <Slide n={s + 1} title={title}>
            {content}
          </Slide>
        ),
      })),
    ),
    end,
  ];

  return <Stories sections={SECTIONS} slides={slides} />;
}
