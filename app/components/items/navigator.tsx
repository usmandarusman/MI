"use client";

import Image from "next/image";
import {
  LogIn,
  LogOut,
  UserRound,
} from "lucide-react";
import { useState } from "react";

import ThemeToggle from "../fragments/toogleSwitcher";
import InstallButton from "../pwa/install-button";
import { useAuth } from "../auth/AuthProvider";
import LoginRequired from "../auth/LoginRequired";

export default function Navigasi() {
  const {
    user,
    loading: authLoading,
    logout,
  } = useAuth();

  const [showLogin, setShowLogin] =
    useState(false);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error(
        "[Auth] Logout error:",
        error
      );
    }
  };

  const userEmail =
    user?.email ?? "";

  return (
    <>
      {/* =====================================================
          LOGIN MODAL
      ===================================================== */}

      {showLogin && (
        <div
          className="
            fixed
            inset-0
            z-[10000]
            flex
            items-center
            justify-center
            bg-black/70
            p-4
            backdrop-blur-sm
          "
        >
          <LoginRequired
            onClose={() =>
              setShowLogin(false)
            }
          />
        </div>
      )}

      {/* =====================================================
          HEADER
      ===================================================== */}

      <header
        className="
          relative
          z-50
          flex
          h-[8vh]
          w-full
          items-center
          justify-between
          px-4
          py-2
          shadow-sm
          dark:bg-zinc-800
          dark:shadow-white
        "
      >
        {/* ===================================================
            LOGO
        =================================================== */}

        <section className="flex items-center">
          <Image
            src="/images/logoname.png"
            alt="Logo Name"
            width={400}
            height={120}
            className="
              h-auto
              w-full
              max-w-45
              object-contain
              drop-shadow-xl
              sm:max-w-55
              md:max-w-65
            "
            priority
          />
        </section>

        {/* ===================================================
            RIGHT ACTIONS
        =================================================== */}

        <div
          className="
            flex
            shrink-0
            items-center
            gap-1.5
            sm:gap-2
          "
        >
          {/* =================================================
              THEME
          ================================================= */}

          <ThemeToggle />

          {/* =================================================
              LOGIN / USER
          ================================================= */}

          {authLoading ? (
            <div
              className="
                h-9
                w-9
                animate-pulse
                rounded-xl
                bg-zinc-200
                dark:bg-zinc-700
              "
            />
          ) : user ? (
            <div
              className="
                flex
                items-center
                gap-1.5
                rounded-xl
                border
                border-yellow-500/20
                bg-yellow-500/5
                p-1
                transition-all
                duration-200
                dark:bg-yellow-500/10
              "
            >
              {/* USER INFO */}

              <div
                className="
                  hidden
                  items-center
                  gap-2
                  px-2
                  sm:flex
                "
              >
                <div
                  className="
                    flex
                    h-7
                    w-7
                    shrink-0
                    items-center
                    justify-center
                    rounded-lg
                    bg-yellow-500/15
                    text-yellow-500
                  "
                >
                  <UserRound size={15} />
                </div>

                <div className="max-w-35">
                  <p
                    className="
                      truncate
                      text-[10px]
                      font-semibold
                      text-zinc-800
                      dark:text-zinc-200
                    "
                  >
                    {user.displayName ||
                      "User"}
                  </p>

                  <p
                    className="
                      truncate
                      text-[9px]
                      text-zinc-400
                    "
                  >
                    {userEmail}
                  </p>
                </div>
              </div>

              {/* LOGOUT */}

              <button
                type="button"
                onClick={handleLogout}
                title="Logout"
                aria-label="Logout"
                className="
                  flex
                  h-8
                  w-8
                  items-center
                  justify-center
                  rounded-lg
                  text-zinc-500
                  transition-all
                  duration-200
                  hover:bg-red-500/10
                  hover:text-red-500
                  active:scale-95
                  dark:text-zinc-400
                "
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() =>
                setShowLogin(true)
              }
              title="Login"
              aria-label="Login"
              className="
                group
                flex
                h-9
                items-center
                gap-1.5
                rounded-xl
                border
                border-yellow-500/30
                bg-yellow-500/10
                px-3
                text-xs
                font-semibold
                text-yellow-600
                shadow-sm
                transition-all
                duration-200
                hover:border-yellow-500/50
                hover:bg-yellow-500/15
                hover:shadow-[0_4px_20px_rgba(234,179,8,0.12)]
                active:scale-95
                dark:text-yellow-400
              "
            >
              <LogIn
                size={15}
                className="
                  transition-transform
                  duration-200
                  group-hover:translate-x-0.5
                "
              />

              <span className="hidden sm:inline">
                Login
              </span>
            </button>
          )}

          {/* =================================================
              INSTALL
          ================================================= */}

          <InstallButton />
        </div>
      </header>
    </>
  );
}