import type { Metadata } from "next";
import "./globals.css";
import TitleBar from "@/components/TitleBar";

export const metadata: Metadata = {
  title: "SpecterMonitor | Control Center",
  description: "Real-time hardware monitoring dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <TitleBar />
        {children}
      </body>
    </html>
  );
}
