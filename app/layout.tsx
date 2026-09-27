
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "next-themes";
import Navigasi from "./components/items/navigator";
import Footer from "./components/items/footer";
import ServiceWorkerRegister from "./components/pwa/service-worker-register";
import { AuthProvider } from "./components/auth/AuthProvider";

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
      <body className="h-screen overflow-hidden">
        <AuthProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem={false}
            >
            <div className="flex h-screen flex-col overflow-hidden">
              <div className="shrink-0">
                <Navigasi />
              </div>

              <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
                {children}
              </main>

              <div className="shrink-0">
                <Footer />
              </div>
            </div>

            <ServiceWorkerRegister />
          </ThemeProvider>
          </AuthProvider>
      </body>
    </html>
  );
}