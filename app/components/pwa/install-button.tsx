
"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
}

// Deteksi status PWA tanpa setState di useEffect
function subscribeToInstall(callback: () => void) {
  const media = window.matchMedia("(display-mode: standalone)");

  media.addEventListener("change", callback);
  window.addEventListener("appinstalled", callback);

  return () => {
    media.removeEventListener("change", callback);
    window.removeEventListener("appinstalled", callback);
  };
}

function getInstalledSnapshot() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function getServerSnapshot() {
  return false;
}

export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  const [showIOSHelp, setShowIOSHelp] = useState(false);

  // Status install disinkronkan dengan browser
  const isInstalled = useSyncExternalStore(
    subscribeToInstall,
    getInstalledSnapshot,
    getServerSnapshot
  );

  useEffect(() => {
    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();

      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstall
    );

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstall
      );
    };
  }, []);

  async function handleInstall() {
    // Deteksi iOS saat tombol diklik
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" &&
        navigator.maxTouchPoints > 1);

    if (isIOS) {
      setShowIOSHelp((prev) => !prev);
      return;
    }

    if (!deferredPrompt) {
      alert(
        "Install belum tersedia. Coba gunakan Chrome atau Edge, lalu buka menu browser dan pilih Install App / Add to Home Screen."
      );
      return;
    }

    await deferredPrompt.prompt();

    const choice = await deferredPrompt.userChoice;

    if (choice.outcome === "accepted") {
      setDeferredPrompt(null);
    }
  }

  // Sembunyikan tombol jika aplikasi sudah ter-install
  if (isInstalled) return null;

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleInstall}
        className="
          inline-flex items-center justify-center gap-2
          rounded-xl border border-amber-400/30
          bg-gradient-to-r from-amber-400 to-yellow-500
          px-4 py-2.5 text-sm font-semibold
          text-zinc-950 shadow-lg shadow-amber-500/10
          transition-all duration-200
          hover:-translate-y-0.5 hover:shadow-amber-500/20
          active:translate-y-0
        "
      >
        Install App
      </button>

      {showIOSHelp && (
        <div
          className="
            max-w-xs rounded-xl border
            border-amber-400/20 bg-zinc-900
            p-3 text-xs leading-relaxed text-zinc-300
          "
        >
          <p className="font-semibold text-amber-400">
            Install di iPhone / iPad
          </p>

          <ol className="mt-2 list-decimal space-y-1 pl-4">
            <li>Buka website melalui Safari.</li>
            <li>Tekan tombol Share.</li>
            <li>Pilih Add to Home Screen.</li>
            <li>Tekan Add.</li>
          </ol>
        </div>
      )}
    </div>
  );
}