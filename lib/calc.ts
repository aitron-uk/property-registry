import type { Property, Settings } from "./types";

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
