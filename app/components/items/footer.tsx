import Image from "next/image";

export default function Footer() {
  return (
    <footer className="relative w-full h-[6vh] text-center dark:text-white dark:bg-zinc-950">
      
      {/* Gold glow */}
      <div
        className="
          pointer-events-none
          absolute
          left-1/2
          -top-8
          h-16
          w-1/3
          -translate-x-1/2
          rounded-full
          bg-yellow-400/10
          blur-2xl
        "
      />

      {/* Gold line */}
      <div
        className="
          absolute
          top-0
          left-1/2
          h-px
          w-24
          -translate-x-1/2
          bg-linear-to-r
          from-transparent
          via-yellow-500/50
          to-transparent
        "
      />
     
        <div className="flex items-center justify-end gap-4 border-b border-black dark:border-yellow-300/50 w-full md:w-1/2 md:mx-auto px-4 text-sm">
          <Image src={"/images/logo.png"} height={40} width={40} alt="logo.png" loading="lazy"/>
          <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-200">
            <span className="hover:underline hover:cursor-pointer">About</span>
            <span className="hover:underline hover:cursor-pointer">Privacy</span>
            <span className="hover:underline hover:cursor-pointer">Contact</span>
          </div>
        </div>
        <p className="relative z-10 text-xs text-zinc-500 dark:text-zinc-300">
          © {new Date().getFullYear()} {"Mann's Intelligence"}. All rights reserved.
        </p>

    </footer>
  );
}