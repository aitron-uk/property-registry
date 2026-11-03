"use client";
import type { ReactNode } from "react";

export const scoreColor = (s: number | null | undefined) =>
  s == null ? "#9ca3af" : s >= 70 ? "#15803d" : s >= 55 ? "#65a30d" : s >= 40 ? "#d97706" : "#dc2626";

export function Score({ value, size = "md" }: { value: number | null | undefined; size?: "md" | "lg" }) {
  const lg = size === "lg";
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full font-bold text-white ${lg ? "h-16 w-16 text-xl" : "h-9 w-9 text-xs"}`}
      style={{ background: scoreColor(value) }}
      title="AI score (0-100)"
    >
      {value ?? "–"}
    </span>
  );
}

const STATUS_STYLE: Record<string, string> = {
  interested: "bg-sky-50 text-sky-700",
  viewing: "bg-violet-50 text-violet-700",
  viewed: "bg-amber-50 text-amber-700",
  offer: "bg-emerald-50 text-emerald-700",
  rejected: "bg-gray-100 text-gray-500",
};
export const StatusChip = ({ status }: { status: string }) => (
  <span className={`chip capitalize ${STATUS_STYLE[status] ?? "bg-gray-100"}`}>{status}</span>
);

const DECOR_STYLE: Record<string, string> = {
  "move-in ready": "bg-emerald-50 text-emerald-700",
  "light refresh": "bg-lime-50 text-lime-700",
  "needs modernising": "bg-amber-50 text-amber-700",
  "full renovation": "bg-red-50 text-red-700",
};
export const DecorChip = ({ state }: { state: string | null }) =>
  state ? <span className={`chip ${DECOR_STYLE[state] ?? "bg-gray-100"}`}>{state}</span> : null;

export const Flag = ({ on, children }: { on: boolean; children: ReactNode }) =>
  on ? <span className="chip bg-red-50 text-red-700">{children}</span> : null;

export function Bar({ label, value, max, color = "#0f766e", suffix = "" }: { label: string; value: number; max: number; color?: string; suffix?: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span>{label}</span>
        <span className="font-medium tabular-nums">
          {value}
          {suffix}
        </span>
      </div>
      <div className="h-2 rounded-full bg-paper">
        <div className="h-2 rounded-full transition-all" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }} />
      </div>
    </div>
  );
}

export function Stars({ value, onChange }: { value: number | null; onChange?: (v: number | null) => void }) {
  return (
    <span className="inline-flex" onClick={(e) => e.stopPropagation()}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(value === i ? null : i)}
          className={`text-base leading-none ${i <= (value ?? 0) ? "text-amber-400" : "text-gray-300"} ${onChange ? "hover:scale-110" : ""}`}
          aria-label={`${i} star`}
        >
          ★
        </button>
      ))}
    </span>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 truncate text-xs text-muted">{hint}</div>}
    </div>
  );
}
