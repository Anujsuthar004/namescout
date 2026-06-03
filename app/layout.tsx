import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
  title: "NameScout — Compare domain prices & true renewal cost",
  description:
    "Compare domain registration AND renewal prices across registrars. See the real 5-year cost before you buy — not just the cheap year-1 bait.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <header className="border-b border-black/10 dark:border-white/10">
          <div className="mx-auto max-w-5xl px-4 py-4 flex items-center gap-2">
            <Link href="/" className="font-semibold text-lg tracking-tight">
              Name<span className="text-emerald-600 dark:text-emerald-400">Scout</span>
            </Link>
            <span className="text-xs text-black/50 dark:text-white/50 hidden sm:inline">
              true cost of domain ownership
            </span>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-black/10 dark:border-white/10 mt-12">
          <div className="mx-auto max-w-5xl px-4 py-6 text-xs text-black/50 dark:text-white/50 space-y-1">
            <p>
              <strong>Affiliate disclosure:</strong> NameScout may earn a
              commission when you buy through some &ldquo;Buy&rdquo; links, at no
              extra cost to you. We show the genuinely cheapest option regardless
              of whether we earn on it.
            </p>
            <p>
              Prices are cached and may lag the registrar. Always confirm the
              final price at checkout.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
