import type { Metadata } from "next";
import { RegisterSW } from "@/components/register-sw";
import "./globals.css";

export const metadata: Metadata = {
  title: "Painel de Vendas",
  description: "Acompanhamento de vendas integrado ao Sankhya",
  robots: { index: false, follow: false },
  applicationName: "Painel de Vendas",
  appleWebApp: { capable: true, title: "Vendas", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f6f4" },
    { media: "(prefers-color-scheme: dark)", color: "#111110" },
  ],
};
