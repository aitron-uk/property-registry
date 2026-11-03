import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Property Registry",
  description: "My house hunt: every listing, scored, mapped and researched.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <header className="sticky top-0 z-[1000] border-b border-line bg-paper/85 backdrop-blur">
          <nav className="mx-auto flex max-w-[1600px] items-center gap-6 px-4 py-3 sm:px-6">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink text-white">⌂</span>
              Property Registry
            </Link>
            <div className="ml-auto flex gap-1 text-sm">
              <Link href="/" className="rounded-lg px-3 py-1.5 hover:bg-card">Dashboard</Link>
              <Link href="/settings" className="rounded-lg px-3 py-1.5 hover:bg-card">Settings</Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
