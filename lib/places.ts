import type { Nearby, Place, Property, Report } from "./types";

export const CATS: Record<Place["cat"], { emoji: string; label: string; group: "Kids" | "Daily life" | "Getting around" | "Nightlife & noise" }> = {
  school: { emoji: "🎓", label: "Schools", group: "Kids" },
  nursery: { emoji: "🧸", label: "Nurseries", group: "Kids" },
  playground: { emoji: "🛝", label: "Playgrounds", group: "Kids" },
  park: { emoji: "🌳", label: "Parks", group: "Kids" },
  library: { emoji: "📚", label: "Libraries", group: "Kids" },
  leisure: { emoji: "🏊", label: "Sports & pools", group: "Kids" },
  gp: { emoji: "🩺", label: "GPs & clinics", group: "Daily life" },
  pharmacy: { emoji: "💊", label: "Pharmacies", group: "Daily life" },
  dentist: { emoji: "🦷", label: "Dentists", group: "Daily life" },
  supermarket: { emoji: "🛒", label: "Shops", group: "Daily life" },
  station: { emoji: "🚆", label: "Stations", group: "Getting around" },
  bus: { emoji: "🚌", label: "Bus stops", group: "Getting around" },
  pub: { emoji: "🍺", label: "Pubs & bars", group: "Nightlife & noise" },
  takeaway: { emoji: "🍟", label: "Takeaways", group: "Nightlife & noise" },
  betting: { emoji: "🎰", label: "Betting shops", group: "Nightlife & noise" },
};

export const within = (n: Nearby | null, cat: Place["cat"], m: number) => n?.places.filter((p) => p.cat === cat && p.m <= m).length ?? 0;
export const nearest = (n: Nearby | null, cat: Place["cat"]) => n?.places.find((p) => p.cat === cat) ?? null;

const OFSTED_RANK: [RegExp, number, string][] = [
  [/outstanding/i, 4, "Outstanding"],
  [/good/i, 3, "Good"],
  [/requires|improvement/i, 2, "Requires improvement"],
  [/inadequate|special measures/i, 1, "Inadequate"],
];
export const ofstedRank = (r: string) => OFSTED_RANK.find(([re]) => re.test(r))?.[1] ?? 0;

/** Best-rated school within `m` metres from the AI report. */
export function bestSchool(r: Report | null, m = 1500) {
  const s = (r?.schools ?? []).filter((x) => x.phase !== "nursery" && (x.distance_m ?? Infinity) <= m);
  return s.sort((a, b) => ofstedRank(b.rating) - ofstedRank(a.rating) || (a.distance_m ?? 0) - (b.distance_m ?? 0))[0] ?? null;
}

export const ofstedLabel = (r: string) => OFSTED_RANK.find(([re]) => re.test(r))?.[2] ?? r;

export const alertCount = (p: Property) => p.ai?.red_flags?.filter((f) => f.severity !== "low").length ?? 0;

/** Pubs/bars/takeaways within 150 m: likely noise. */
export const noisyNeighbours = (n: Nearby | null) => n?.places.filter((p) => (p.cat === "pub" || p.cat === "takeaway") && p.m <= 150) ?? [];
