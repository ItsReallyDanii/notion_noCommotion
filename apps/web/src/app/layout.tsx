import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Notion Verdict Board",
  description: "Human-in-the-loop verdict system for AI outputs, backed by Notion",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-gray-100 font-sans antialiased">
        <header className="border-b border-gray-800 px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                Notion Verdict Board
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Human-in-the-loop AI review, backed by Notion
              </p>
            </div>
            <nav className="flex gap-4 text-sm text-gray-400">
              <a href="/" className="hover:text-white transition-colors">
                Submit
              </a>
              <a href="/board" className="hover:text-white transition-colors">
                Board
              </a>
            </nav>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
