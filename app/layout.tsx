
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "next-themes";
import Navigasi from "./components/items/navigator";
import Footer from "./components/items/footer";
import ServiceWorkerRegister from "./components/pwa/service-worker-register";

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

  appleWebApp: {
    capable: true,
    title: "Mann's Intelligence",
    statusBarStyle: "black-translucent",
  },
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
      <body className="flex min-h-screen flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
        >
          {/* PWA SERVICE WORKER */}
          <ServiceWorkerRegister />

          {/* NAVIGASI */}
          <Navigasi />

          {/* MAIN */}
          <main className="relative h-[86vh] w-full">
            {children}
          </main>

          {/* FOOTER */}
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}