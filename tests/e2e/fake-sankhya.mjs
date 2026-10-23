// Sankhya de demonstração para as capturas do guia /ajuda: dados fictícios (nomes, valores e telefones inventados).
import http from "node:http";

const LOJA = 1;
const pessoas = [
  [901, "ANA PAULA", "V", "91988881111"],
  [902, "BRUNO", "V", "91988882222"],
  [903, "CARLA", "V", "91988883333"],
  [904, "DIEGO", "V", "91988884444"],
  [905, "ELISA", "V", "91988885555"],
  [950, "MARCOS", "G", "91988889999"],
];
// Vendido no mês até hoje e hoje (para as metas)
const vendas = { 901: [41250, 3100], 902: [52800, 0], 903: [36900, 1450], 904: [47300, 2900], 905: [28400, 0] };

const reply = (res, fields, rows) => res.end(JSON.stringify({ status: "1", responseBody: { fieldsMetadata: fields.map((name) => ({ name })), rows } }));

http
  .createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      if (req.url.startsWith("/authenticate")) return res.end(JSON.stringify({ access_token: "demo", expires_in: 300 }));
      const sql = JSON.parse(body || "{}")?.requestBody?.sql ?? "";
      const only = /CAB\.CODVEND = (\d+)/.exec(sql)?.[1];

      if (/FROM TSIEMP/.test(sql)) return reply(res, ["CODEMP", "NOMEFANTASIA"], [[LOJA, "CASA CONTENTE - MATRIZ"], [4, "CASA CONTENTE - PEDREIRA"]]);
      if (/SELECT VEN\.CODEMP FROM TGFVEN VEN WHERE VEN\.ATIVO = 'S' AND VEN\.CODVEND/.test(sql)) return reply(res, ["CODEMP"], [[LOJA]]);
      if (/SELECT VEN\.CODVEND, VEN\.APELIDO, VEN\.TIPVEND FROM TGFVEN/.test(sql))
        return reply(res, ["CODVEND", "APELIDO", "TIPVEND"], pessoas.map(([c, n, t]) => [c, n, t]));
      if (/FUN\.TELEFONE\s+FROM TGFVEN/.test(sql) || /VEN\.TIPVEND, FUN\.TELEFONE/.test(sql))
        return reply(res, ["CODVEND", "APELIDO", "CODEMP", "TIPVEND", "TELEFONE"], pessoas.map(([c, n, t, tel]) => [c, n, LOJA, t, c === 903 ? null : tel]));
      if (/SELECT VEN\.CODVEND, VEN\.APELIDO FROM TGFVEN VEN/.test(sql))
        return reply(res, ["CODVEND", "APELIDO"], pessoas.filter((p) => p[2] === "V").map(([c, n]) => [c, n]));
      if (/FROM TFPFUN FUN\s+WHERE FUN\.CODEMP/.test(sql)) return reply(res, ["NOMEFUNC", "TELEFONE"], [["ANA PAULA SOUZA", "91988881111"]]);
      if (/COUNT\(\*\) AS NOTAS/.test(sql))
        return reply(res, ["CODEMP", "CODVEND", "APELIDO", "NOTAS"], [[1, 902, "BRUNO", 96], [1, 904, "DIEGO", 88], [1, 901, "ANA PAULA", 81], [1, 903, "CARLA", 74], [1, 905, "ELISA", 52], [1, 990, "CAIXA 1", 4]]);
      if (/AS HOJE/.test(sql)) {
        const rows = Object.entries(vendas).map(([c, [t, h]]) => [LOJA, Number(c), t, h]);
        return reply(res, ["CODEMP", "CODVEND", "TOTAL", "HOJE"], only ? rows.filter((r) => r[1] === Number(only)) : rows);
      }
      if (/AS BRUTO/.test(sql)) return reply(res, ["PEDIDOS", "BRUTO", "DEVOLUCOES", "CLIENTES"], only ? [[32, 42350, 1100, 29]] : [[171, 211900, 5250, 138]]);
      reply(res, [], []);
    });
  })
  .listen(Number(process.env.FAKE_SANKHYA_PORT ?? 3999), () => console.log("sankhya simulado no ar"));
