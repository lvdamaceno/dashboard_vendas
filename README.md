# Painel de Vendas (Sankhya)

Dashboard mobile-first para vendedores e gerentes acompanharem suas vendas.
Os dados vêm direto do Sankhya via API; nada é armazenado.

**Stack:** Next.js 16 (App Router, Server Components/Actions) · TypeScript · Tailwind 4 · Recharts.

## Rodando

```bash
cp .env.example .env      # preencha SANKHYA_CLIENT_ID/SECRET, SANKHYA_X_TOKEN e SESSION_SECRET (openssl rand -base64 48)
npm install
npm run dev               # desenvolvimento
npm run build && npm start   # produção (porta 3000)
```

Em produção, sirva **somente via HTTPS** (Nginx/Caddy/load balancer na frente).

## Como funciona

Toda a comunicação usa a **API oficial do Sankhya** (`api.sankhya.com.br`, OAuth 2.0
`client_credentials`) — o app não acessa o servidor Sankhya diretamente.

1. O usuário entra **apenas com o CPF**.
2. O sistema busca, com o usuário de integração:
   - `TFPFUN` pelo CPF → `CODEMP` + `CODFUNC` (a empresa entra no filtro porque o mesmo
     `CODFUNC` pode existir em empresas diferentes);
   - `TSIUSU` pelo par `CODEMP` + `CODFUNC` → vendedor vinculado (`TSIUSU.CODVEND`);
   - `TGFVEN`: sem vendedor ou vendedor inativo → acesso negado; CPF ligado a mais de um
     vendedor ativo → acesso negado; `TIPVEND = 'G'` → **gerente**; senão → **vendedor**.
3. Cria uma sessão em cookie criptografado (JWE A256GCM, `HttpOnly`, `Secure`, `SameSite=Lax`, 8h).
4. O dashboard consulta via `DbExplorerSP.executeQuery` pelo gateway
   (`/gateway/v1/mge/service.sbr`) com o token do usuário de integração. O SQL é montado
   **apenas no servidor** (SQL Server).

> ⚠️ Não há senha: quem souber o CPF de um vendedor acessa o painel dele. O limite de
> tentativas por IP dificulta varrer CPFs, mas não substitui uma senha.

### Regras de acesso (aplicadas no SQL, a partir da sessão criptografada)

| Perfil | Vê |
|---|---|
| Vendedor | apenas `TGFCAB.CODVEND = seu código`. Parâmetros na URL são ignorados. |
| Gerente (`MANAGER_SCOPE=empresa`) | vendas da sua empresa/loja: `TGFCAB.CODEMP = TGFVEN.CODEMP` do gerente |
| Gerente (`MANAGER_SCOPE=equipe`) | as próprias vendas + vendedores com `TGFVEN.CODGER` = ele |

O filtro de vendedor do gerente só **restringe** (é somado com `AND`), nunca amplia.

### API oficial e usuário de integração (obrigatórios)

1. Na Área do Desenvolvedor Sankhya, cadastre a aplicação → `SANKHYA_CLIENT_ID` e `SANKHYA_CLIENT_SECRET`.
2. No Sankhya, tela **Configurações Gateway**, gere o token (`SANKHYA_X_TOKEN`) vinculado a um
   usuário de integração com acesso ao DbExplorer e leitura de `TFPFUN`, `TSIUSU`, `TGFVEN`,
   `TGFCAB`, `TGFITE` etc.

Todas as consultas rodam com esse usuário; vendedores e gerentes não precisam de acesso ao
DbExplorer, e o filtro de escopo acima é aplicado em todas as consultas. O token OAuth é
reaproveitado e renovado automaticamente antes de expirar.

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
- Login com limite de 5 tentativas / 15 min por IP e por CPF; o CPF completo não vai para os logs (em memória — com várias
  instâncias, use limite no proxy reverso; o IP vem de `X-Forwarded-For`, então o proxy precisa sobrescrevê-lo).
- Server Actions com verificação de origem (CSRF), CSP, `X-Frame-Options: DENY`, HSTS, `no-store`.
- Valores no SQL passam por helpers que validam inteiros/datas e escapam textos (`src/lib/sankhya/sql.ts`).

## Estrutura

```
src/proxy.ts                 barreira de autenticação
src/app/actions.ts           login/logout (Server Actions)
src/app/dashboard/page.tsx   dashboard (Server Component)
src/lib/sankhya/client.ts    API oficial Sankhya (OAuth + gateway)
src/lib/sankhya/profile.ts   CPF → funcionário → usuário → vendedor/perfil
src/lib/sales.ts             consultas + regras de escopo
src/lib/period.ts            hoje / semana / mês / período (fuso America/Sao_Paulo)
```
