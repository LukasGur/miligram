import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import { DisclaimerGate } from "@/components/DisclaimerGate";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { IosStandaloneTags } from "@/components/IosStandaloneTags";
import "./globals.css";
// Generováno skriptem `pnpm katex` — jen woff2, aby precache nenabobtnala.
import "./katex.css";

/**
 * IBM Plex má poctivě kreslený latin-ext — háčky a kroužky (ě, ř, ů, ľ, ĺ, ŕ)
 * nejsou dolepené z jiného řezu. Subset latin-ext je proto povinný,
 * jinak by prohlížeč diakritiku nahradil fallbackem.
 */
const plexSans = IBM_Plex_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Miligram",
  description: "Trénink výpočtů dávkování léků pro studenty medicíny.",
  applicationName: "Miligram",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Miligram",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false, date: false, address: false, email: false },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  // Lišta prohlížeče a stavový řádek v barvě papíru.
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  // Zoom zůstává povolený kvůli přístupnosti; „appový“ pocit řeší
  // touch-action: manipulation, ne zákaz zvětšení.
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body className="bg-paper text-ink antialiased">
        <IosStandaloneTags />
        <LocaleProvider>
          <ServiceWorkerRegistrar />
          <DisclaimerGate>{children}</DisclaimerGate>
        </LocaleProvider>
      </body>
    </html>
  );
}
