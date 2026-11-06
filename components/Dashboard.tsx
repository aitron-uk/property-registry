"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import type { Property, Settings } from "@/lib/types";
import { STATUSES } from "@/lib/types";
import { ORIGINS, allInCost, gbp, gbpShort, haversineKm, median, origins, refurbEstimate, stampDuty, areaOf, type Kind } from "@/lib/calc";
import { driveRoute, driveTable, type Drive } from "@/lib/osrm";
import { quickUpdate } from "@/app/actions";
import { alertCount, bestSchool, noisyNeighbours, ofstedLabel, ofstedRank, within } from "@/lib/places";
import AddBar from "./AddBar";
import type { Route } from "./MapView";
import { DecorChip, Flag, Score, Stars, Stat, StatusChip } from "./ui";

const MapView = dynamic(() => import("./MapView"), { ssr: false, loading: () => <div className="h-full animate-pulse rounded-2xl bg-line/50" /> });

type Row = Property & {
  refurb: number;
  allIn: number | null;
  sdlt: number | null;
  home: Drive | null;
  office: Drive | null;
  office2: Drive | null;
  homeKm: number | null;
  officeKm: number | null;
  office2Km: number | null;
  both: number | null; // combined minutes to both offices
};
type SortKey = "score" | "price" | "ppsf" | "allIn" | "office" | "office2" | "both" | "home" | "station" | "newest" | "rating" | "size" | "schools" | "alerts";

const SORTS: [SortKey, string][] = [
  ["score", "AI score"],
  ["schools", "Schools"],
  ["alerts", "Fewest red alerts"],
  ["ppsf", "£ / sq ft"],
  ["price", "Price"],
  ["allIn", "All-in cost"],
  ["size", "Size"],
  ["both", "Both commutes"],
  ["office", "Drive to my office"],
  ["office2", "Drive to wife's office"],
  ["home", "Drive to home"],
  ["station", "Station distance"],
  ["rating", "My rating"],
  ["newest", "Newest"],
];

const sortVal = (r: Row, k: SortKey): number | null =>
  ({
    score: r.ai_score == null ? null : -r.ai_score,
    price: r.price,
    ppsf: r.price_per_sqft,
    allIn: r.allIn,
    size: r.size_sqft == null ? null : -r.size_sqft,
    office: r.office?.mins ?? null,
    office2: r.office2?.mins ?? null,
    both: r.both,
    home: r.home?.mins ?? null,
    station: r.station_distance_km,
    rating: r.my_rating == null ? null : -r.my_rating,
    newest: -new Date(r.created_at).getTime(),
    schools: -(ofstedRank(bestSchool(r.ai, 1000)?.rating ?? "") * 100 + within(r.nearby, "school", 1000) * 5 + (r.ai?.scores?.schools ?? 0)),
    alerts: alertCount(r),
  })[k];

export default function Dashboard({ properties, settings }: { properties: Property[]; settings: Settings | null }) {
  const from = origins(settings);
  const ll = (k: Kind) => from.find((o) => o.kind === k)?.ll ?? null;
  const hasOffice2 = !!ll("office2");

  const [drives, setDrives] = useState<Record<string, Partial<Record<Kind, Drive | null>>>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [view, setView] = useState<"cards" | "table">("cards");
  const [sort, setSort] = useState<SortKey>("score");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("active");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [beds, setBeds] = useState<string>("");
  const [, startTransition] = useTransition();

  // One OSRM request for all drive times from home and both offices.
  const placed = properties.filter((p) => p.lat && p.lng);
  const placedKey = placed.map((p) => p.id + p.lat + p.lng).join() + JSON.stringify(from);
  useEffect(() => {
    if (!from.length || !placed.length) return;
    driveTable(from.map((o) => o.ll), placed.map((p) => [p.lat!, p.lng!]))
      .then((t) => {
        const out: typeof drives = {};
        placed.forEach((p, j) => {
          out[p.id] = Object.fromEntries(from.map((o, i) => [o.kind, t[i]?.[j] ?? null]));
        });
        setDrives(out);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placedKey]);

  // Select a property and draw its driving routes from home and the offices.
  function select(id: string) {
    setSelected(id);
    const p = properties.find((x) => x.id === id);
    if (!p?.lat) return setRoutes([]);
    const to: [number, number] = [p.lat, p.lng!];
    Promise.all(from.map((o) => driveRoute(o.ll, to).then((r) => r && { ...r, kind: o.kind }))).then((rs) => setRoutes(rs.filter(Boolean) as Route[]));
  }

  const rows: Row[] = properties.map((p) => {
        const here: [number, number] | null = p.lat ? [p.lat, p.lng!] : null;
        const km = (k: Kind) => (here && ll(k) ? Math.round(haversineKm(here, ll(k)!) * 10) / 10 : null);
        const d = drives[p.id] ?? {};
        const offices = [d.office?.mins, d.office2?.mins].filter((x): x is number => x != null);
        return {
          ...p,
          refurb: refurbEstimate(p),
          allIn: allInCost(p, settings),
          sdlt: p.price ? stampDuty(p.price, settings?.buyer_type) : null,
          home: d.home ?? null,
          office: d.office ?? null,
          office2: d.office2 ?? null,
          homeKm: km("home"),
          officeKm: km("office"),
          office2Km: km("office2"),
          both: offices.length ? offices.reduce((a, b) => a + b, 0) : null,
        };
      });

  const needle = q.toLowerCase();
  const visible = rows
      .filter((r) => (status === "all" ? true : status === "active" ? r.status !== "rejected" : r.status === status))
      .filter((r) => !maxPrice || (r.price ?? 0) <= Number(maxPrice))
      .filter((r) => !beds || (r.bedrooms ?? 0) >= Number(beds))
      .filter((r) => !needle || [r.title, r.address, r.postcode, r.notes, r.agent].join(" ").toLowerCase().includes(needle))
      .sort((a, b) => (sortVal(a, sort) ?? Infinity) - (sortVal(b, sort) ?? Infinity));

  const active = rows.filter((r) => r.status !== "rejected");
  const ppsfs = active.map((r) => r.price_per_sqft).filter((x): x is number => x != null);
  const medPpsf = median(ppsfs);
  const insights = buildInsights(active, medPpsf, settings);

  const setStatusFor = (id: string, s: string) => startTransition(() => quickUpdate(id, { status: s }));
  const setRating = (id: string, v: number | null) => startTransition(() => quickUpdate(id, { my_rating: v }));

  return (
    <div className="space-y-5">
      <AddBar />

      {!from.length && (
        <Link href="/settings" className="card flex items-center gap-3 border-dashed p-4 text-sm hover:bg-brand-soft">
          <span className="text-xl">📍</span>
          <span>
            <b>Set your home & office</b> to see drive times, routes and commute rankings for every property.
          </span>
          <span className="ml-auto text-brand">Settings →</span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Tracking" value={active.length} hint={`${rows.length - active.length} rejected · ${rows.filter((r) => r.status === "viewing").length} viewings`} />
        <Stat label="Median price" value={gbpShort(median(active.map((r) => r.price).filter((x): x is number => x != null)))} hint={settings?.budget_max ? `Budget ${gbpShort(settings.budget_min)}–${gbpShort(settings.budget_max)}` : "Set a budget in Settings"} />
        <Stat label="Median £ / sq ft" value={medPpsf ? gbp(medPpsf) : "—"} hint={ppsfs.length ? `Range ${gbp(Math.min(...ppsfs))}–${gbp(Math.max(...ppsfs))}` : "Needs sizes"} />
        <Stat label="Avg size" value={avg(active.map((r) => r.size_sqft)) ? `${avg(active.map((r) => r.size_sqft))} ft²` : "—"} hint={`${avg(active.map((r) => r.bedrooms)) ?? "—"} beds on average`} />
        <CommuteStat rows={active} loading={from.length > 0 && placed.length > 0 && !Object.keys(drives).length} both={hasOffice2} />
        <Stat label="Avg AI score" value={avg(active.map((r) => r.ai_score)) ?? "—"} hint={`${active.filter((r) => (r.ai_score ?? 0) >= 70).length} strong contenders (70+)`} />
      </div>

      {insights.length > 0 && (
        <div className="card p-4">
          <div className="h2 mb-3">✦ Insights</div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {insights.map((i, k) => (
              <button key={k} onClick={() => i.id && select(i.id)} className="flex gap-3 rounded-xl bg-paper p-3 text-left text-sm hover:bg-brand-soft">
                <span className="text-lg">{i.icon}</span>
                <span>{i.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input className="input h-9 w-56" placeholder="Search address, notes, agent…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input h-9 w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="active">Active (not rejected)</option>
          <option value="all">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s} className="capitalize">
              {s}
            </option>
          ))}
        </select>
        <input className="input h-9 w-36" type="number" placeholder="Max price £" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
        <select className="input h-9 w-auto" value={beds} onChange={(e) => setBeds(e.target.value)}>
          <option value="">Any beds</option>
          {[1, 2, 3, 4, 5].map((b) => (
            <option key={b} value={b}>
              {b}+ beds
            </option>
          ))}
        </select>
        <select className="input h-9 w-auto" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          {SORTS.map(([k, l]) => (
            <option key={k} value={k}>
              Sort: {l}
            </option>
          ))}
        </select>
        <div className="ml-auto flex gap-2">
          <div className="flex rounded-xl border border-line bg-card p-0.5 text-sm">
            {(["cards", "table"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={`rounded-lg px-3 py-1 capitalize ${view === v ? "bg-ink text-white" : ""}`}>
                {v === "table" ? "Datasheet" : "Cards"}
              </button>
            ))}
          </div>
          <button className="btn-ghost h-9 py-0" onClick={() => downloadCsv(visible)}>
            ⇩ CSV
          </button>
        </div>
      </div>

      {properties.length === 0 ? (
        <Empty />
      ) : view === "cards" ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="lg:sticky lg:top-20 lg:self-start">
            <MapView properties={visible} settings={settings} selectedId={selected} onSelect={select} routes={routes} className="h-[420px] lg:h-[calc(100vh-7rem)]" fitTo="all" />
            <RouteLegend routes={routes} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {visible.map((r) => (
              <Card key={r.id} r={r} medPpsf={medPpsf} selected={selected === r.id} onSelect={() => select(r.id)} onRate={(v) => setRating(r.id, v)} />
            ))}
            {!visible.length && <p className="text-sm text-muted">No properties match these filters.</p>}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <MapView properties={visible} settings={settings} selectedId={selected} onSelect={select} routes={routes} className="h-[380px]" fitTo="all" />
          <RouteLegend routes={routes} />
          <Datasheet rows={visible} hasOffice2={hasOffice2} medPpsf={medPpsf} selected={selected} onSelect={select} onStatus={setStatusFor} onRate={setRating} />
        </div>
      )}
    </div>
  );
}

function RouteLegend({ routes }: { routes: Route[] }) {
  if (!routes.length) return <p className="mt-2 text-xs text-muted">Click a pin or card to draw driving routes from home and the offices.</p>;
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {routes.map((r) => (
        <span key={r.kind} className="flex items-center gap-1.5">
          <span className="h-1 w-5 rounded" style={{ background: ORIGINS[r.kind].color }} />
          {ORIGINS[r.kind].name}: <b>{r.mins} min</b> · {r.km} km drive
        </span>
      ))}
    </div>
  );
}

function PpsfTag({ v, med }: { v: number | null; med: number | null }) {
  if (v == null) return <span className="text-muted">—</span>;
  const diff = med ? Math.round(((v - med) / med) * 100) : 0;
  const cls = diff <= -8 ? "text-good" : diff >= 8 ? "text-bad" : "text-ink";
  return (
    <span className={`font-medium tabular-nums ${cls}`} title={med ? `${diff > 0 ? "+" : ""}${diff}% vs your median` : ""}>
      {gbp(v)}
      {med && Math.abs(diff) >= 8 && <span className="ml-1 text-[10px]">{diff > 0 ? "▲" : "▼"}{Math.abs(diff)}%</span>}
    </span>
  );
}

function Card({ r, medPpsf, selected, onSelect, onRate }: { r: Row; medPpsf: number | null; selected: boolean; onSelect: () => void; onRate: (v: number | null) => void }) {
  return (
    <div onClick={onSelect} className={`card group cursor-pointer overflow-hidden transition hover:shadow-md ${selected ? "ring-2 ring-brand" : ""} ${r.status === "rejected" ? "opacity-60" : ""}`}>
      <div className="relative aspect-[16/10] bg-paper">
        {r.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.image_url} alt="" className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <div className="grid h-full place-items-center bg-gradient-to-br from-brand-soft to-paper text-5xl opacity-70">🏡</div>
        )}
        <div className="absolute left-3 top-3 flex gap-1.5">
          <StatusChip status={r.status} />
          <DecorChip state={r.decor_state} />
        </div>
        <div className="absolute right-3 top-3">
          <Score value={r.ai_score} />
        </div>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8 text-white">
          <div className="text-xl font-semibold">{gbp(r.price)}</div>
          <div className="truncate text-sm opacity-90">{r.address ?? r.title}</div>
        </div>
      </div>
      <div className="space-y-2 p-3 text-sm">
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-muted">
          <span>🛏 {r.bedrooms ?? "?"}</span>
          <span>🛁 {r.bathrooms ?? "?"}</span>
          <span>📐 {r.size_sqft ? `${r.size_sqft} ft²` : "size ?"}</span>
          <span>🚗 {r.parking ?? "parking ?"}</span>
        </div>
        <div className={`grid ${r.office2 || r.office2Km != null ? "grid-cols-4" : "grid-cols-3"} gap-2 rounded-xl bg-paper p-2 text-center text-xs`}>
          <div>
            <div className="text-muted">£/ft²</div>
            <PpsfTag v={r.price_per_sqft} med={medPpsf} />
          </div>
          <div>
            <div className="text-muted">{r.office2 || r.office2Km != null ? "My office" : "Office"}</div>
            <b className="tabular-nums">{r.office ? `${r.office.mins}m` : r.officeKm != null ? `${r.officeKm}km` : "—"}</b>
          </div>
          {(r.office2 || r.office2Km != null) && (
            <div>
              <div className="text-muted">Wife</div>
              <b className="tabular-nums">{r.office2 ? `${r.office2.mins}m` : `${r.office2Km}km`}</b>
            </div>
          )}
          <div>
            <div className="text-muted">Station</div>
            <b className="tabular-nums">{r.station_distance_km != null ? `${r.station_distance_km}km` : "—"}</b>
          </div>
        </div>
        <SchoolLine r={r} />
        <div className="flex flex-wrap items-center gap-1.5">
          {alertCount(r) > 0 && <span className="chip bg-red-600 text-white">🚩 {alertCount(r)} red {alertCount(r) === 1 ? "alert" : "alerts"}</span>}
          <Flag on={r.needs_kitchen}>New kitchen</Flag>
          <Flag on={r.needs_bathroom}>New bathroom</Flag>
          {r.refurb > 0 && <span className="chip bg-amber-50 text-amber-700">~{gbpShort(r.refurb)} work</span>}
          <span className="ml-auto">
            <Stars value={r.my_rating} onChange={onRate} />
          </span>
        </div>
        {r.ai?.verdict && <p className="line-clamp-2 text-xs text-muted">{r.ai.verdict}</p>}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted">All-in ≈ <b className="text-ink">{gbpShort(r.allIn)}</b></span>
          <Link href={`/p/${r.id}`} onClick={(e) => e.stopPropagation()} className="text-sm font-medium text-brand hover:underline">
            Full report →
          </Link>
        </div>
      </div>
    </div>
  );
}

function Datasheet({ rows, hasOffice2, medPpsf, selected, onSelect, onStatus, onRate }: { rows: Row[]; hasOffice2: boolean; medPpsf: number | null; selected: string | null; onSelect: (id: string) => void; onStatus: (id: string, s: string) => void; onRate: (id: string, v: number | null) => void }) {
  const th = "px-3 py-2 text-left text-xs font-medium text-muted whitespace-nowrap";
  const td = "px-3 py-2 whitespace-nowrap tabular-nums";
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-line bg-paper/60">
          <tr>
            {["", "Property", "Area", "Price", "Size", "£/ft²", "Beds", "Baths", "Parking", "Station", "Condition", "New kitchen?", "New bathroom?", "Schools ≤1km", "Best school", "Pubs ≤300m", "Alerts", "Refurb", "Stamp duty", "All-in", "Home", hasOffice2 ? "My office" : "Office", ...(hasOffice2 ? ["Wife's office", "Both"] : []), "Score", "Status", "Mine", "Link"].map((h, i) => (
              <th key={i} className={`${th} ${i === 1 ? "sticky left-0 z-10 bg-card" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} onClick={() => onSelect(r.id)} className={`cursor-pointer border-b border-line last:border-0 hover:bg-paper ${selected === r.id ? "bg-brand-soft" : ""}`}>
              <td className="py-1.5 pl-3">
                {r.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.image_url} alt="" className="h-10 w-14 rounded-md object-cover" referrerPolicy="no-referrer" />
                )}
              </td>
              <td className={`sticky left-0 z-10 max-w-[260px] px-3 py-2 shadow-[1px_0_0_var(--color-line)] ${selected === r.id ? "bg-brand-soft" : "bg-card"}`}>
                <Link href={`/p/${r.id}`} onClick={(e) => e.stopPropagation()} className="block truncate font-medium hover:text-brand">
                  {r.address ?? r.title}
                </Link>
                <div className="truncate text-xs text-muted">{[r.property_type, r.tenure, r.postcode].filter(Boolean).join(" · ")}</div>
              </td>
              <td className={td}>{areaOf(r.address, r.postcode) ?? "—"}</td>
              <td className={`${td} font-medium`}>{gbp(r.price)}</td>
              <td className={td}>{r.size_sqft ? `${r.size_sqft} ft²` : "—"}</td>
              <td className={td}>
                <PpsfTag v={r.price_per_sqft} med={medPpsf} />
              </td>
              <td className={td}>{r.bedrooms ?? "—"}</td>
              <td className={td}>{r.bathrooms ?? "—"}</td>
              <td className={td}>{r.parking ?? "—"}</td>
              <td className={td}>
                {r.nearest_station || r.station_distance_km != null ? (
                  <>
                    <span className="block max-w-[160px] truncate" title={r.nearest_station ?? ""}>{r.nearest_station ?? "Station"}</span>
                    {r.station_distance_km != null && <span className="text-xs text-muted">{r.station_distance_km} km</span>}
                  </>
                ) : (
                  "—"
                )}
              </td>
              <td className={td}>
                <DecorChip state={r.decor_state} />
              </td>
              <td className={td}>
                <YesNo on={r.needs_kitchen} />
              </td>
              <td className={td}>
                <YesNo on={r.needs_bathroom} />
              </td>
              <td className={td}>{r.nearby ? within(r.nearby, "school", 1000) : "—"}</td>
              <td className={td} title={bestSchool(r.ai, 1000)?.name ?? ""}>
                {bestSchool(r.ai, 1000) ? `${ofstedLabel(bestSchool(r.ai, 1000)!.rating)} · ${bestSchool(r.ai, 1000)!.distance_m} m` : "—"}
              </td>
              <td className={td}>{r.nearby ? within(r.nearby, "pub", 300) : "—"}</td>
              <td className={td}>{alertCount(r) ? <span className="chip bg-red-600 text-white">🚩 {alertCount(r)}</span> : r.ai ? "✓" : "—"}</td>
              <td className={td}>{r.refurb ? gbpShort(r.refurb) : "—"}</td>
              <td className={td}>{gbp(r.sdlt)}</td>
              <td className={`${td} font-medium`}>{gbpShort(r.allIn)}</td>
              <td className={td}>{r.home ? `${r.home.mins} min` : r.homeKm != null ? `${r.homeKm} km` : "—"}</td>
              <td className={td}>{r.office ? `${r.office.mins} min` : r.officeKm != null ? `${r.officeKm} km` : "—"}</td>
              {hasOffice2 && (
                <>
                  <td className={td}>{r.office2 ? `${r.office2.mins} min` : r.office2Km != null ? `${r.office2Km} km` : "—"}</td>
                  <td className={`${td} font-medium`}>{r.both != null ? `${r.both} min` : "—"}</td>
                </>
              )}
              <td className={td}>
                <Score value={r.ai_score} />
              </td>
              <td className={td} onClick={(e) => e.stopPropagation()}>
                <select className="rounded-lg border border-line bg-card px-2 py-1 text-xs capitalize" defaultValue={r.status} onChange={(e) => onStatus(r.id, e.target.value)}>
                  {STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </td>
              <td className={td}>
                <Stars value={r.my_rating} onChange={(v) => onRate(r.id, v)} />
              </td>
              <td className={td}>
                {r.url && (
                  <a href={r.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-brand hover:underline">
                    Listing ↗
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const YesNo = ({ on }: { on: boolean | null }) =>
  on ? <span className="chip bg-amber-50 text-amber-700">Yes</span> : <span className="text-muted">No</span>;

function SchoolLine({ r }: { r: Row }) {
  const b = bestSchool(r.ai, 1500);
  const n = r.nearby ? within(r.nearby, "school", 1000) : null;
  const play = r.nearby ? within(r.nearby, "playground", 1000) + within(r.nearby, "park", 1000) : null;
  if (!b && n == null) return null;
  const rank = b ? ofstedRank(b.rating) : 0;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      {b && (
        <span className={`chip ${rank === 4 ? "bg-emerald-50 text-emerald-700" : rank === 3 ? "bg-lime-50 text-lime-700" : "bg-amber-50 text-amber-700"}`} title={b.name}>
          🎓 {ofstedLabel(b.rating)} · {b.distance_m} m
        </span>
      )}
      {n != null && <span className="text-muted">{n} schools ≤1 km</span>}
      {play != null && <span className="text-muted">🛝 {play} parks/play</span>}
    </div>
  );
}

function CommuteStat({ rows, loading, both }: { rows: Row[]; loading: boolean; both: boolean }) {
  const best = minBy(rows, (r) => (both ? r.both : r.office?.mins));
  if (!best || (both ? best.both == null : !best.office))
    return <Stat label="Best commute" value={loading ? "…" : "—"} hint={both ? "Both offices" : "Drive to office"} />;
  return (
    <Stat
      label={both ? "Best for both commutes" : "Best commute"}
      value={both ? `${best.office?.mins ?? "?"} + ${best.office2?.mins ?? "?"} min` : `${best.office!.mins} min`}
      hint={best.address ?? best.title}
    />
  );
}

function Empty() {
  return (
    <div className="card grid place-items-center gap-2 p-12 text-center">
      <div className="text-4xl">🏡</div>
      <div className="h2">No properties yet</div>
      <p className="max-w-md text-sm text-muted">
        Paste a listing link above. The AI reads the listing, researches schools, crime, community, transport and sold prices, then scores it for you.
      </p>
    </div>
  );
}

// ---------- helpers ----------
function avg(xs: (number | null)[]) {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
}
function minBy<T>(xs: T[], f: (x: T) => number | null | undefined) {
  let best: T | undefined;
  let bv = Infinity;
  for (const x of xs) {
    const v = f(x);
    if (v != null && v < bv) [best, bv] = [x, v];
  }
  return best;
}

function buildInsights(rows: Row[], medPpsf: number | null, s: Settings | null) {
  const out: { icon: string; text: string; id?: string }[] = [];
  const name = (r: Row) => r.address ?? r.title ?? "Untitled";
  const cheap = minBy(rows, (r) => r.price_per_sqft);
  if (cheap?.price_per_sqft && medPpsf && cheap.price_per_sqft < medPpsf)
    out.push({ icon: "💷", id: cheap.id, text: `Best value per sq ft: ${name(cheap)} at ${gbp(cheap.price_per_sqft)}/ft², ${Math.round((1 - cheap.price_per_sqft / medPpsf) * 100)}% below your median.` });
  const top = minBy(rows, (r) => (r.ai_score == null ? null : -r.ai_score));
  if (top?.ai_score) out.push({ icon: "🏆", id: top.id, text: `Highest AI score: ${name(top)} (${top.ai_score}/100). ${top.ai?.verdict?.split(". ")[0] ?? ""}` });
  const commute = minBy(rows, (r) => r.office?.mins);
  if (commute?.office) out.push({ icon: "💼", id: commute.id, text: `Shortest drive to my office: ${name(commute)}, ${commute.office.mins} min (${commute.office.km} km).` });
  const wife = minBy(rows, (r) => r.office2?.mins);
  if (wife?.office2) out.push({ icon: "👩‍💼", id: wife.id, text: `Shortest drive to wife's office: ${name(wife)}, ${wife.office2.mins} min (${wife.office2.km} km).` });
  const both = minBy(rows.filter((r) => r.office && r.office2), (r) => r.both);
  if (both?.office && both.office2)
    out.push({ icon: "🤝", id: both.id, text: `Best for both commutes: ${name(both)}: ${both.office.mins} min for you, ${both.office2.mins} min for your wife.` });
  const big = minBy(rows, (r) => (r.size_sqft == null ? null : -r.size_sqft));
  if (big?.size_sqft) out.push({ icon: "📐", id: big.id, text: `Most space: ${name(big)} with ${big.size_sqft} ft² for ${gbpShort(big.price)}.` });
  const ready = rows.filter((r) => r.decor_state === "move-in ready" && !r.needs_kitchen && !r.needs_bathroom);
  if (ready.length) out.push({ icon: "✨", text: `${ready.length} move-in ready ${ready.length === 1 ? "home" : "homes"} with no kitchen or bathroom work.` });
  const work = minBy(rows, (r) => -r.refurb);
  if (work && work.refurb > 10_000) out.push({ icon: "🛠", id: work.id, text: `Most work needed: ${name(work)}, ~${gbpShort(work.refurb)} of refurb on top of the price.` });
  if (s?.budget_max) {
    const over = rows.filter((r) => (r.allIn ?? 0) > s.budget_max!);
    if (over.length) out.push({ icon: "⚠️", text: `${over.length} ${over.length === 1 ? "property goes" : "properties go"} over your ${gbpShort(s.budget_max)} budget once stamp duty, fees and refurb are added.` });
  }
  const school = minBy(rows, (r) => {
    const b = bestSchool(r.ai, 1000);
    return b ? -(ofstedRank(b.rating) * 10000 - (b.distance_m ?? 0)) : null;
  });
  const best = school && bestSchool(school.ai, 1000);
  if (best) out.push({ icon: "🎓", id: school!.id, text: `Best schools: ${name(school!)} has ${best.name} (${ofstedLabel(best.rating)}) just ${best.distance_m} m away.` });
  const flagged = rows.filter((r) => r.ai?.red_flags?.some((f) => f.severity === "high"));
  if (flagged.length)
    out.push({ icon: "🚩", id: flagged[0].id, text: `${flagged.length} with high-risk red alerts, e.g. ${name(flagged[0])}: ${flagged[0].ai!.red_flags.find((f) => f.severity === "high")!.title}.` });
  const noisy = rows.filter((r) => noisyNeighbours(r.nearby).length);
  if (noisy.length) out.push({ icon: "🍺", id: noisy[0].id, text: `${noisy.length} ${noisy.length === 1 ? "has" : "have"} a pub or takeaway within 150 m (possible noise), e.g. ${name(noisy[0])}.` });
  const noParking = rows.filter((r) => r.parking === "none" || r.parking === "on-street");
  if (noParking.length) out.push({ icon: "🅿️", text: `${noParking.length} ${noParking.length === 1 ? "has" : "have"} no private parking (on-street or none).` });
  return out.slice(0, 12);
}

function downloadCsv(rows: Row[]) {
  const cols: [string, (r: Row) => unknown][] = [
    ["Address", (r) => r.address ?? r.title],
    ["Area", (r) => areaOf(r.address, r.postcode)],
    ["Postcode", (r) => r.postcode],
    ["Price", (r) => r.price],
    ["Size sqft", (r) => r.size_sqft],
    ["£/sqft", (r) => r.price_per_sqft],
    ["Beds", (r) => r.bedrooms],
    ["Baths", (r) => r.bathrooms],
    ["Type", (r) => r.property_type],
    ["Tenure", (r) => r.tenure],
    ["Parking", (r) => r.parking],
    ["Nearest station", (r) => r.nearest_station],
    ["Station km", (r) => r.station_distance_km],
    ["Condition", (r) => r.decor_state],
    ["Needs kitchen", (r) => r.needs_kitchen],
    ["Needs bathroom", (r) => r.needs_bathroom],
    ["Refurb est", (r) => r.refurb],
    ["Stamp duty", (r) => r.sdlt],
    ["All-in", (r) => r.allIn],
    ["Drive home min", (r) => r.home?.mins],
    ["Drive my office min", (r) => r.office?.mins],
    ["Drive wife's office min", (r) => r.office2?.mins],
    ["Schools within 1km", (r) => within(r.nearby, "school", 1000)],
    ["Best school", (r) => bestSchool(r.ai, 1000)?.name],
    ["Best school Ofsted", (r) => bestSchool(r.ai, 1000)?.rating],
    ["Pubs within 300m", (r) => within(r.nearby, "pub", 300)],
    ["Red alerts", (r) => r.ai?.red_flags?.map((f) => `${f.severity}: ${f.title}`).join("; ")],
    ["Sale method", (r) => r.ai?.sale?.method],
    ["Extra fees", (r) => r.ai?.sale?.extra_fees],
    ["AI score", (r) => r.ai_score],
    ["Status", (r) => r.status],
    ["My rating", (r) => r.my_rating],
    ["Notes", (r) => r.notes],
    ["Link", (r) => r.url],
  ];
  const esc = (v: unknown) => (v == null ? "" : `"${String(v).replace(/"/g, '""')}"`);
  const csv = [cols.map((c) => c[0]).join(","), ...rows.map((r) => cols.map(([, f]) => esc(f(r))).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = `properties-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}
