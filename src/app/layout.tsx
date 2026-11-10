import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Toaster } from "sonner";
import { FinanceMotion } from "@/components/finance-motion";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Clara · Suas finanças, com clareza",
  description:
    "Seu espaço pessoal para organizar entradas, saídas, investimentos e sonhos.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full">
        <FinanceMotion>
          {children}
          <Toaster richColors position="bottom-right" closeButton />
        </FinanceMotion>
      </body>
    </html>
  );
}
