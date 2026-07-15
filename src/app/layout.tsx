import type { Metadata } from "next";
import type { ReactNode } from "react";

import { PRODUCT } from "@/lib/product";

import "./globals.css";

export const metadata: Metadata = {
  title: PRODUCT.title,
  description:
    "ModelDuel turns a learner's mental model into a testable world and lets evidence drive conceptual change.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
