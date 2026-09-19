import * as React from "react";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
};

export default function Input({
  label,
  error,
  startIcon,
  endIcon,
  className = "",
  ...props
}: InputProps) {
  return (
    <div className="w-full">
      {/* Label */}
      {label && (
        <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {label}
        </label>
      )}

      <div className="group relative">
        {/* Outer glow */}
        <div
          className="
            pointer-events-none
            absolute -inset-[1px]
            rounded-xl
            bg-gradient-to-r
            from-yellow-500/0
            via-yellow-400/0
            to-yellow-500/0
            opacity-0
            blur-md
            transition-all duration-500

            group-hover:opacity-40

            group-focus-within:from-yellow-500/40
            group-focus-within:via-yellow-300/30
            group-focus-within:to-yellow-500/40
            group-focus-within:opacity-100
          "
        />

        {/* Input */}
        <div
          className="
            relative
            flex
            h-11
            items-center
            overflow-hidden
            rounded-xl
            border
            border-zinc-200
            bg-white
            transition-all duration-300

            hover:border-zinc-300

            focus-within:border-yellow-500/60
            focus-within:shadow-[0_0_25px_rgba(234,179,8,0.08)]

            dark:border-zinc-800
            dark:bg-zinc-950

            dark:hover:border-zinc-700

            dark:focus-within:border-yellow-500/60
            dark:focus-within:bg-zinc-900/90
            dark:focus-within:shadow-[0_0_30px_rgba(234,179,8,0.12)]
          "
        >
          {/* Left icon */}
          {startIcon && (
            <div
              className="
                ml-3
                shrink-0
                text-zinc-400
                transition-colors duration-300

                group-focus-within:text-yellow-500

                dark:text-zinc-600
                dark:group-focus-within:text-yellow-400
              "
            >
              {startIcon}
            </div>
          )}

          <input
            {...props}
            className={`
              h-full
              min-w-0
              flex-1
              bg-transparent
              px-4
              text-sm
              text-zinc-900
              outline-none
              dark:outline
              dark:outline-yellow-400
              
              placeholder:text-zinc-400
              dark:placeholder:text-zinc-400

              dark:text-zinc-100

              disabled:cursor-not-allowed
              disabled:opacity-50

              ${startIcon ? "pl-3" : ""}
              ${endIcon ? "pr-3" : ""}

              ${className}
            `}
          />

          {/* Right icon */}
          {endIcon && (
            <div
              className="
                mr-3
                shrink-0
                text-zinc-400
                transition-colors duration-300

                group-focus-within:text-yellow-500

                dark:text-zinc-600
                dark:group-focus-within:text-yellow-400
              "
            >
              {endIcon}
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
