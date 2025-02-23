import type { Metadata } from "next";
import "./globals.css";
import { Inter as FontSans } from "next/font/google";

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "tlbranch",
  description: "Track conversations with AI better",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Converse with an AI without boundaries */}
      </head>
      <body className={fontSans.className}>
        {children}
      </body>
    </html>
  );
}
