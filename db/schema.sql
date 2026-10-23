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
