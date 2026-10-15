import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  // latin-ext: ğ, ş, ı, İ gibi Türkçe karakterler için gerekli
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: {
    default: "Paventech ERP",
    template: "%s · Paventech ERP",
  },
  description: "Modüler, bulut tabanlı ERP: ön muhasebe, stok, satış, üretim ve daha fazlası.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
