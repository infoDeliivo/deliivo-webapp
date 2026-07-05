import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { publicConfig } from "@/lib/public-config";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Deliivo - Baltic Carpooling",
  description:
    "Deliivo connects drivers and passengers across Estonia, Latvia, and Lithuania for affordable regional carpooling.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Deliivo',
    url: 'https://deliivo.com',
    logo: 'https://deliivo.com/logo.png',
    description: 'Baltic carpooling platform connecting drivers and riders across Estonia, Latvia, and Lithuania.',
    areaServed: ['Estonia', 'Latvia', 'Lithuania'],
    sameAs: [
      publicConfig.facebookUrl,
      publicConfig.instagramUrl,
      publicConfig.xUrl,
      publicConfig.tiktokUrl,
      publicConfig.linkedinUrl,
    ],
  };

  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-screen overflow-x-hidden bg-deliivo-cream font-sans text-deliivo-dark flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
