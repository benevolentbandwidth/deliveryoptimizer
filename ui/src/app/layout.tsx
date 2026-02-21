import type { Metadata } from 'next';
import './globals.css';

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
      <body>{children}</body>
    </html>
  );
}