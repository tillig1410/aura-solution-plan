import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClientProviders } from "@/components/layout/client-providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Plan — Gestion de réservations",
    template: "%s | Plan",
  },
  description:
    "Plan est un SaaS de gestion de réservations avec IA conversationnelle pour salons de coiffure, barbiers et instituts de beauté.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://resaplan.fr"),
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Plan",
    title: "Plan — Gestion de réservations",
    description:
      "Plan est un SaaS de gestion de réservations avec IA conversationnelle pour salons de coiffure, barbiers et instituts de beauté.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <ClientProviders />
      </body>
    </html>
  );
}
