import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Megagyn Service", template: "%s | Megagyn Service" },
  description: "Chamados, diário de obra, compras e relatórios mensais da Megagyn.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#1e2326",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={archivo.variable}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
