import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "ANAC Data Insight",
  description: "Plataforma institucional de análise de dados operacionais da aviação civil",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.variable} font-sans min-h-screen bg-[#00112b]`}>
        {children}
      </body>
    </html>
  );
}
