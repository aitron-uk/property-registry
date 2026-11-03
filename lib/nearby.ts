import "server-only";
import { haversineKm } from "./calc";
import type { Nearby, Place } from "./types";

// OpenStreetMap places via the free Overpass API. Mirrors tried in order; any failure → null.
const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const UA = "property-registry/1.0 (+https://github.com/aitron-uk/property-registry)";

const CATEGORY: [Place["cat"], (t: Record<string, string>) => boolean][] = [
  ["school", (t) => t.amenity === "school"],
  ["nursery", (t) => t.amenity === "kindergarten" || t.amenity === "childcare"],
  ["playground", (t) => t.leisure === "playground"],
  ["park", (t) => t.leisure === "park"],
  ["gp", (t) => t.amenity === "doctors" || t.amenity === "clinic"],
  ["pharmacy", (t) => t.amenity === "pharmacy"],
  ["dentist", (t) => t.amenity === "dentist"],
  ["library", (t) => t.amenity === "library"],
  ["leisure", (t) => t.leisure === "sports_centre" || t.leisure === "swimming_pool"],
  ["supermarket", (t) => t.shop === "supermarket" || t.shop === "convenience"],
  ["station", (t) => t.railway === "station"],
  ["bus", (t) => t.highway === "bus_stop"],
  ["pub", (t) => t.amenity === "pub" || t.amenity === "bar" || t.amenity === "nightclub"],
  ["takeaway", (t) => t.amenity === "fast_food"],
  ["betting", (t) => t.shop === "bookmaker" || t.amenity === "gambling"],
];

export async function nearby([lat, lng]: [number, number]): Promise<Nearby | null> {
  const a = `around:1500,${lat},${lng}`;
  const q = `[out:json][timeout:25];(
    nwr(${a})["amenity"~"^(school|kindergarten|childcare|doctors|clinic|pharmacy|dentist|library|pub|bar|nightclub|fast_food|gambling)$"];
    nwr(${a})["leisure"~"^(playground|park|sports_centre|swimming_pool)$"];
    nwr(${a})["shop"~"^(supermarket|convenience|bookmaker)$"];
    nwr(around:3000,${lat},${lng})["railway"="station"];
    node(around:500,${lat},${lng})["highway"="bus_stop"];
  );out center tags;`;

  for (const url of MIRRORS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "User-Agent": UA },
        body: new URLSearchParams({ data: q }),
        signal: AbortSignal.timeout(25_000),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { elements: { lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[] };
      return toNearby(json.elements, [lat, lng]);
    } catch {}
  }
  return null;
}

export function toNearby(elements: { lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[], here: [number, number]): Nearby {
  const seen = new Set<string>();
  const places: Place[] = [];
  for (const e of elements) {
    const t = e.tags ?? {};
    const cat = CATEGORY.find(([, f]) => f(t))?.[0];
    const plat = e.lat ?? e.center?.lat;
    const plng = e.lon ?? e.center?.lon;
    if (!cat || plat == null || plng == null) continue;
    const name = t.name ?? (cat === "bus" ? "Bus stop" : cat === "playground" ? "Playground" : "");
    if (!name && cat !== "park") continue;
    const key = `${cat}:${name}`;
    if (name && seen.has(key) && cat !== "bus") continue; // OSM often maps a school as building + grounds
    seen.add(key);
    places.push({ cat, name: name || "Park", lat: plat, lng: plng, m: Math.round(haversineKm(here, [plat, plng]) * 1000) });
  }
  places.sort((a, b) => a.m - b.m);
  return { places: places.slice(0, 250), fetched_at: new Date().toISOString() };
}
