import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import PageWrapper from "@/components/layout/PageWrapper";
import ErrorBoundary from "@/components/ErrorBoundary";

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
        <ErrorBoundary>
          <PageWrapper>{children}</PageWrapper>
        </ErrorBoundary>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#0a1929",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#e2e8f0",
              fontSize: "13px",
            },
          }}
          richColors
          closeButton
        />
      </body>
    </html>
  );
}
