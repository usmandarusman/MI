"use client";

import { ThemeProvider } from "next-themes";

export function themeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider  attribute="class" defaultTheme="dark" enableSystem>
      {children}
    </ThemeProvider>
  );
}