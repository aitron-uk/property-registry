import { Suspense } from "react";
import { saveSettings } from "@/app/actions";
import { getSettings } from "@/lib/db";

async function Form({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const [s, { saved }] = await Promise.all([getSettings(), searchParams]);
  const located = (lat: number | null | undefined) =>
    lat ? <span className="text-xs text-good">✓ located</span> : <span className="text-xs text-muted">not located yet</span>;

  return (
    <form action={saveSettings} className="card mx-auto max-w-2xl space-y-5 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted">Used for drive times, routes, budget warnings, stamp duty and to tailor every AI report to you.</p>
      </div>
      {saved && (
        <p className={`rounded-lg px-3 py-2 text-sm ${saved === "11" ? "bg-emerald-50 text-good" : "bg-amber-50 text-warn"}`}>
          Saved. {saved !== "11" && "One address couldn't be located. Try a full postcode (e.g. CR7 8AA)."}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className="label">🏠 My current home (postcode or address) {located(s?.home_lat)}</span>
          <input name="home_label" className="input" defaultValue={s?.home_label ?? ""} placeholder="CR7 8AA" />
        </label>
        <label>
          <span className="label">💼 My office (postcode or address) {located(s?.office_lat)}</span>
          <input name="office_label" className="input" defaultValue={s?.office_label ?? ""} placeholder="EC2A 4NE" />
        </label>
        <label>
          <span className="label">Budget from £</span>
          <input name="budget_min" type="number" className="input" defaultValue={s?.budget_min ?? ""} placeholder="350000" />
        </label>
        <label>
          <span className="label">Budget to £</span>
          <input name="budget_max" type="number" className="input" defaultValue={s?.budget_max ?? ""} placeholder="380000" />
        </label>
        <label className="sm:col-span-2">
          <span className="label">Stamp duty</span>
          <select name="buyer_type" className="input" defaultValue={s?.buyer_type ?? "standard"}>
            <option value="standard">Standard (moving home, selling my current one)</option>
            <option value="first_time">First-time buyer</option>
            <option value="additional">Additional property (+5% surcharge)</option>
          </select>
        </label>
        <label className="sm:col-span-2">
          <span className="label">About me (the AI tailors its advice to this)</span>
          <textarea
            name="buyer_context"
            className="input h-28"
            defaultValue={s?.buyer_context ?? ""}
            placeholder="Family with a young child, moving from Thornton Heath. Need good primary schools, parking, and an easy commute to London. Prefer freehold, happy to redo a kitchen."
          />
        </label>
      </div>
      <button className="btn-primary">Save settings</button>
    </form>
  );
}

export default function Page({ searchParams }: PageProps<"/settings">) {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-2xl animate-pulse rounded-2xl bg-line/50" />}>
      <Form searchParams={searchParams as Promise<{ saved?: string }>} />
    </Suspense>
  );
}
