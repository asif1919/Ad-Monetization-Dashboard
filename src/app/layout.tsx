import type { Metadata } from "next";
import { AuthRefresh } from "@/components/auth-refresh";
import { ToastProvider } from "@/components/ui/toast-provider";
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
      <body className="antialiased min-h-screen">
        <ToastProvider>
          <AuthRefresh />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
