import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Páginas que passam pelo proxy recebem de lá uma CSP com nonce (src/proxy.ts); esta vale para as que ficam de fora
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path(ajuda|ajuda/.*|offline\\.html)",
        headers: [{ key: "Content-Security-Policy", value: csp }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          // geolocation só para o próprio site: trava de local de acesso (src/lib/acesso.ts)
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
      {
        // páginas com dados de vendas nunca devem ficar em cache (as fotos da fila têm cache próprio, privado)
        source: "/((?!_next/static|api/foto/).*)",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
