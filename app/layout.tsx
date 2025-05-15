// layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import "tldraw/tldraw.css";    // <-- NEW: ensure editor UI is styled
import { Inter as FontSans } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "branc",
  description: "Track conversations with AI better",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>{/* Converse with an AI without boundaries */}</head>
      <body className={fontSans.className}>
        <ClerkProvider>{children}</ClerkProvider>
      </body>
    </html>
  );
}
