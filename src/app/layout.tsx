import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Devanagari } from "next/font/google";
import { SiteNav } from "@/components/site-nav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const devanagari = Noto_Sans_Devanagari({
  variable: "--font-noto-devanagari",
  subsets: ["devanagari"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "Nukkad Network",
  description: "Connecting customers to the best shops of your nukkad",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${devanagari.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-brand-black">
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
