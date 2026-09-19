"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  const dark = resolvedTheme === "dark";

  return (
    <button
      onClick={() => setTheme(dark ? "light" : "dark")}
      className={`flex h-12 w-12 items-center justify-center
        rounded-full
        hover:cursor-pointer
        transition-colors
        duration-500  ${!dark && "shadow-yellow-500"}`}
    >
      <div
        key={resolvedTheme}
        className="
          animate-[spinScale_0.7s_ease-in-out]
        "
      >
        {dark ? (
          <Moon className="h-6 w-6 md:w-8 md:h-8 text-white " />
        ) : (
          <Sun className="h-8 w-8 md:w-10 md:h-10 text-yellow-300" />
        )}
      </div>
    </button>
  );
}