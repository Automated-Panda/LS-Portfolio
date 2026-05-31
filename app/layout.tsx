import type { Metadata } from "next";
import { Anton } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.gtvault.app"),
  title: "GT Vault",
  description:
    "Track your full GTA V asset portfolio — vehicles, properties, businesses, aircraft, and more.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${anton.variable}`}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
