/* eslint-disable react-hooks/set-state-in-effect */

"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useTheme } from "next-themes";
import {
  Activity,
  ArrowDownToLine,
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sun,
  Terminal,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";

type TokenStatus = {
  configured: boolean;
  updatedAt: string | null;
};

type Notice = {
  type: "success" | "error";
  message: string;
};

type ApiResult = {
  success: boolean;
  message?: string;
  configured?: boolean;
  updatedAt?: string | null;
};

function formatDate(value: string | null): string {
  if (!value) return "Belum pernah diperbarui";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Waktu tidak tersedia";
  }

  return (
    new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Jakarta",
    }).format(date) + " WIB"
  );
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export default function AxentrazAdminPage() {
  const { resolvedTheme, setTheme } = useTheme();

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [status, setStatus] = useState<TokenStatus>({
    configured: false,
    updatedAt: null,
  });
  const [notice, setNotice] = useState<Notice | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
        setAuthLoading(false);
      },
      (error) => {
        setAuthLoading(false);
        setNotice({
          type: "error",
          message: getErrorMessage(
            error,
            "Gagal memeriksa sesi login."
          ),
        });
      }
    );

    return unsubscribe;
  }, []);

  const requestApi = useCallback(
    async (
      method: "GET" | "PUT",
      accessToken?: string
    ): Promise<ApiResult> => {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        throw new Error(
          "Sesi login tidak ditemukan. Silakan login kembali."
        );
      }

      const idToken = await currentUser.getIdToken();

      const response = await fetch(
        "/api/admin/axentraz-token",
        {
          method,
          headers: {
            Authorization: `Bearer ${idToken}`,
            ...(method === "PUT"
              ? { "Content-Type": "application/json" }
              : {}),
          },
          cache: "no-store",
          ...(method === "PUT"
            ? {
                body: JSON.stringify({
                  accessToken,
                }),
              }
            : {}),
        }
      );

      const result: unknown = await response
        .json()
        .catch(() => null);

      if (
        !response.ok ||
        !result ||
        typeof result !== "object" ||
        !("success" in result) ||
        result.success !== true
      ) {
        const message =
          result &&
          typeof result === "object" &&
          "message" in result &&
          typeof result.message === "string"
            ? result.message
            : `Request gagal (${response.status}).`;

        throw new Error(message);
      }

      return result as ApiResult;
    },
    []
  );

  const loadStatus = useCallback(async () => {
    if (!auth.currentUser) return;

    setLoadingStatus(true);

    try {
      const result = await requestApi("GET");

      setStatus({
        configured: Boolean(result.configured),
        updatedAt: result.updatedAt ?? null,
      });
    } catch (error) {
      setNotice({
        type: "error",
        message: getErrorMessage(
          error,
          "Gagal membaca status token."
        ),
      });
    } finally {
      setLoadingStatus(false);
    }
  }, [requestApi]);

  useEffect(() => {
    if (user) {
      void loadStatus();
    } else {
      setStatus({
        configured: false,
        updatedAt: null,
      });
    }
  }, [user, loadStatus]);

  async function handleLogin() {
    setBusy(true);
    setNotice(null);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: "select_account",
      });

      await signInWithPopup(auth, provider);

      // Hak admin tetap harus diverifikasi oleh API server.
    } catch (error) {
      setNotice({
        type: "error",
        message: getErrorMessage(
          error,
          "Login Google gagal."
        ),
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    if (busy) return;

    setBusy(true);
    setNotice(null);

    try {
      await signOut(auth);

      setToken("");
      setShowToken(false);
      setStatus({
        configured: false,
        updatedAt: null,
      });
    } catch (error) {
      setNotice({
        type: "error",
        message: getErrorMessage(
          error,
          "Gagal keluar dari akun."
        ),
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    const value = token.trim();

    if (!value) {
      setNotice({
        type: "error",
        message: "Masukkan token Axentraz terlebih dahulu.",
      });
      return;
    }

    if (
      !window.confirm(
        "Simpan token Axentraz terbaru ke Firestore?"
      )
    ) {
      return;
    }

    setBusy(true);
    setNotice(null);

    try {
      const result = await requestApi("PUT", value);

      setToken("");
      setShowToken(false);

      setNotice({
        type: "success",
        message:
          result.message || "Token berhasil disimpan.",
      });

      await loadStatus();
    } catch (error) {
      setNotice({
        type: "error",
        message: getErrorMessage(
          error,
          "Gagal menyimpan token."
        ),
      });
    } finally {
      setBusy(false);
    }
  }

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <main className="mi-admin min-h-screen overflow-hidden bg-[#f5f7fb] text-slate-900 transition-colors dark:bg-[#080b12] dark:text-slate-100">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-cyan-400/10 blur-[120px]" />
        <div className="absolute -right-40 top-40 h-96 w-96 rounded-full bg-violet-500/10 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-blue-500/5 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-5 sm:px-7 lg:px-10">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200/80 pb-5 dark:border-white/10">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-600 shadow-sm shadow-cyan-500/10 dark:text-cyan-300">
              <Activity size={22} />
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-wide">
                MANN&apos;S INTELLIGENCE
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Control Center / Administrator
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setTheme(isDark ? "light" : "dark")
              }
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white/80 transition hover:border-cyan-400 hover:text-cyan-600 dark:border-white/10 dark:bg-white/5 dark:hover:text-cyan-300"
              aria-label="Ganti tema"
            >
              {!mounted || isDark ? (
                <Sun size={18} />
              ) : (
                <Moon size={18} />
              )}
            </button>

            {user && (
              <button
                type="button"
                onClick={() => void handleLogout()}
                disabled={busy}
                className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 text-sm transition hover:border-rose-400 hover:text-rose-600 disabled:opacity-50 dark:border-white/10 dark:bg-white/5"
              >
                {busy ? (
                  <LoaderCircle
                    size={16}
                    className="animate-spin"
                  />
                ) : (
                  <LogOut size={16} />
                )}
                <span className="hidden sm:inline">
                  Keluar
                </span>
              </button>
            )}
          </div>
        </header>

        <section className="grid gap-10 py-10 lg:grid-cols-[1fr_0.8fr] lg:items-center lg:py-16">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/5 px-3 py-1.5 text-xs font-semibold text-cyan-700 dark:text-cyan-300">
              <ShieldCheck size={15} />
              PRIVATE ADMIN ENVIRONMENT
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </div>

            <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Admin
              <span className="block bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 bg-clip-text text-transparent">
                Control Center.
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-sm leading-7 text-slate-600 dark:text-slate-400 sm:text-base">
              Kelola kredensial integrasi Axentraz secara
              terpusat. Perbarui token tanpa mengubah konfigurasi
              deployment atau menjalankan redeploy setiap kali
              token berganti.
            </p>

            <div className="mt-8 grid max-w-xl grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.035]">
                <KeyRound
                  className="mb-3 text-cyan-600 dark:text-cyan-300"
                  size={20}
                />
                <p className="text-sm font-semibold">
                  Secure storage
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Firebase Admin SDK
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.035]">
                <Zap
                  className="mb-3 text-violet-600 dark:text-violet-300"
                  size={20}
                />
                <p className="text-sm font-semibold">
                  No redeploy
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Update langsung di Firestore
                </p>
              </div>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-lg">
            <div className="absolute -inset-1 rounded-[30px] bg-gradient-to-br from-cyan-400/20 via-blue-500/10 to-violet-500/20 blur-xl" />

            <div className="relative overflow-hidden rounded-[26px] border border-slate-200 bg-white/90 shadow-2xl shadow-slate-900/5 backdrop-blur-2xl dark:border-white/10 dark:bg-[#0d121d]/95 dark:shadow-black/30">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-white/10 sm:px-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400/20 to-blue-500/20 text-cyan-700 dark:text-cyan-300">
                    <LockKeyhole size={19} />
                  </div>

                  <div>
                    <h2 className="text-sm font-bold">
                      {user
                        ? "Axentraz Credentials"
                        : "Admin Authentication"}
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {user
                        ? "Token management"
                        : "Restricted access"}
                    </p>
                  </div>
                </div>

                <span className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold tracking-wider text-slate-500 dark:border-white/10 dark:text-slate-400">
                  ADMIN
                </span>
              </div>

              <div className="p-5 sm:p-6">
                {notice && (
                  <div
                    role="status"
                    className={`mb-5 flex items-start gap-2 rounded-xl border p-3 text-sm ${
                      notice.type === "success"
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                    }`}
                  >
                    {notice.type === "success" ? (
                      <CheckCircle2
                        className="mt-0.5 shrink-0"
                        size={17}
                      />
                    ) : (
                      <CircleAlert
                        className="mt-0.5 shrink-0"
                        size={17}
                      />
                    )}

                    <span className="flex-1">
                      {notice.message}
                    </span>

                    <button
                      type="button"
                      onClick={() => setNotice(null)}
                      aria-label="Tutup notifikasi"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}

                {authLoading ? (
                  <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-slate-500">
                    <LoaderCircle
                      className="animate-spin text-cyan-500"
                      size={28}
                    />
                    <p className="text-sm">
                      Memeriksa sesi login...
                    </p>
                  </div>
                ) : !user ? (
                  <div className="py-6">
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300">
                      <ShieldCheck size={30} />
                    </div>

                    <h3 className="text-center text-lg font-bold">
                      Area terbatas
                    </h3>

                    <p className="mx-auto mt-2 max-w-xs text-center text-sm leading-6 text-slate-500 dark:text-slate-400">
                      Masuk dengan akun Google admin yang telah
                      diizinkan untuk mengakses konsol ini.
                    </p>

                    <button
                      type="button"
                      onClick={() => void handleLogin()}
                      disabled={busy}
                      className="mt-7 flex w-full items-center justify-center gap-3 rounded-xl bg-slate-900 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                    >
                      {busy ? (
                        <LoaderCircle
                          className="animate-spin"
                          size={18}
                        />
                      ) : (
                        <svg
                          viewBox="0 0 48 48"
                          className="h-5 w-5"
                          aria-hidden="true"
                        >
                          <path
                            fill="#EA4335"
                            d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 3.06 13.22l7.98 6.19C12.93 13.72 18.01 9.5 24 9.5z"
                          />
                          <path
                            fill="#4285F4"
                            d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.76 7.18l7.73 6C44.42 37.98 46.98 31.84 46.98 24.55z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M10.04 28.59A14.4 14.4 0 0 1 9.25 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.52 2.58 10.78l7.46-6.19z"
                          />
                          <path
                            fill="#34A853"
                            d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.89 2.3-8.18 2.3-5.99 0-11.07-4.22-12.96-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                          />
                        </svg>
                      )}

                      Masuk dengan Google
                    </button>

                    <div className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-500">
                      <LockKeyhole size={13} />
                      Login diverifikasi kembali oleh server
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/15 to-blue-500/15 text-cyan-600 dark:text-cyan-300">
                        <UserRound size={21} strokeWidth={1.8} />
                        </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {user.displayName || "Admin"}
                        </p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {user.email}
                        </p>
                      </div>

                      <CheckCircle2
                        className="shrink-0 text-emerald-500"
                        size={19}
                      />
                    </div>

                    <div className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <Activity
                            size={17}
                            className="text-cyan-600 dark:text-cyan-300"
                          />
                          Status token
                        </div>

                        <button
                          type="button"
                          onClick={() => void loadStatus()}
                          disabled={loadingStatus || busy}
                          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-cyan-600 disabled:opacity-50 dark:hover:text-cyan-300"
                        >
                          <RefreshCw
                            size={13}
                            className={
                              loadingStatus ? "animate-spin" : ""
                            }
                          />
                          Refresh
                        </button>
                      </div>

                      <div className="mt-4 flex items-center gap-3">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            status.configured
                              ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.55)]"
                              : "bg-amber-500"
                          }`}
                        />

                        <div>
                          <p className="text-sm font-semibold">
                            {loadingStatus
                              ? "Memeriksa..."
                              : status.configured
                                ? "Token tersimpan"
                                : "Token belum diatur"}
                          </p>

                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {formatDate(status.updatedAt)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="axentraz-token"
                        className="mb-2 block text-sm font-semibold"
                      >
                        Token Axentraz terbaru
                      </label>

                      <div className="relative">
                        <input
                          id="axentraz-token"
                          type={showToken ? "text" : "password"}
                          value={token}
                          onChange={(event) =>
                            setToken(event.target.value)
                          }
                          placeholder="Tempel token JWT di sini..."
                          autoComplete="off"
                          spellCheck={false}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 font-mono text-xs outline-none transition placeholder:font-sans placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 dark:border-white/10 dark:bg-[#090d16] dark:placeholder:text-slate-600"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setShowToken((value) => !value)
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-300"
                          aria-label={
                            showToken
                              ? "Sembunyikan token"
                              : "Tampilkan token"
                          }
                        >
                          {showToken ? (
                            <EyeOff size={18} />
                          ) : (
                            <Eye size={18} />
                          )}
                        </button>
                      </div>

                      <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        Tempel token saja, tanpa awalan{" "}
                        <code className="rounded bg-slate-200 px-1 py-0.5 dark:bg-white/10">
                          Bearer
                        </code>
                        . Token yang tersimpan tidak akan
                        ditampilkan kembali.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleSave()}
                      disabled={busy || !token.trim()}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy ? (
                        <LoaderCircle
                          className="animate-spin"
                          size={18}
                        />
                      ) : (
                        <ArrowDownToLine size={18} />
                      )}

                      {busy
                        ? "Menyimpan..."
                        : "Simpan token ke Firestore"}
                    </button>

                    <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-5 text-amber-700 dark:text-amber-200">
                      <CircleAlert
                        className="mt-0.5 shrink-0"
                        size={15}
                      />
                      <span>
                        Menyimpan token tidak memperpanjang masa
                        berlakunya. Jika token kedaluwarsa,
                        masukkan token baru.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 dark:border-white/10 sm:px-6">
                <div className="flex items-center gap-2 text-[10px] tracking-wider text-slate-500">
                  <Terminal size={13} />
                  MI ADMIN CONSOLE
                </div>

                <span className="text-[10px] text-slate-500">
                  SECURE CONFIG
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 border-t border-slate-200/80 py-7 dark:border-white/10 sm:grid-cols-3">
          <div className="flex items-start gap-3">
            <ShieldCheck
              className="mt-0.5 text-emerald-500"
              size={19}
            />
            <div>
              <p className="text-sm font-semibold">
                Admin-only access
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Email admin diperiksa oleh server.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <KeyRound
              className="mt-0.5 text-cyan-600 dark:text-cyan-300"
              size={19}
            />
            <div>
              <p className="text-sm font-semibold">
                Secret-safe response
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                API status tidak mengembalikan isi token.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Clock3
              className="mt-0.5 text-violet-600 dark:text-violet-300"
              size={19}
            />
            <div>
              <p className="text-sm font-semibold">
                Live configuration
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Pembaruan disimpan langsung ke Firestore.
              </p>
            </div>
          </div>
        </section>

        <footer className="flex flex-col items-center justify-between gap-3 border-t border-slate-200/80 py-5 text-xs text-slate-500 dark:border-white/10 sm:flex-row">
          <span>
            © {new Date().getFullYear()} Mann&apos;s Intelligence
          </span>

          <Link
            href="/"
            className="inline-flex items-center gap-2 transition hover:text-cyan-600 dark:hover:text-cyan-300"
          >
            <ArrowLeft size={14} />
            Kembali ke aplikasi
          </Link>
        </footer>
      </div>
    </main>
  );
}
