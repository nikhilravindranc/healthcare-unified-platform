import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Healthcare Platform",
  description: "One platform for practice management, CRM, online booking and campaigns for medical, dental, aesthetics and wellness practices.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
