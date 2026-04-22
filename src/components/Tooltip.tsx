"use client";

import { useRef, useState, type ReactNode } from "react";

type TooltipProps = {
  text: string;
  children: ReactNode;
  side?: "top" | "bottom";
};

export function Tooltip({ text, children, side = "bottom" }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    timerRef.current = setTimeout(() => setVisible(true), 320);
  };
  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  };

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <span
          role="tooltip"
          className={`pointer-events-none absolute z-[999] whitespace-nowrap rounded-md border border-white/10 bg-zinc-900 px-2 py-1 font-mono text-[10px] font-medium tracking-[0.03em] text-white/80 shadow-lg ${
            side === "top"
              ? "bottom-full left-1/2 mb-1.5 -translate-x-1/2"
              : "top-full left-1/2 mt-1.5 -translate-x-1/2"
          }`}
        >
          {text}
        </span>
      )}
    </span>
  );
}
