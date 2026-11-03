"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const STEPS = [
  "Reading the listing…",
  "Extracting size, rooms and condition…",
  "Checking nearby schools & Ofsted…",
  "Comparing local crime rates…",
  "Looking up Census community data…",
  "Finding stations & journey times…",
  "Pulling sold prices on the street…",
  "Estimating refurb costs…",
  "Scoring and writing the verdict…",
];

export function useAnalyse() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 9000);
    return () => clearInterval(t);
  }, [busy]);

  async function run(body: { url: string; text?: string; id?: string }) {
    setStep(0);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/analyse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
      if (!res.ok) throw new Error(json.error);
      router.push(`/p/${json.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }
  return { run, busy, error, stepText: STEPS[step], progress: (step + 1) / STEPS.length };
}

export function Progress({ text, progress }: { text: string; progress: number }) {
  return (
    <div className="mt-3">
      <div className="flex items-center gap-2 text-sm text-brand">
        <span className="h-2 w-2 animate-ping rounded-full bg-brand" />
        {text} <span className="text-muted">(usually 1–2 minutes)</span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-paper">
        <div className="h-1 bg-brand transition-all duration-[9000ms] ease-linear" style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
}

export default function AddBar() {
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [showText, setShowText] = useState(false);
  const { run, busy, error, stepText, progress } = useAnalyse();

  return (
    <form
      className="card p-4 sm:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        run({ url: url.trim(), text });
      }}
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className="input h-11 flex-1 text-base"
          placeholder="Paste a Rightmove, Zoopla or OnTheMarket link…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={busy}
          required
          type="url"
        />
        <button className="btn-primary h-11 px-5" disabled={busy || !url}>
          {busy ? "Researching…" : "✦ Analyse & add"}
        </button>
      </div>
      <button type="button" className="mt-2 text-xs text-muted underline-offset-2 hover:underline" onClick={() => setShowText((v) => !v)}>
        {showText ? "Hide" : "+ Add"} extra notes or paste listing text (if the site blocks fetching)
      </button>
      {showText && (
        <textarea
          className="input mt-2 h-28"
          placeholder="Anything the AI should know: listing text, what the agent said, your concerns…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      )}
      {busy && <Progress text={stepText} progress={progress} />}
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-bad">{error}</p>}
    </form>
  );
}
