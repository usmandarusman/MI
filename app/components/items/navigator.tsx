"use client";

import Image from "next/image";
import Link from "next/link";
import ThemeToggle from "../fragments/toogleSwitcher";
import InstallButton from "../pwa/install-button";

export default function Navigasi() {
  return (
    <header className="w-full h-[8vh] flex items-center justify-between px-4 py-2  dark:bg-zinc-800 z-50 shadow-sm dark:shadow-white">
      
      {/* Logo */}
      <section className="flex items-center">
        <Link href="/" className="shrink-0">
          <Image
            src="/images/logoname.png"
            alt="Logo Name"
            width={400}
            height={120}
            className="w-full max-w-45 sm:max-w-55 md:max-w-65 h-auto object-contain drop-shadow-xl"
            priority
            />
        </Link>
      </section>

      {/* Toggle */}
      <div className="shrink-0 flex gap-2 items-center">
        <ThemeToggle />
        <InstallButton/>
      </div>

    </header>
  );
}