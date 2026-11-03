import "server-only";

const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
const UA = { "User-Agent": "property-registry/1.0 (personal house hunt)" };

// Free geocoding: postcodes.io for UK postcodes, OpenStreetMap Nominatim for anything else.
export async function geocode(query: string | null | undefined): Promise<[number, number] | null> {
  const q = query?.trim();
  if (!q) return null;
  try {
    if (UK_POSTCODE.test(q)) {
      const r = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(q)}`).then((r) => r.json());
      if (r.result) return [r.result.latitude, r.result.longitude];
    }
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=gb&q=${encodeURIComponent(q)}`,
      { headers: UA },
    ).then((r) => r.json());
    if (r[0]) return [Number(r[0].lat), Number(r[0].lon)];
    const outcode = q.match(/\b([A-Z]{1,2}\d[A-Z\d]?)\b/i)?.[1];
    if (outcode) {
      const o = await fetch(`https://api.postcodes.io/outcodes/${outcode}`).then((r) => r.json());
      if (o.result) return [o.result.latitude, o.result.longitude];
    }
  } catch {}
  return null;
}
