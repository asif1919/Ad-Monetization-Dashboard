import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ad Monetization Dashboard",
  description: "Publisher Ad Revenue Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  );
}
