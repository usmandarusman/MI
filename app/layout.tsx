
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import Navigasi from "./components/items/navigator";
import Footer from "./components/items/footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Mann's Intelligence",
    template: "%s | Mann's Intelligence",
  },
  description:
    "Mann's Intelligence — Smart Trading, Market Insights, and Stock Analysis.",
  applicationName: "Mann's Intelligence",
  keywords: [
    "Mann's Intelligence",
    "Stock Market",
    "Trading",
    "Analisis Saham",
    "IHSG",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body className="min-h-screen flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
        >
          {/* NAVIGASI */}
          <Navigasi />

          {/* MAIN */}
          <main className="w-full relative h-[86vh]">
            {children}
          </main>

          {/* FOOTER */}
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}