import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FineAnts - Financial Wellness Platform",
  description: "Take control of your financial future with personalized budgeting, savings goals, and retirement planning.",
  manifest: "/manifest.json",
  themeColor: "#000000",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FineAnts",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
