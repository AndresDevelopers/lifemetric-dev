import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MVP Seguimiento Metabólico",
  description: "Sistema clínico para diabéticos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased light`}>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body min-h-full flex flex-col md:flex-row overflow-hidden">
        <Navigation />
        <main className="flex-1 w-full relative overflow-y-auto pb-24 md:pb-0 h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
