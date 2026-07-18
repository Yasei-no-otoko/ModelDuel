import type { Metadata } from "next";
import {
  Atkinson_Hyperlegible_Next,
  Barlow_Condensed,
  IBM_Plex_Mono,
} from "next/font/google";
import type { ReactNode } from "react";

import { PRODUCT } from "@/lib/product";

import "./globals.css";

const bodyFont = Atkinson_Hyperlegible_Next({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: false,
});

const displayFont = Barlow_Condensed({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
});

const dataFont = IBM_Plex_Mono({
  variable: "--font-data",
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: PRODUCT.title,
  description:
    "ModelDuel turns a learner's mental model into a testable world and lets evidence drive conceptual change.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${bodyFont.variable} ${displayFont.variable} ${dataFont.variable}`}>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
