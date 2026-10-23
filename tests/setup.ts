// Variáveis mínimas para os módulos do app carregarem nos testes (nada aqui fala com o Sankhya de verdade).
process.env.SANKHYA_CLIENT_ID ??= "teste";
process.env.SANKHYA_CLIENT_SECRET ??= "teste";
process.env.SANKHYA_X_TOKEN ??= "teste";
process.env.SANKHYA_API_URL ??= "http://127.0.0.1:9";
process.env.SESSION_SECRET ??= "segredo-de-teste-com-mais-de-32-caracteres!!";
// Testes de banco: Postgres descartável (o schema "painel" é criado e limpo por eles)
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
