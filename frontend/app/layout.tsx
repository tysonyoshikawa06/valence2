import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Valence v2",
  description: "Valence v2",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="bg-white m-0 p-0">
      <body>{children}</body>
    </html>
  );
}
