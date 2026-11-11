import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { FinanceMotion } from "@/components/finance-motion";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Clara · Finanças pessoais",
  description: "Controle de entradas, saídas, investimentos e metas.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full">
        <FinanceMotion>
          {children}
          <Toaster />
        </FinanceMotion>
      </body>
    </html>
  );
}
