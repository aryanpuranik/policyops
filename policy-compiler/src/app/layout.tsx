import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PolicyOps – Policy-to-Operations Compiler",
  description:
    "Turn business policies into operational workflows using multi-agent AI. Upload messy policies, get production-ready workflows.",
  keywords: ["AI", "policy", "workflow", "automation", "agentic AI", "LangGraph"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-white font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
