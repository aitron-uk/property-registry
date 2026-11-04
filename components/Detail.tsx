"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import type { Property, Report, Settings } from "@/lib/types";
import { DECOR, PARKING, STATUSES } from "@/lib/types";
import { LEGAL_FEES, ORIGINS, gbp, gbpShort, gmapsDirections, origins, refurbEstimate, stampDuty, type FactField } from "@/lib/calc";
import { driveRoute } from "@/lib/osrm";
import { deleteProperty, refreshNearby, setPhotos, updateField, updateProperty } from "@/app/actions";
import { CATS, nearest, noisyNeighbours, ofstedRank, within } from "@/lib/places";
import type { Place } from "@/lib/types";
import { Progress, useAnalyse } from "./AddBar";
import type { Route } from "./MapView";
import { Bar, DecorChip, Flag, Score, Stars, StatusChip } from "./ui";

const MapView = dynamic(() => import("./MapView"), { ssr: false, loading: () => <div className="h-full animate-pulse rounded-2xl bg-line/50" /> });

const SCORE_LABELS: [keyof Report["scores"], string][] = [
  ["location", "Location"],
  ["value", "Value for money"],
  ["condition", "Condition"],
  ["transport", "Transport"],
  ["schools", "Schools"],
  ["safety", "Safety"],
  ["family", "Family life"],
];
const DEMO_COLORS = ["#64748b", "#0f766e", "#d97706", "#7c3aed", "#db2777", "#0284c7"];

export default function Detail({ p, settings }: { p: Property; settings: Settings | null }) {
  const r = p.ai;
  const from = origins(settings);
  const here: [number, number] | null = p.lat ? [p.lat, p.lng!] : null;
  const [routes, setRoutes] = useState<Route[]>([]);
  const { run, busy, error, stepText, progress } = useAnalyse();

  useEffect(() => {
    if (!here) return;
    Promise.all(from.map((o) => driveRoute(o.ll, here).then((r) => r && { ...r, kind: o.kind }))).then((rs) =>
      setRoutes(rs.filter(Boolean) as Route[]),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.lat, p.lng]);

  const sdlt = p.price ? stampDuty(p.price, settings?.buyer_type) : 0;
  const refurb = refurbEstimate(p);
  const images = [...new Set([p.image_url, ...(r?.images ?? [])].filter(Boolean) as string[])];

  return (
    <div className="space-y-5">
      <Link href="/" className="text-sm text-muted hover:text-ink">
        ← All properties
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div className="flex-1">
          <div className="mb-2 flex flex-wrap gap-1.5">
            <StatusChip status={p.status} />
            <DecorChip state={p.decor_state} />
            <Flag on={p.needs_kitchen}>Needs new kitchen</Flag>
            <Flag on={p.needs_bathroom}>Needs new bathroom</Flag>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{p.address ?? p.title}</h1>
          <p className="mt-1 text-muted">{p.title}</p>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-1">
            <span className="text-3xl font-semibold tabular-nums">{gbp(p.price)}</span>
            {p.price_per_sqft && <span className="text-muted tabular-nums">{gbp(p.price_per_sqft)} / ft²</span>}
            {r?.value?.fair_value_low && (
              <span className="text-sm text-muted">
                AI fair value {gbpShort(r.value.fair_value_low)}–{gbpShort(r.value.fair_value_high)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Score value={p.ai_score} size="lg" />
          <div className="flex flex-col gap-2">
            {p.url && (
              <a href={p.url} target="_blank" rel="noreferrer" className="btn-ghost">
                Listing ↗
              </a>
            )}
            {p.url && (
              <button className="btn-ghost" disabled={busy} onClick={() => run({ url: p.url!, id: p.id })}>
                ↻ Re-analyse
              </button>
            )}
          </div>
        </div>
      </div>
      {busy && <Progress text={stepText} progress={progress} />}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-bad">{error}</p>}
      <Alerts p={p} />

      {/* Key facts */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {(
          [
            ["property_type", "Type", p.property_type],
            ["bedrooms", "Bedrooms", p.bedrooms],
            ["bathrooms", "Bathrooms", p.bathrooms],
            ["receptions", "Receptions", p.receptions],
            ["size_sqft", "Size (ft² or m²)", p.size_sqft, p.size_sqft && `${p.size_sqft} ft²`],
            ["tenure", "Tenure", p.tenure],
            ["parking", "Parking", p.parking],
            ["garden", "Garden", p.garden],
            ["council_tax_band", "Council tax band", p.council_tax_band, p.council_tax_band && `Band ${p.council_tax_band}`],
            ["epc_rating", "EPC", p.epc_rating],
            ["nearest_station", "Nearest station", p.nearest_station],
            ["station_distance_km", "Station distance", p.station_distance_km, p.station_distance_km != null && `${p.station_distance_km} km`],
            ["agent", "Agent", p.agent],
            ["listed_date", "Listed", p.listed_date, p.listed_date && new Date(p.listed_date).toLocaleDateString("en-GB")],
            ["flood_risk", "Flood risk", r?.flood_risk],
            ["broadband", "Broadband", r?.broadband],
          ] as [FactField, string, string | number | null | undefined, (string | false | null | 0)?][]
        ).map(([field, label, value, shown]) => (
          <Fact key={field} id={p.id} field={field} label={label} value={value} shown={shown || undefined} />
        ))}
      </div>
      <p className="-mt-3 text-xs text-muted">Click any detail to correct it or fill in what the listing didn&apos;t say.</p>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        {/* Left: report */}
        <div className="space-y-5">
          <Photos id={p.id} images={images} />

          {!r ? (
            <Section title="No AI report yet">
              <p className="text-sm text-muted">Click Re-analyse to research this property.</p>
            </Section>
          ) : (
            <>
              <Section title="My first impression">
                <p className="leading-relaxed">{r.summary}</p>
                {r.verdict && <p className="mt-3 rounded-xl bg-brand-soft p-3 text-sm leading-relaxed"><b>Verdict: </b>{r.verdict}</p>}
              </Section>

              <div className="grid gap-5 md:grid-cols-3">
                <ListCard title="What's good" items={r.pros} icon="✓" tone="text-good" />
                <ListCard title="Watch-outs" items={r.cons} icon="!" tone="text-bad" />
                <ListCard title="Verify" items={r.verify} icon="?" tone="text-warn" />
              </div>

              <Risks r={r} />

              <Section title="Scores">
                <div className="grid gap-3 sm:grid-cols-2">
                  {SCORE_LABELS.filter(([k]) => r.scores[k] != null).map(([k, l]) => {
                    const v = r.scores[k]!;
                    return <Bar key={k} label={l} value={v} max={10} suffix="/10" color={v >= 7 ? "#15803d" : v >= 5 ? "#d97706" : "#dc2626"} />;
                  })}
                </div>
              </Section>

              <Schools r={r} p={p} />
              <FamilyNearby p={p} settings={settings} />

              <Section title="Crime and neighbourhood safety">
                {r.crime.local_rate != null || r.crime.national_rate != null || r.crime.district_rate != null ? (
                  <div className="space-y-3">
                    <div className="text-xs text-muted">{r.crime.unit}</div>
                    {(() => {
                      const vals = [r.crime.local_rate, r.crime.national_rate, r.crime.district_rate].filter((x): x is number => x != null);
                      const max = Math.max(...vals) * 1.15;
                      return (
                        <>
                          {r.crime.local_rate != null && <Bar label="Local neighbourhood" value={r.crime.local_rate} max={max} color="#0f766e" />}
                          {r.crime.national_rate != null && <Bar label="England & Wales" value={r.crime.national_rate} max={max} color="#94a3b8" />}
                          {r.crime.district_rate != null && <Bar label={`Wider ${p.postcode?.split(" ")[0] ?? ""} district`} value={r.crime.district_rate} max={max} color="#d97706" />}
                        </>
                      );
                    })()}
                  </div>
                ) : null}
                <p className="mt-3 text-sm leading-relaxed">
                  <b>Assessment: </b>
                  {r.crime.assessment}
                </p>
                {here && (
                  <a className="mt-2 inline-block text-sm text-brand hover:underline" target="_blank" rel="noreferrer" href={`https://www.police.uk/search/?q=${encodeURIComponent(p.postcode ?? `${p.lat},${p.lng}`)}`}>
                    Recent incidents on police.uk ↗
                  </a>
                )}
              </Section>

              {r.demographics.groups.length > 0 && (
                <Section title="Local community (Census 2021)">
                  <div className="space-y-3">
                    {r.demographics.groups.map((g, i) => (
                      <Bar key={g.label} label={g.label} value={g.percent} max={100} suffix="%" color={DEMO_COLORS[i % DEMO_COLORS.length]} />
                    ))}
                  </div>
                  {r.demographics.notes && <p className="mt-3 text-sm text-muted">{r.demographics.notes}</p>}
                </Section>
              )}

              {(r.transport.length > 0 || r.amenities.length > 0) && (
                <Section title="Transport and nearby facilities">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {r.transport.map((t) => (
                      <div key={t.name} className="flex gap-3 rounded-xl bg-paper p-3 text-sm">
                        <span className="text-lg">{{ rail: "🚆", tube: "🚇", bus: "🚌", road: "🛣", airport: "✈️" }[t.kind] ?? "📍"}</span>
                        <div>
                          <b>{t.name}</b> {t.distance_km != null && <span className="text-muted">· {t.distance_km} km</span>}
                          <div className="text-muted">{t.notes}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {r.amenities.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {r.amenities.map((a) => (
                        <span key={a} className="chip bg-paper text-ink">{a}</span>
                      ))}
                    </div>
                  )}
                </Section>
              )}

              <Section title="Value for money">
                {p.price && r.value.fair_value_low && r.value.fair_value_high && <ValueGauge price={p.price} low={r.value.fair_value_low} high={r.value.fair_value_high} />}
                <p className="text-sm leading-relaxed">{r.value.assessment}</p>
                {r.value.comparables.length > 0 && (
                  <div className="mt-3">
                    <Table head={["Comparable", "Price", "Date", ""]} rows={r.value.comparables.map((c) => [<b key="a">{c.address}</b>, gbp(c.price), c.date, <span key="n" className="text-muted">{c.notes}</span>])} />
                  </div>
                )}
              </Section>

              <Section title="Buying costs">
                <Table
                  head={["Cost", "Estimate"]}
                  rows={[
                    ["Purchase price", gbp(p.price)],
                    [`Stamp duty (${settings?.buyer_type?.replace("_", "-") ?? "standard"} buyer)`, gbp(sdlt)],
                    ["Solicitor, survey & searches", `~${gbp(LEGAL_FEES)}`],
                    ...(r.sale?.extra_fees ? [[`${r.sale.method} fees`, <span key="f" className="font-medium text-bad">{gbp(r.sale.extra_fees)}</span>]] : []),
                    ...(r.refurb.items.length ? r.refurb.items.map((i) => [`↳ ${i.item}`, `${gbpShort(i.low)}–${gbpShort(i.high)}`]) : refurb ? [["Refurb (rule of thumb)", gbp(refurb)]] : []),
                    [<b key="t">Total all-in (midpoint)</b>, <b key="v">{gbp((p.price ?? 0) + sdlt + LEGAL_FEES + refurb + (r.sale?.extra_fees ?? 0))}</b>],
                  ]}
                />
                {r.refurb.notes && <p className="mt-2 text-xs text-muted">{r.refurb.notes}</p>}
                {r.sale?.fee_notes && <p className="mt-2 text-xs text-muted">{r.sale.fee_notes}</p>}
              </Section>

              {(r.action_plan?.length ?? 0) > 0 && (
                <Section title={/auction/i.test(r.sale?.method ?? "") ? "What I would do before bidding" : "What I would do before offering"}>
                  <ol className="space-y-2 text-sm">
                    {r.action_plan.map((s, i) => (
                      <li key={s} className="flex gap-3">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink text-xs font-semibold text-white">{i + 1}</span>
                        <span className="pt-0.5">{s}</span>
                      </li>
                    ))}
                  </ol>
                </Section>
              )}

              {r.questions_for_agent.length > 0 && (
                <Section
                  title="Questions to ask the agent"
                  action={
                    <button className="text-xs text-brand hover:underline" onClick={() => navigator.clipboard.writeText(r.questions_for_agent.map((q) => `• ${q}`).join("\n"))}>
                      Copy all
                    </button>
                  }
                >
                  <ol className="list-decimal space-y-1.5 pl-5 text-sm">
                    {r.questions_for_agent.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ol>
                </Section>
              )}

              {r.sources.length > 0 && (
                <Section title="Sources">
                  <div className="flex flex-wrap gap-1.5">
                    {r.sources.map((s) => (
                      <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="chip bg-paper text-ink hover:bg-brand-soft">
                        {s.title || new URL(s.url).host} ↗
                      </a>
                    ))}
                  </div>
                  {r.analysed_at && <p className="mt-2 text-xs text-muted">Researched {new Date(r.analysed_at).toLocaleString("en-GB")} · AI can be wrong, check the important facts.</p>}
                </Section>
              )}
            </>
          )}
        </div>

        {/* Right: map + edit */}
        <div className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          <div className="card p-3">
            {here ? (
              <MapView properties={[p]} settings={settings} selectedId={p.id} routes={routes} className="h-[340px]" fitTo="selected" />
            ) : (
              <p className="p-4 text-sm text-muted">No location found. Add a postcode below and save.</p>
            )}
            {here && (
              <div className="mt-3 grid gap-2 text-sm">
                {from.map((o) => {
                  const route = routes.find((x) => x.kind === o.kind);
                  // Offices: directions from the house (the morning commute). Home: from your current home.
                  const [a, b] = o.kind === "home" ? [o.ll, here] : [here, o.ll];
                  return (
                    <div key={o.kind} className="flex items-center gap-2 rounded-xl bg-paper px-3 py-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: ORIGINS[o.kind].color }} />
                      <span className="font-medium">
                        {ORIGINS[o.kind].emoji} {o.kind === "home" ? "From home" : `To ${ORIGINS[o.kind].name.toLowerCase()}`}
                      </span>
                      <span className="tabular-nums text-muted">{route ? `${route.mins} min · ${route.km} km` : "…"}</span>
                      <span className="ml-auto flex gap-2 text-xs">
                        <a className="text-brand hover:underline" target="_blank" rel="noreferrer" href={gmapsDirections(a, b, "driving")}>
                          Drive ↗
                        </a>
                        <a className="text-brand hover:underline" target="_blank" rel="noreferrer" href={gmapsDirections(a, b, "transit")}>
                          Train/bus ↗
                        </a>
                      </span>
                    </div>
                  );
                })}
                {!from.length && (
                  <Link href="/settings" className="text-brand hover:underline">
                    Set home & office for routes →
                  </Link>
                )}
                <a className="text-xs text-brand hover:underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${p.lat},${p.lng}`}>
                  Street View ↗
                </a>
              </div>
            )}
          </div>

          <EditForm p={p} />
        </div>
      </div>
    </div>
  );
}

function EditForm({ p }: { p: Property }) {
  const [saved, setSaved] = useState(false);
  const [rating, setRating] = useState(p.my_rating);
  const field = (name: keyof Property, label: string, type = "text") => (
    <label>
      <span className="label">{label}</span>
      <input className="input" name={name} type={type} step="any" defaultValue={(p[name] as string | number | null) ?? ""} />
    </label>
  );
  return (
    <form
      action={async (fd) => {
        fd.set("my_rating", rating ? String(rating) : "");
        await updateProperty(p.id, fd);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }}
      className="card space-y-3 p-4"
    >
      <div className="flex items-center justify-between">
        <div className="h2">My notes & details</div>
        <Stars value={rating} onChange={setRating} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className="label">Status</span>
          <select name="status" className="input capitalize" defaultValue={p.status}>
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Condition</span>
          <select name="decor_state" className="input" defaultValue={p.decor_state ?? ""}>
            <option value="">—</option>
            {DECOR.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex gap-4 text-sm">
        <input type="hidden" name="has_checkboxes" value="1" />
        <label className="flex items-center gap-2">
          <input type="checkbox" name="needs_kitchen" defaultChecked={p.needs_kitchen} className="accent-brand" /> Needs new kitchen
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="needs_bathroom" defaultChecked={p.needs_bathroom} className="accent-brand" /> Needs new bathroom
        </label>
      </div>
      <label className="block">
        <span className="label">Notes</span>
        <textarea name="notes" className="input h-24" defaultValue={p.notes ?? ""} placeholder="Viewing notes, gut feeling, agent said…" />
      </label>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted">Edit title, address, postcode & price</summary>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {field("title", "Title")}
          {field("address", "Address")}
          {field("postcode", "Postcode (moves the map pin)")}
          {field("price", "Price £", "number")}
        </div>
      </details>
      <div className="flex items-center gap-2 pt-1">
        <button className="btn-primary">Save</button>
        {saved && <span className="text-sm text-good">Saved ✓</span>}
        <button
          type="button"
          className="ml-auto text-sm text-bad hover:underline"
          onClick={() => confirm("Delete this property? This can't be undone.") && deleteProperty(p.id)}
        >
          Delete
        </button>
      </div>
    </form>
  );
}

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="h2">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function ListCard({ title, items, icon, tone }: { title: string; items: string[]; icon: string; tone: string }) {
  if (!items.length) return null;
  return (
    <div className="card p-4">
      <div className="h2 mb-2">{title}</div>
      <ul className="space-y-1.5 text-sm">
        {items.map((i) => (
          <li key={i} className="flex gap-2">
            <span className={`font-bold ${tone}`}>{icon}</span>
            <span>{i}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line">
            {head.map((h, i) => (
              <th key={i} className={`py-2 text-xs font-medium text-muted ${i === head.length - 1 && head.length === 2 ? "text-right" : "text-left"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line last:border-0">
              {r.map((c, j) => (
                <td key={j} className={`py-2 pr-3 align-top ${j === r.length - 1 && r.length === 2 ? "text-right tabular-nums" : ""}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RatingChip({ rating }: { rating: string }) {
  const cls = /outstanding/i.test(rating) ? "bg-emerald-50 text-emerald-700" : /good/i.test(rating) ? "bg-lime-50 text-lime-700" : /requires|inadequate/i.test(rating) ? "bg-red-50 text-red-700" : "bg-gray-100 text-gray-600";
  return <span className={`chip ${cls}`}>{rating}</span>;
}

function ValueGauge({ price, low, high }: { price: number; low: number; high: number }) {
  const min = Math.min(low, price) * 0.95;
  const max = Math.max(high, price) * 1.05;
  const pos = (v: number) => `${((v - min) / (max - min)) * 100}%`;
  const verdict = price < low ? ["Below fair value", "text-good"] : price > high ? ["Above fair value", "text-bad"] : ["Within fair range", "text-ink"];
  return (
    <div className="mb-4">
      <div className="relative h-3 rounded-full bg-paper">
        <div className="absolute h-3 rounded-full bg-brand/25" style={{ left: pos(low), width: `calc(${pos(high)} - ${pos(low)})` }} />
        <div className="absolute -top-1 h-5 w-1 rounded bg-ink" style={{ left: pos(price) }} />
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-muted">
        <span>{gbpShort(low)}</span>
        <span className={`font-medium ${verdict[1]}`}>
          Asking {gbpShort(price)} · {verdict[0]}
        </span>
        <span>{gbpShort(high)}</span>
      </div>
    </div>
  );
}


const SEV: Record<string, string> = {
  high: "border-red-200 bg-red-50 text-red-800",
  medium: "border-amber-200 bg-amber-50 text-amber-800",
  low: "border-line bg-paper text-ink",
};
const SEV_ORDER = { high: 0, medium: 1, low: 2 } as const;

function Alerts({ p }: { p: Property }) {
  const r = p.ai;
  const flags = [...(r?.red_flags ?? [])].sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);
  const noisy = noisyNeighbours(p.nearby);
  if (!flags.length && !noisy.length && !r?.discrepancies?.length && r?.construction?.standard !== false) return null;
  return (
    <section className="card overflow-hidden border-red-200">
      <div className="flex flex-wrap items-center gap-2 border-b border-red-100 bg-red-50/60 px-5 py-3">
        <span className="text-lg">🚩</span>
        <h2 className="h2 text-red-900">Red alerts</h2>
        {r?.sale?.method && <span className={`chip ${/private/i.test(r.sale.method) ? "bg-paper text-ink" : "bg-red-100 text-red-800"}`}>{r.sale.method}</span>}
        {r?.construction?.type && <span className={`chip ${r.construction.standard ? "bg-paper text-ink" : "bg-red-100 text-red-800"}`}>{r.construction.standard ? "Standard construction" : `Non-standard: ${r.construction.type}`}</span>}
      </div>
      <div className="grid gap-2 p-4 md:grid-cols-2">
        {flags.map((f) => (
          <div key={f.title} className={`rounded-xl border p-3 text-sm ${SEV[f.severity]}`}>
            <div className="flex items-center gap-2 font-semibold">
              <span className="text-[10px] uppercase tracking-wide opacity-70">{f.severity}</span> {f.title}
            </div>
            <p className="mt-1 opacity-90">{f.detail}</p>
          </div>
        ))}
        {r?.construction && !r.construction.standard && r.construction.mortgage_notes && (
          <div className={`rounded-xl border p-3 text-sm ${SEV.high}`}>
            <div className="font-semibold">Mortgageability</div>
            <p className="mt-1 opacity-90">{r.construction.mortgage_notes}</p>
          </div>
        )}
        {noisy.length > 0 && (
          <div className={`rounded-xl border p-3 text-sm ${SEV.medium}`}>
            <div className="font-semibold">Possible noise next door</div>
            <p className="mt-1 opacity-90">{noisy.map((n) => `${CATS[n.cat].emoji} ${n.name} (${n.m} m)`).join(" · ")}</p>
          </div>
        )}
        {(r?.discrepancies?.length ?? 0) > 0 && (
          <div className={`rounded-xl border p-3 text-sm md:col-span-2 ${SEV.medium}`}>
            <div className="font-semibold">Listing contradicts itself</div>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 opacity-90">
              {r!.discrepancies.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

const LEVEL: Record<string, string> = { low: "bg-emerald-50 text-emerald-700", medium: "bg-amber-50 text-amber-700", high: "bg-red-50 text-red-700" };

function Risks({ r }: { r: Report }) {
  if (!r.risks?.length) return null;
  return (
    <Section title="My assessment of the risks">
      <Table
        head={["Area", "Risk", "Assessment"]}
        rows={r.risks.map((x) => [<b key="a">{x.area}</b>, <span key="l" className={`chip capitalize ${LEVEL[x.level]}`}>{x.level}</span>, <span key="s" className="text-muted">{x.assessment}</span>])}
      />
    </Section>
  );
}

const fmtM = (m: number | null) => (m == null ? "—" : m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);

function Schools({ r, p }: { r: Report; p: Property }) {
  const schools = [...r.schools].sort((a, b) => (a.distance_m ?? 9e9) - (b.distance_m ?? 9e9));
  const counts = [
    ["Schools ≤ 500 m", within(p.nearby, "school", 500)],
    ["Schools ≤ 1 km", within(p.nearby, "school", 1000)],
    ["Nurseries ≤ 1 km", within(p.nearby, "nursery", 1000)],
    ["Outstanding / Good", schools.filter((s) => ofstedRank(s.rating) >= 3).length + ` of ${schools.length}`],
  ] as const;
  if (!schools.length && !p.nearby) return null;
  return (
    <Section title="🎓 Schools nearby">
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {counts.map(([l, v]) => (
          <div key={l} className="rounded-xl bg-paper px-3 py-2">
            <div className="text-[11px] text-muted">{l}</div>
            <div className="text-lg font-semibold tabular-nums">{p.nearby || !l.includes("≤") ? v : "—"}</div>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {schools.map((s) => (
          <div key={s.name} className="rounded-xl border border-line p-3">
            <div className="flex flex-wrap items-center gap-2">
              <b>{s.name}</b>
              <RatingChip rating={s.rating} />
              {s.phase && <span className="chip bg-paper capitalize text-ink">{s.phase}</span>}
              {s.type && <span className="chip bg-paper text-muted">{s.type}</span>}
              <span className="ml-auto text-sm tabular-nums text-muted">{fmtM(s.distance_m)}</span>
            </div>
            {(s.history?.length ?? 0) > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1 text-xs">
                <span className="text-muted">Ofsted history:</span>
                {s.last_inspected && <RatingChip rating={`${s.rating.split(/[(,]/)[0].trim()} · ${s.last_inspected}`} />}
                {s.history.map((h, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <span className="text-muted">←</span>
                    <RatingChip rating={`${h.rating} · ${h.year}`} />
                  </span>
                ))}
              </div>
            )}
            {s.catchment && (
              <p className="mt-2 text-sm">
                <span className="text-muted">Admissions: </span>
                {s.catchment}
              </p>
            )}
            {s.notes && <p className="mt-1 text-sm text-muted">{s.notes}</p>}
            <a className="mt-1 inline-block text-xs text-brand hover:underline" target="_blank" rel="noreferrer" href={`https://reports.ofsted.gov.uk/search?q=${encodeURIComponent(s.name)}`}>
              Ofsted reports ↗
            </a>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">
        Admission depends on catchment, available places and each school&apos;s criteria. Check your council&apos;s admissions pages before relying on a place.
      </p>
    </Section>
  );
}

const GROUPS = ["Kids", "Daily life", "Getting around", "Nightlife & noise"] as const;

function FamilyNearby({ p, settings }: { p: Property; settings: Settings | null }) {
  const r = p.ai;
  const [show, setShow] = useState<Set<Place["cat"]>>(new Set(["school", "nursery", "playground", "park", "pub"]));
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const toggle = (c: Place["cat"]) => setShow((s) => (s.has(c) ? (s.delete(c), new Set(s)) : new Set(s.add(c))));
  const places = (p.nearby?.places ?? []).filter((x) => show.has(x.cat) && x.m <= 1500);

  return (
    <Section
      title="👨‍👩‍👧 Family life & nearby"
      action={
        p.lat && (
          <button
            className="text-xs text-brand hover:underline disabled:opacity-50"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              setMsg(await refreshNearby(p.id));
              setLoading(false);
            }}
          >
            {loading ? "Loading…" : p.nearby ? "↻ Refresh places" : "Load nearby places"}
          </button>
        )
      }
    >
      {r?.family && (
        <div className="mb-4 space-y-2 text-sm leading-relaxed">
          <p>{r.family.summary}</p>
          {r.family.childcare && (
            <p>
              <b>Childcare: </b>
              {r.family.childcare}
            </p>
          )}
          {r.family.play_and_parks && (
            <p>
              <b>Play & parks: </b>
              {r.family.play_and_parks}
            </p>
          )}
        </div>
      )}
      {msg && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-warn">{msg}</p>}

      {p.nearby ? (
        <>
          <div className="space-y-3">
            {GROUPS.map((g) => (
              <div key={g}>
                <div className="mb-1.5 text-xs font-medium text-muted">{g}</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {(Object.keys(CATS) as Place["cat"][])
                    .filter((c) => CATS[c].group === g)
                    .map((c) => {
                      const n = nearest(p.nearby, c);
                      const count = within(p.nearby, c, 1000);
                      const warn = g === "Nightlife & noise" && n && n.m <= 200;
                      return (
                        <button
                          key={c}
                          onClick={() => toggle(c)}
                          className={`rounded-xl border px-3 py-2 text-left text-sm transition ${show.has(c) ? "border-brand bg-brand-soft" : "border-line bg-card hover:bg-paper"} ${warn ? "!border-red-300 !bg-red-50" : ""}`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span>{CATS[c].emoji}</span>
                            <b>{count}</b>
                            <span className="text-muted">{CATS[c].label.toLowerCase()} ≤1 km</span>
                          </div>
                          <div className="truncate text-xs text-muted">{n ? `Nearest: ${n.name} · ${n.m} m` : "None within 1.5 km"}</div>
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <MapView properties={[p]} settings={settings} selectedId={p.id} places={places} className="h-[380px]" fitTo="local" />
            <p className="mt-1 text-xs text-muted">Tap the tiles above to show or hide them on the map. Dashed rings are 500 m and 1 km walks. Data: OpenStreetMap.</p>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted">{p.lat ? "Nearby places haven't been loaded yet." : "Add a postcode to load nearby places."}</p>
      )}

      {(r?.places?.length ?? 0) > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {r!.places.map((x) => (
            <div key={x.name} className={`rounded-xl p-3 text-sm ${/pub|bar|takeaway|night/i.test(x.kind) ? "bg-amber-50" : "bg-paper"}`}>
              <b>{x.name}</b> <span className="text-muted">· {x.kind}{x.distance_m != null ? ` · ${fmtM(x.distance_m)}` : ""}</span>
              {x.notes && <div className="text-muted">{x.notes}</div>}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}


const FACT_OPTIONS: Partial<Record<FactField, readonly string[]>> = {
  parking: PARKING,
  tenure: ["freehold", "leasehold", "share of freehold", "commonhold"],
  council_tax_band: ["A", "B", "C", "D", "E", "F", "G", "H"],
  epc_rating: ["A", "B", "C", "D", "E", "F", "G"],
};

/** A fact tile you can click to edit. Enter or click away saves, Esc cancels. */
function Fact({ id, field, label, value, shown }: { id: string; field: FactField; label: string; value: string | number | null | undefined; shown?: string | number }) {
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement & HTMLSelectElement>(null);
  const options = FACT_OPTIONS[field];
  const empty = value == null || value === "";

  const save = (raw: string) => {
    setEditing(false);
    if (raw.trim() === String(value ?? "")) return;
    start(async () => setErr(await updateField(id, field, raw)));
  };
  const keys = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (e.key === "Enter") save(e.currentTarget.value);
    if (e.key === "Escape") setEditing(false);
  };

  return (
    <div
      className={`card group relative cursor-text px-3 py-2 transition hover:border-brand ${err ? "border-red-300" : ""} ${pending ? "opacity-60" : ""}`}
      onClick={() => !editing && (setEditing(true), setTimeout(() => input.current?.focus(), 0))}
    >
      <div className="flex items-center text-[11px] text-muted">
        {label}
        <span className="ml-auto opacity-0 transition group-hover:opacity-100">✎</span>
      </div>
      {editing ? (
        options ? (
          <select ref={input} className="w-full bg-transparent text-sm font-medium outline-none" defaultValue={String(value ?? "")} onBlur={(e) => save(e.target.value)} onChange={(e) => save(e.target.value)} onKeyDown={keys}>
            <option value="">—</option>
            {options.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        ) : (
          <input
            ref={input}
            type={field === "listed_date" ? "date" : "text"}
            className="w-full bg-transparent text-sm font-medium outline-none"
            defaultValue={String(value ?? "")}
            placeholder={field === "size_sqft" ? "e.g. 990 or 92 sq m" : ""}
            onBlur={(e) => save(e.target.value)}
            onKeyDown={keys}
          />
        )
      ) : (
        <div className={`truncate text-sm font-medium ${empty ? "text-brand" : ""}`} title={String(shown ?? value ?? "")}>
          {empty ? "+ Add" : (shown ?? value)}
        </div>
      )}
      {err && <div className="text-[11px] text-bad">{err}</div>}
    </div>
  );
}

/** Photo gallery, plus a box to paste photo links when the listing site blocks us (Zoopla). */
function Photos({ id, images }: { id: string; images: string[] }) {
  const [img, setImg] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const shown = img && images.includes(img) ? img : images[0];

  const save = (form: FormData) =>
    start(async () => {
      const e = await setPhotos(id, String(form.get("links") ?? ""));
      setErr(e);
      if (!e) setOpen(false);
    });

  return (
    <div className="card overflow-hidden">
      {shown && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shown} alt="" className="aspect-[16/9] w-full object-cover" referrerPolicy="no-referrer" />
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto p-2">
              {images.map((u) => (
                <button key={u} onClick={() => setImg(u)} className={`shrink-0 overflow-hidden rounded-lg ${u === shown ? "ring-2 ring-brand" : "opacity-80 hover:opacity-100"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="" className="h-16 w-24 object-cover" referrerPolicy="no-referrer" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </>
      )}
      <div className="px-3 py-2 text-sm">
        {!open ? (
          <button className="text-brand hover:underline" onClick={() => setOpen(true)}>
            {images.length ? "✎ Edit photos" : "📷 No photos — add them"}
          </button>
        ) : (
          <form action={save} className="space-y-2">
            <p className="text-xs text-muted">
              On the listing, right-click each photo → <b>Copy image address</b>, then paste here, one per line. The first is the cover photo. Delete a line to remove a photo.
            </p>
            <textarea name="links" className="input h-32 font-mono text-xs" defaultValue={images.join("\n")} placeholder="https://lid.zoocdn.com/u/1024/768/….jpg" autoFocus />
            <div className="flex items-center gap-2">
              <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save photos"}</button>
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              {err && <span className="text-xs text-bad">{err}</span>}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
