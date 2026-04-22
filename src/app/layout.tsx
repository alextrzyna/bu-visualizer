import type { Metadata } from "next";
import { Inter, Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const sans = Inter({
  variable: "--font-sans-ui",
  subsets: ["latin"],
  display: "swap",
});

const serif = Fraunces({
  variable: "--font-serif-prose",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono-ui",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "The Block Universe — a visualization",
  description:
    "A contemplative walkthrough of the block-universe view of time, culminating in a visualization of a human life as a worldline through spacetime.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${serif.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[var(--void-0)] text-[var(--ink-0)]">
        {children}
      </body>
    </html>
  );
}
