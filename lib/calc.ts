import type { Property, Settings } from "./types";

// The places you commute from/to. Everything that shows drive times loops over this list.
export type Kind = "home" | "office" | "office2";
export const ORIGINS: Record<Kind, { name: string; emoji: string; color: string }> = {
  home: { name: "Home", emoji: "🏠", color: "#0f766e" },
  office: { name: "My office", emoji: "💼", color: "#4f46e5" },
  office2: { name: "Wife's office", emoji: "👩‍💼", color: "#db2777" },
};
export function origins(s: Settings | null) {
  const out: { kind: Kind; ll: [number, number]; label: string }[] = [];
  if (s?.home_lat && s.home_lng) out.push({ kind: "home", ll: [s.home_lat, s.home_lng], label: s.home_label ?? "" });
  if (s?.office_lat && s.office_lng) out.push({ kind: "office", ll: [s.office_lat, s.office_lng], label: s.office_label ?? "" });
  if (s?.office2_lat && s.office2_lng) out.push({ kind: "office2", ll: [s.office2_lat, s.office2_lng], label: s.office2_label ?? "" });
  return out;
}

export const gbp = (n: number | null | undefined) =>
  n == null ? "—" : "£" + Math.round(n).toLocaleString("en-GB");

export const gbpShort = (n: number | null | undefined) =>
  n == null ? "—" : n >= 1e6 ? `£${(n / 1e6).toFixed(2)}m` : `£${Math.round(n / 1000)}k`;

// England & NI SDLT bands from 1 April 2025. ponytail: hardcoded; update if HMRC changes rates.
export function stampDuty(price: number, type: Settings["buyer_type"] = "standard"): number {
  let bands: [number, number][] = [
    [125_000, 0],
    [250_000, 0.02],
    [925_000, 0.05],
    [1_500_000, 0.1],
    [Infinity, 0.12],
  ];
  if (type === "first_time" && price <= 500_000) bands = [[300_000, 0], [500_000, 0.05]];
  const surcharge = type === "additional" ? 0.05 : 0;
  let tax = 0;
  let prev = 0;
  for (const [top, rate] of bands) {
    if (price > prev) tax += (Math.min(price, top) - prev) * (rate + surcharge);
    prev = top;
  }
  return Math.round(tax);
}

// Rough UK refurb midpoints, used when the AI report has no itemised estimate.
// ponytail: fixed national averages; regional pricing would need a lookup.
const DECOR_COST: Record<string, number> = {
  "move-in ready": 0,
  "light refresh": 4_000,
  "needs modernising": 15_000,
  "full renovation": 50_000,
};
export function refurbEstimate(p: Pick<Property, "needs_kitchen" | "needs_bathroom" | "decor_state" | "ai">): number {
  const items = p.ai?.refurb?.items ?? [];
  const has = (re: RegExp) => items.some((i) => re.test(i.item));
  const ai = items.reduce((s, i) => s + (i.low + i.high) / 2, 0);
  // Your own kitchen/bathroom ticks still count if the AI's list missed them.
  const kitchen = p.needs_kitchen && !has(/kitchen/i) ? 18_000 : 0;
  const bathroom = p.needs_bathroom && !has(/bath|shower/i) ? 9_000 : 0;
  const decor = items.length ? 0 : (DECOR_COST[p.decor_state ?? ""] ?? 0);
  return Math.round(ai + kitchen + bathroom + decor);
}

export const LEGAL_FEES = 3_000;

export function allInCost(p: Property, s: Settings | null) {
  if (!p.price) return null;
  return p.price + stampDuty(p.price, s?.buyer_type) + LEGAL_FEES + refurbEstimate(p) + (p.ai?.sale?.extra_fees ?? 0);
}

export function haversineKm(a: [number, number], b: [number, number]) {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export const gmapsDirections = (from: [number, number], to: [number, number], mode: "driving" | "transit" | "walking") =>
  `https://www.google.com/maps/dir/?api=1&origin=${from.join(",")}&destination=${to.join(",")}&travelmode=${mode}`;

// Fields you can edit from the fact tiles, and how to read what you type.
export const FACT_FIELDS = {
  property_type: "text",
  bedrooms: "int",
  bathrooms: "int",
  receptions: "int",
  size_sqft: "size",
  tenure: "text",
  parking: "text",
  garden: "text",
  council_tax_band: "text",
  epc_rating: "text",
  nearest_station: "text",
  station_distance_km: "num",
  agent: "text",
  listed_date: "date",
  flood_risk: "ai", // stored inside the AI report
  broadband: "ai",
} as const;
export type FactField = keyof typeof FACT_FIELDS;

/** Parse a typed value. Returns { value } or { error }. Empty input clears the field. */
export function parseFact(field: FactField, raw: string): { value: string | number | null } | { error: string } {
  const v = raw.trim();
  if (!v) return { value: null };
  const kind = FACT_FIELDS[field];
  if (kind === "text" || kind === "ai") return { value: v.slice(0, 200) };
  if (kind === "date") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return { value: v };
    const m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); // UK dd/mm/yyyy
    return m ? { value: `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` } : { error: "Use a date like 15/10/2026" };
  }
  const n = Number(v.replace(/[£,\s]|sq|ft²?|km|m²|sqm/gi, "").replace(/m$/i, ""));
  if (!Number.isFinite(n) || n < 0) return { error: "Enter a number" };
  if (kind === "size") return { value: Math.round(/m²|sq\s*m|sqm|\bm\b|m$/i.test(v) ? n * 10.764 : n) }; // "56 sq m" → ft²
  return { value: kind === "int" ? Math.round(n) : Math.round(n * 100) / 100 };
}
