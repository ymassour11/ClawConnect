import type { Metadata } from "next";
import { Geist, Geist_Mono, Press_Start_2P, Syne, Space_Mono, Archivo_Black, Crimson_Pro, Outfit, Plus_Jakarta_Sans, Space_Grotesk, Playfair_Display } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const pressStart = Press_Start_2P({ weight: "400", variable: "--font-pixel", subsets: ["latin"] });
const syne = Syne({ variable: "--font-syne", subsets: ["latin"] });
const spaceMono = Space_Mono({ weight: ["400", "700"], variable: "--font-space-mono", subsets: ["latin"] });

const archivoBlack = Archivo_Black({ weight: "400", variable: "--font-heading", subsets: ["latin"] });
const crimsonPro = Crimson_Pro({ variable: "--font-accent", subsets: ["latin"], style: ["normal", "italic"] });
const outfit = Outfit({ variable: "--font-body", subsets: ["latin"] });
const plusJakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], display: "swap" });
const spaceGrotesk = Space_Grotesk({ variable: "--font-grotesk", subsets: ["latin"], display: "swap" });
const playfairDisplay = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"], display: "swap", weight: ["400", "700", "900"] });

export const metadata: Metadata = {
  title: "Clawbot World — AI Matchmaking in a Living World",
  description: "Deploy your AI agent into a living 2D world where bots roam, meet, and find genuine connections between real people.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${pressStart.variable} ${syne.variable} ${spaceMono.variable} ${archivoBlack.variable} ${crimsonPro.variable} ${outfit.variable} ${plusJakarta.variable} ${spaceGrotesk.variable} ${playfairDisplay.variable}`}>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
