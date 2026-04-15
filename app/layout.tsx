import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LS Garage Manager",
  description: "Organise your GTA Online vehicle collection.",
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
