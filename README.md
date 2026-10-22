# Painel de Vendas (Sankhya)

Dashboard mobile-first para vendedores e gerentes acompanharem suas vendas.
Os dados vêm direto do Sankhya via API; nada é armazenado.

**Stack:** Next.js 16 (App Router, Server Components/Actions) · TypeScript · Tailwind 4 · Recharts.

## Rodando

```bash
cp .env.example .env      # preencha SANKHYA_URL e SESSION_SECRET (openssl rand -base64 48)
npm install
npm run dev               # desenvolvimento
npm run build && npm start   # produção (porta 3000)
```

Em produção, sirva **somente via HTTPS** (Nginx/Caddy/load balancer na frente).

## Como funciona

1. O usuário entra com usuário/senha do Sankhya → `MobileLoginSP.login`.
   Senha errada = acesso negado. A senha nunca é guardada, e a sessão do usuário
   no Sankhya é encerrada logo em seguida (serviu só para validar a senha).
2. O sistema busca o usuário em `TSIUSU` + `TGFVEN`:
   - sem vendedor vinculado (`TSIUSU.CODVEND`) ou vendedor inativo → acesso negado;
   - `TGFVEN.TIPVEND = 'G'` → **gerente**; caso contrário → **vendedor**.
3. Cria uma sessão em cookie criptografado (JWE A256GCM, `HttpOnly`, `Secure`, `SameSite=Lax`, 8h).
4. O dashboard consulta via `DbExplorerSP.executeQuery` com a **conta de integração**
   (`SANKHYA_SERVICE_USER`). O SQL é montado **apenas no servidor** (SQL Server).

### Regras de acesso (aplicadas no SQL, a partir da sessão criptografada)

| Perfil | Vê |
|---|---|
| Vendedor | apenas `TGFCAB.CODVEND = seu código`. Parâmetros na URL são ignorados. |
| Gerente (`MANAGER_SCOPE=empresa`) | vendas da sua empresa/loja: `TGFCAB.CODEMP = TGFVEN.CODEMP` do gerente |
| Gerente (`MANAGER_SCOPE=equipe`) | as próprias vendas + vendedores com `TGFVEN.CODGER` = ele |

O filtro de vendedor do gerente só **restringe** (é somado com `AND`), nunca amplia.

### Conta de integração (obrigatória)

Crie no Sankhya um usuário de integração com acesso ao DbExplorer e configure
`SANKHYA_SERVICE_USER`/`SANKHYA_SERVICE_PASSWORD`. Vendedores e gerentes **não** precisam
de acesso ao DbExplorer: o login deles só valida a senha, e o filtro de escopo acima é
aplicado em todas as consultas. A sessão da conta de integração é reaproveitada e
renovada automaticamente quando expira.

## Vendas e devoluções

`TGFCAB` com `STATUSNOTA IN (SALES_STATUSNOTA)` (padrão `L`), pela data `DTNEG`:

- `TIPMOV IN (SALES_TIPMOV_VENDA)` (padrão `V`) → soma `VLRNOTA`;
- `TIPMOV IN (SALES_TIPMOV_DEVOLUCAO)` (padrão `D`) → **subtrai** `VLRNOTA`, na data da devolução
  e para o vendedor da nota de devolução.

Faturamento, gráfico diário e rankings são **líquidos** (vendas − devoluções); produtos usam
`VLRTOT − VLRDESC` dos itens com o mesmo sinal. Devoluções aparecem em vermelho/negativo nas
últimas movimentações e o card de faturamento mostra o total devolvido. "Pedidos", "Clientes"
e o ticket médio (líquido ÷ pedidos) contam só as vendas.
Para limitar a TOPs específicas use `SALES_TOPS` (inclua as de devolução).

## Segurança

- Cookie de sessão criptografado; nada sensível exposto ao navegador.
- Proxy (`src/proxy.ts`) bloqueia tudo sem sessão; as páginas revalidam a sessão.
- Login com limite de 5 tentativas / 15 min por IP e por usuário (em memória — com várias
  instâncias, use limite no proxy reverso; o IP vem de `X-Forwarded-For`, então o proxy precisa sobrescrevê-lo).
- Server Actions com verificação de origem (CSRF), CSP, `X-Frame-Options: DENY`, HSTS, `no-store`.
- Valores no SQL passam por helpers que validam inteiros/datas e escapam textos (`src/lib/sankhya/sql.ts`).
- Sessão do Sankhya expirada → logout automático.

## Estrutura

```
src/proxy.ts                 barreira de autenticação
src/app/actions.ts           login/logout (Server Actions)
src/app/dashboard/page.tsx   dashboard (Server Component)
src/lib/sankhya/client.ts    chamadas à API Sankhya
src/lib/sankhya/profile.ts   usuário → vendedor/perfil
src/lib/sales.ts             consultas + regras de escopo
src/lib/period.ts            hoje / semana / mês / período (fuso America/Sao_Paulo)
```
