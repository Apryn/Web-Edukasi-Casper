import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Signal Casper — Read the Market, Not the Noise",
  description:
    "Analisa market, edukasi trading, dan tools untuk membantu trader mengambil keputusan dengan lebih terstruktur.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
