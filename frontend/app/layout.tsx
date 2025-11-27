import "@/styles/globals.css";
import { Inter, Playfair_Display } from "next/font/google";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "StyleGen",
  description: "Generate editorial style guides from Substack authors."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html>
      <body>
        {children}
      </body>
    </html>
  );
}
