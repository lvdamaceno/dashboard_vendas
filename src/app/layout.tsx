import type { Metadata } from "next";
import { Fredoka, Manrope } from "next/font/google";
import { connection } from "next/server";
import { RegisterSW } from "@/components/register-sw";
import "./globals.css";

// Mesmas fontes da nova loja: Manrope no texto, Fredoka (próxima do logotipo) nos títulos
const textFont = Manrope({ variable: "--font-text", subsets: ["latin"] });
const headingFont = Fredoka({ variable: "--font-heading", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Painel de Vendas",
  description: "Acompanhamento de vendas integrado ao Sankhya",
  robots: { index: false, follow: false },
  applicationName: "Painel de Vendas",
  appleWebApp: { capable: true, title: "Vendas", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Tudo renderizado na hora: a CSP do proxy usa um nonce por requisição, que página estática não teria
  await connection();
  return (
    <html lang="pt-BR" className={`${textFont.variable} ${headingFont.variable}`}>
      <body>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Vermelho da marca, contínuo com o cabeçalho
  themeColor: "#d71921",
};
