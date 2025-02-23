import type { Metadata } from "next";
import "./globals.css";
import { Inter as FontSans } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { shouldUseAuth } from "@/lib/shouldUseAuth";

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "tlbranch",
  description: "Track conversations with AI better",
};

function Provider({ children }: { children: React.ReactNode }) {
  if (shouldUseAuth) {
    return <ClerkProvider>{children}</ClerkProvider>;
  }
  return <>{children}</>;
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Converse with an AI without boundaries */}
      </head>
      <body className={fontSans.className}>
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
