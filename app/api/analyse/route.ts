import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { analyse, fetchListing, overallScore } from "@/lib/analyse";
import { db, dbErrorHelp, getSettings } from "@/lib/db";
import { geocode } from "@/lib/geo";
import { nearby } from "@/lib/nearby";

export const maxDuration = 300; // web-search research can take 1-3 minutes

export async function POST(req: Request) {
  const { url, text = "", id } = (await req.json()) as { url?: string; text?: string; id?: string };
  if (!url || !/^https?:\/\//i.test(url)) return NextResponse.json({ error: "Paste a full listing URL (https://…)" }, { status: 400 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "OPENAI_API_KEY is not set" }, { status: 500 });

  try {
    const [page, settings] = await Promise.all([fetchListing(url), getSettings()]);
    // With an exact pin (Rightmove) we look up real nearby places first and hand them to the AI.
    const early = page.pin ? await nearby(page.pin) : null;
    const { facts, report } = await analyse(url, page, text, settings, early?.places);
    const pin = page.pin ?? (await geocode(facts.postcode)) ?? (await geocode(facts.address));
    const places = early ?? (pin ? await nearby(pin) : null);
    // Sites like Zoopla block page reads, so keep photos already saved (e.g. pasted by hand).
    const { data: prev } = await db().from("properties").select("image_url, ai").eq(id ? "id" : "url", id ?? url).maybeSingle();
    const images: string[] = page.images.length ? page.images : (prev?.ai?.images ?? []);

    const row = {
      ...facts,
      url,
      price: facts.price && Math.round(facts.price),
      size_sqft: facts.size_sqft && Math.round(facts.size_sqft),
      listed_date: /^\d{4}-\d{2}-\d{2}$/.test(facts.listed_date ?? "") ? facts.listed_date : null,
      lat: pin?.[0] ?? null,
      lng: pin?.[1] ?? null,
      image_url: page.image ?? images[0] ?? prev?.image_url ?? null,
      ai: { ...report, images, analysed_at: new Date().toISOString() },
      ai_score: overallScore(report.scores),
      nearby: places,
    };

    // Re-analysing keeps your own status, rating and notes (they aren't in `row`).
    const q = id
      ? db().from("properties").update(row).eq("id", id).select("id").single()
      : db().from("properties").upsert(row, { onConflict: "url" }).select("id").single();
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: dbErrorHelp(error) }, { status: 500 });
    revalidatePath("/");
    return NextResponse.json({ id: data.id });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : dbErrorHelp(e);
    return NextResponse.json({ error: /api key|401|incorrect.*key/i.test(msg) ? "OpenAI rejected the API key. Check OPENAI_API_KEY in Vercel and redeploy." : /quota|billing|429/i.test(msg) ? "OpenAI says you're out of credit or rate-limited. Add credit at platform.openai.com → Billing." : msg }, { status: 500 });
  }
}
