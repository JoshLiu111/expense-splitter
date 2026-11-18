import type { Metadata } from "next";
import { IBM_Plex_Mono, Manrope } from "next/font/google";
import Link from "next/link";
import { ThemeToggle, themeInitScript } from "@/components/theme-toggle";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Expense Splitter",
  description: "Split expenses. Settle up. Stay friends.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-dvh font-sans">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-3 focus:text-text-primary focus:shadow-lg"
        >
          Skip to main content
        </a>
        <header className="border-b border-border-subtle bg-bg-secondary">
          <div className="mx-auto flex max-w-page items-center justify-between gap-4 px-4 py-2">
            <Link
              href="/"
              className="flex min-h-11 items-center rounded-md text-base font-bold"
            >
              Expense Splitter
            </Link>
            <ThemeToggle />
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="mx-auto max-w-page px-4 py-8 outline-none">
          {children}
        </main>
      </body>
    </html>
  );
}
