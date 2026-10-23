-- Tabelas do painel de vendas no Postgres compartilhado (loja-casacontente-db).
-- Ficam todas no schema "painel", separadas das tabelas da loja (site, erp).
-- Pode ser executado de novo sem problemas.

CREATE SCHEMA IF NOT EXISTS painel;

-- Diretores: veem todas as lojas. Cadastrados pelo admin.
CREATE TABLE IF NOT EXISTS painel.usuario_master (
  id        serial PRIMARY KEY,
  cpf       char(11) NOT NULL UNIQUE CHECK (cpf ~ '^[0-9]{11}$'),
  nome      text NOT NULL CHECK (length(nome) BETWEEN 1 AND 120),
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- Avisos do sino. codemp NULL = todas as lojas.
CREATE TABLE IF NOT EXISTS painel.aviso (
  id          serial PRIMARY KEY,
  titulo      text NOT NULL CHECK (length(titulo) BETWEEN 1 AND 120),
  mensagem    text NOT NULL CHECK (length(mensagem) BETWEEN 1 AND 2000),
  codemp      integer,
  autor_nome  text NOT NULL,
  autor_papel text NOT NULL CHECK (autor_papel IN ('admin', 'master', 'gerente')),
  criado_em   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS aviso_criado_em_idx ON painel.aviso (criado_em DESC);

-- Última vez que cada usuário abriu o sino (marca os avisos novos)
CREATE TABLE IF NOT EXISTS painel.aviso_visto (
  usuario  text PRIMARY KEY,
  visto_em timestamptz NOT NULL DEFAULT now()
);

-- Sugestões e erros enviados pelos usuários
CREATE TABLE IF NOT EXISTS painel.feedback (
  id           serial PRIMARY KEY,
  tipo         text NOT NULL CHECK (tipo IN ('sugestao', 'erro')),
  mensagem     text NOT NULL CHECK (length(mensagem) BETWEEN 1 AND 4000),
  autor_nome   text NOT NULL,
  autor_papel  text NOT NULL,
  codemp       integer,
  codvend      integer,
  pagina       text,
  navegador    text,
  concluido    boolean NOT NULL DEFAULT false,
  concluido_em timestamptz,
  criado_em    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS feedback_pendente_idx ON painel.feedback (concluido, criado_em DESC);

-- Clientes tirados da lista "Clientes para chamar de volta" (ex.: não querem voltar).
-- Voltam a aparecer se comprarem de novo depois de dispensados.
CREATE TABLE IF NOT EXISTS painel.cliente_dispensado (
  codparc       integer PRIMARY KEY,
  autor_nome    text NOT NULL,
  autor_papel   text NOT NULL,
  codemp        integer,
  codvend       integer,
  dispensado_em timestamptz NOT NULL DEFAULT now()
);

-- Telefone do cartão de visita atualizado pelo app (vendedor, gerente da loja ou admin).
-- Sem registro aqui, vale o TFPFUN.TELEFONE do Sankhya.
CREATE TABLE IF NOT EXISTS painel.telefone (
  codvend       integer PRIMARY KEY,
  telefone      text NOT NULL CHECK (telefone ~ '^[0-9]{10,11}$'),
  autor_nome    text NOT NULL,
  autor_papel   text NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- Fila de atendimento: uma por loja por dia. O "dia" da fila vira às 7h (horário de Brasília),
-- então a fila zera sozinha às 7h sem tarefa agendada. Linhas antigas são apagadas aos poucos.
CREATE TABLE IF NOT EXISTS painel.fila (
  dia           date NOT NULL,
  codemp        integer NOT NULL,
  codvend       integer NOT NULL,
  nome          text NOT NULL,
  posicao       integer NOT NULL,
  atendendo     boolean NOT NULL DEFAULT false,
  entrou_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (dia, codemp, codvend)
);
CREATE INDEX IF NOT EXISTS fila_loja_idx ON painel.fila (codemp, dia, posicao);

-- Foto do vendedor na fila de atendimento (JPEG 256x256 reduzido no navegador, até 300 KB)
CREATE TABLE IF NOT EXISTS painel.foto (
  codvend       integer PRIMARY KEY,
  dados         bytea NOT NULL CHECK (octet_length(dados) <= 307200),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- Metas mensais de faturamento líquido, informadas por master e admin.
-- codvend 0 = meta geral da loja; -1 = meta individual, a mesma para cada vendedor ativo da loja.
CREATE TABLE IF NOT EXISTS painel.meta (
  mes           date NOT NULL CHECK (extract(day FROM mes) = 1),
  codemp        integer NOT NULL,
  codvend       integer NOT NULL DEFAULT 0,
  valor         numeric(14, 2) NOT NULL CHECK (valor > 0),
  autor_nome    text NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (mes, codemp, codvend)
);

-- Ajustes de feriado feitos pelo admin, por cima do calendário calculado (src/lib/workdays.ts):
-- fecha = true  → dia sem expediente (feriado novo, ex.: decreto, loja fechada);
-- fecha = false → a loja abre num feriado do calendário (o dia volta a contar como útil).
CREATE TABLE IF NOT EXISTS painel.feriado (
  dia           date PRIMARY KEY,
  nome          text NOT NULL CHECK (length(nome) BETWEEN 1 AND 120),
  fecha         boolean NOT NULL DEFAULT true,
  autor_nome    text NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- Pessoas consideradas na meta individual de cada loja no mês (uma loja por pessoa por mês).
-- A meta individual (codvend -1 em painel.meta) vale para cada uma delas.
CREATE TABLE IF NOT EXISTS painel.meta_pessoa (
  mes     date NOT NULL CHECK (extract(day FROM mes) = 1),
  codvend integer NOT NULL,
  codemp  integer NOT NULL,
  nome    text NOT NULL,
  PRIMARY KEY (mes, codvend)
);
CREATE INDEX IF NOT EXISTS meta_pessoa_loja_idx ON painel.meta_pessoa (mes, codemp);

-- Aviso só para um papel (ex.: lembrete para a diretoria). NULL = todos (respeitando a loja).
ALTER TABLE painel.aviso ADD COLUMN IF NOT EXISTS papel text CHECK (papel IN ('master', 'gerente', 'vendedor'));

-- Lembretes recorrentes criados pelo admin: no dia, viram um aviso no sino do público escolhido.
-- recorrencia: mensal (dia = dia do mês; em mês mais curto, o último dia), semanal (dia = 0 domingo … 6 sábado),
-- diaria, ou unica (data). ultimo_envio evita mandar duas vezes no mesmo dia.
CREATE TABLE IF NOT EXISTS painel.lembrete (
  id           serial PRIMARY KEY,
  titulo       text NOT NULL CHECK (length(titulo) BETWEEN 1 AND 120),
  mensagem     text NOT NULL CHECK (length(mensagem) BETWEEN 1 AND 2000),
  publico      text NOT NULL CHECK (publico IN ('master', 'gerente', 'vendedor', 'todos')),
  recorrencia  text NOT NULL CHECK (recorrencia IN ('mensal', 'semanal', 'diaria', 'unica')),
  dia          integer,
  data         date,
  ativo        boolean NOT NULL DEFAULT true,
  ultimo_envio date,
  criado_em    timestamptz NOT NULL DEFAULT now(),
  CHECK (recorrencia <> 'mensal' OR dia BETWEEN 1 AND 31),
  CHECK (recorrencia <> 'semanal' OR dia BETWEEN 0 AND 6),
  CHECK (recorrencia <> 'unica' OR data IS NOT NULL)
);
