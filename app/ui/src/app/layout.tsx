import type { Metadata } from 'next';
import { Geist, Geist_Mono } from "next/font/google";
import { Manrope } from 'next/font/google'
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
})

export const metadata: Metadata = {
  title: 'Delivery Route Optimizer',
  description: 'Convert addresses to coordinates with CSV support',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body 
        className={`${geistSans.variable} ${geistMono.variable} ${manrope.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
