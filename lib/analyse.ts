import "server-only";
import OpenAI from "openai";
import type { Place, Report, Settings } from "./types";
import { DECOR, PARKING } from "./types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

export type Page = { text: string; image: string | null; images: string[]; pin: [number, number] | null };

export async function fetchListing(url: string): Promise<Page> {
  const empty: Page = { text: "", image: null, images: [], pin: null };
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en-GB" }, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return empty;
    const html = await res.text();
    const image =
      html.match(/property=['"]og:image['"]\s+content=['"]([^'"]+)/i)?.[1] ??
      html.match(/content=['"]([^'"]+)['"]\s+property=['"]og:image/i)?.[1] ??
      null;
    const host = image ? new URL(image).host : null;
    const images = host
      ? [...new Set(html.match(new RegExp(`https://${host.replace(/\./g, "\\.")}/[^"'\\s\\\\]+\\.(?:jpe?g|webp|png)`, "gi")) ?? [])]
          .filter((u) => !/_max_\d+x\d+|thumbnail|logo/i.test(u))
          .slice(0, 16)
      : [];
    // ponytail: Rightmove-specific pin pattern; other sites fall back to geocoding the postcode.
    const pin = html.match(/circleRadiusOnMap[^}]*\},(-?\d+\.\d+),(-?\d+\.\d+)/);
    const text = html
      .replace(/<(script|style|svg|noscript|head)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&#x27;|&#39;/g, "'")
      .replace(/&pound;/g, "£")
      .replace(/\s+/g, " ")
      .slice(0, 40_000);
    return { text, image, images, pin: pin ? [Number(pin[1]), Number(pin[2])] : null };
  } catch {
    return empty;
  }
}

// --- JSON schema (OpenAI strict mode: every key required, nulls for unknowns) ---
const str = { type: "string" };
const nstr = { type: ["string", "null"] };
const nnum = { type: ["number", "null"] };
const num = { type: "number" };
const bool = { type: "boolean" };
const arr = (items: object) => ({ type: "array", items });
const obj = (properties: Record<string, object>) => ({
  type: "object",
  additionalProperties: false,
  properties,
  required: Object.keys(properties),
});
const score = { type: "integer", minimum: 0, maximum: 10 };

const SCHEMA = obj({
  facts: obj({
    title: str,
    address: str,
    postcode: nstr,
    price: nnum,
    size_sqft: nnum,
    bedrooms: nnum,
    bathrooms: nnum,
    receptions: nnum,
    property_type: nstr,
    tenure: nstr,
    parking: { type: ["string", "null"], enum: [...PARKING, null] },
    garden: nstr,
    nearest_station: nstr,
    station_distance_km: nnum,
    decor_state: { type: ["string", "null"], enum: [...DECOR, null] },
    needs_kitchen: bool,
    needs_bathroom: bool,
    council_tax_band: nstr,
    epc_rating: nstr,
    agent: nstr,
    listed_date: { type: ["string", "null"], description: "YYYY-MM-DD" },
  }),
  report: obj({
    summary: { type: "string", description: "2-4 sentence first impression tailored to the buyer" },
    pros: arr(str),
    cons: arr(str),
    verify: { ...arr(str), description: "things the buyer must check in person or with the agent" },
    schools: {
      ...arr(
        obj({
          name: str,
          phase: { type: "string", enum: ["nursery", "primary", "secondary", "all-through", "sixth form", "special"] },
          type: { type: "string", description: "community, academy, faith (which), grammar, independent..." },
          distance_m: nnum,
          rating: { type: "string", description: "latest Ofsted grade or report-card summary" },
          last_inspected: { type: "string", description: "Mon YYYY" },
          history: { ...arr(obj({ year: str, rating: str })), description: "previous Ofsted inspections, newest first" },
          catchment: { type: "string", description: "admission criteria / how far the last place was offered, chance of getting in from this address" },
          notes: str,
        }),
      ),
      description: "the 4-8 most relevant state schools (primary AND secondary) plus nurseries",
    },
    family: obj({ summary: str, childcare: str, play_and_parks: str }),
    places: {
      ...arr(obj({ name: str, kind: { type: "string", description: "park | playground | gp | supermarket | pub | takeaway | leisure | other" }, distance_m: nnum, notes: str })),
      description: "notable places within walking distance, including pubs/bars, late-night venues and anything noisy",
    },
    red_flags: {
      ...arr(obj({ title: str, severity: { type: "string", enum: ["high", "medium", "low"] }, detail: str })),
      description: "deal-breaker or costly risks: non-standard construction, auction/reservation fees, short lease, ground rent, flood, subsidence, Japanese knotweed, cladding, planning/building regs gaps, busy road, railway noise, pubs/nightlife next door, listing contradictions",
    },
    risks: {
      ...arr(obj({ area: str, level: { type: "string", enum: ["low", "medium", "high"] }, assessment: str })),
      description: "risk table: layout, energy efficiency, mortgage availability, future resale, sale method, structural condition, location",
    },
    sale: obj({
      method: { type: "string", description: "private treaty | traditional auction | modern method of auction | new build | shared ownership | retirement" },
      extra_fees: { type: ["number", "null"], description: "GBP fees ON TOP of the price, e.g. auction reservation fee incl. VAT" },
      fee_notes: str,
    }),
    construction: obj({ type: str, standard: bool, mortgage_notes: str }),
    discrepancies: { ...arr(str), description: "places where the listing contradicts itself" },
    action_plan: { ...arr(str), description: "ordered steps before offering or bidding" },
    crime: obj({
      local_rate: nnum,
      national_rate: nnum,
      district_rate: nnum,
      unit: { type: "string", description: "e.g. offences per 1,000 residents per year" },
      assessment: str,
    }),
    demographics: obj({ groups: arr(obj({ label: str, percent: num })), notes: str }),
    transport: arr(obj({ name: str, kind: { type: "string", description: "rail | tube | bus | road | airport" }, distance_km: nnum, notes: str })),
    amenities: arr(str),
    flood_risk: str,
    broadband: str,
    value: obj({
      comparables: arr(obj({ address: str, price: nnum, date: str, notes: str })),
      fair_value_low: nnum,
      fair_value_high: nnum,
      assessment: str,
    }),
    refurb: obj({ items: arr(obj({ item: str, low: num, high: num })), notes: str }),
    questions_for_agent: arr(str),
    scores: obj({ location: score, value: score, condition: score, transport: score, schools: score, safety: score, family: score }),
    verdict: str,
    sources: arr(obj({ title: str, url: str })),
  }),
});

export type Analysis = {
  facts: {
    title: string;
    address: string;
    postcode: string | null;
    price: number | null;
    size_sqft: number | null;
    bedrooms: number | null;
    bathrooms: number | null;
    receptions: number | null;
    property_type: string | null;
    tenure: string | null;
    parking: string | null;
    garden: string | null;
    nearest_station: string | null;
    station_distance_km: number | null;
    decor_state: string | null;
    needs_kitchen: boolean;
    needs_bathroom: boolean;
    council_tax_band: string | null;
    epc_rating: string | null;
    agent: string | null;
    listed_date: string | null;
  };
  report: Report;
};

export async function analyse(url: string, page: Page, extraText: string, s: Settings | null, places: Place[] = []): Promise<Analysis> {
  const buyer = [
    s?.buyer_context && `Buyer: ${s.buyer_context}.`,
    s?.budget_min || s?.budget_max ? `Budget: £${s?.budget_min ?? "?"}–£${s?.budget_max ?? "?"}.` : "",
    s?.home_label && `Current home: ${s.home_label}.`,
    s?.office_label && `Office: ${s.office_label}.`,
    `Stamp duty buyer type: ${s?.buyer_type ?? "standard"}.`,
  ]
    .filter(Boolean)
    .join(" ");

  const input = `You are a sharp, honest UK property buying advisor. Research this listing and the area around it.

Listing URL: ${url}
${buyer}

The buyer has a child, so schools and family life matter most. Use web search to find: every nearby primary and secondary school with its current Ofsted rating, previous inspection history, type (academy/faith/etc) and admissions/catchment (how far places were offered last year); nurseries; parks and playgrounds; crime rates for the immediate neighbourhood vs the wider postcode district vs England & Wales (higher-harm crime per 1,000 residents if available); Census 2021 ethnic/community mix for the small area; nearest rail/tube stations and journey times to central London; flood risk; broadband; recent sold prices on the same street or nearby comparable homes; anything unusual (non-standard construction, leasehold issues, auction, new-build premiums, planning).

Rules:
- Facts come from the listing first; use null when unknown rather than guessing.
- size_sqft: convert from sq m if needed (1 m² = 10.764 sq ft). If only a floorplan total is known, use it.
- decor_state / needs_kitchen / needs_bathroom: judge from description and photo captions; "modern", "refitted", "renovated" means no.
- refurb.items: realistic UK cost ranges in £ for work this house needs (empty if none).
- scores: 0-10 from the buyer's point of view. Be candid in cons, verify and verdict.
- Red flags: be thorough and specific. For auctions / modern method of auction, look up the auctioneer's reservation fee (often up to 5% + VAT = 6%) and put the GBP amount in sale.extra_fees.
- Check construction type (e.g. cross-wall timber, Wimpey No-Fines, Cornish, prefab, steel frame) and whether mainstream lenders accept it.
- Flag pubs, bars, takeaways, busy roads or railway lines right next to the house.
- Include the source URLs you relied on.

${places.length ? `--- PLACES WITHIN 1.5 KM (OpenStreetMap, metres) ---\n${places.filter((p) => p.cat !== "bus").slice(0, 80).map((p) => `${p.cat}: ${p.name} (${p.m} m)`).join("\n")}\n` : ""}
${page.text ? `--- LISTING PAGE TEXT ---\n${page.text}` : "(Listing page could not be fetched directly — open it with web search.)"}
${extraText ? `--- EXTRA NOTES FROM BUYER ---\n${extraText.slice(0, 20_000)}` : ""}`;

  const openai = new OpenAI();
  const res = await openai.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
    tools: [{ type: "web_search", user_location: { type: "approximate", country: "GB" } }],
    reasoning: { effort: "low" },
    input,
    text: { format: { type: "json_schema", name: "property_analysis", strict: true, schema: SCHEMA } },
  });
  return JSON.parse(res.output_text) as Analysis;
}

export const overallScore = (s: Report["scores"]) => {
  const v = Object.values(s).filter((x): x is number => typeof x === "number");
  return Math.round((v.reduce((a, b) => a + b, 0) / (v.length * 10)) * 100);
};
