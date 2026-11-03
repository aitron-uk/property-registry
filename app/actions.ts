"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, dbErrorHelp, getProperty } from "@/lib/db";
import { geocode } from "@/lib/geo";
import { nearby } from "@/lib/nearby";
import { authToken, isAuthed } from "@/lib/auth";
import { FACT_FIELDS, parseFact, type FactField } from "@/lib/calc";

// Server actions can be POSTed to any URL (even /login), so each one checks the cookie itself.
async function guard() {
  if (!(await isAuthed((await cookies()).get("pr_auth")?.value))) throw new Error("Not signed in");
}

const n = (v: FormDataEntryValue | null) => (v === null || v === "" ? null : Number(v));
const s = (v: FormDataEntryValue | null) => (v === null || v === "" ? null : String(v));

// Saves only the fields the form actually contains, so it never blanks fields edited elsewhere.
const FORM_FIELDS = {
  title: s,
  address: s,
  postcode: s,
  price: n,
  decor_state: s,
  status: s,
  my_rating: n,
  notes: s,
} as const;

export async function updateProperty(id: string, form: FormData) {
  await guard();
  const row: Record<string, unknown> = {};
  for (const [k, read] of Object.entries(FORM_FIELDS)) if (form.has(k)) row[k] = read(form.get(k));
  if (row.status == null && form.has("status")) row.status = "interested";
  // Checkboxes are absent from FormData when unticked, so read them whenever the form has them.
  if (form.has("has_checkboxes")) {
    row.needs_kitchen = form.get("needs_kitchen") === "on";
    row.needs_bathroom = form.get("needs_bathroom") === "on";
  }
  const cur = await getProperty(id);
  const pc = row.postcode as string | null | undefined;
  const moved = pc && pc !== cur?.postcode ? await geocode(pc) : null;
  const { error } = await db()
    .from("properties")
    .update(moved ? { ...row, lat: moved[0], lng: moved[1], nearby: await nearby(moved) } : row)
    .eq("id", id);
  if (error) throw new Error(dbErrorHelp(error));
  revalidatePath("/");
  revalidatePath(`/p/${id}`);
}

/** Edit one fact tile. Returns an error message, or null when saved. */
export async function updateField(id: string, field: string, raw: string): Promise<string | null> {
  await guard();
  if (!(field in FACT_FIELDS)) return "This field can't be edited";
  const parsed = parseFact(field as FactField, raw);
  if ("error" in parsed) return parsed.error;
  let patch: Record<string, unknown> = { [field]: parsed.value };
  if (FACT_FIELDS[field as FactField] === "ai") {
    const cur = await getProperty(id);
    patch = { ai: { ...(cur?.ai ?? {}), [field]: parsed.value ?? "" } };
  }
  const { error } = await db().from("properties").update(patch).eq("id", id);
  if (error) return dbErrorHelp(error);
  revalidatePath("/");
  revalidatePath(`/p/${id}`);
  return null;
}

export async function quickUpdate(id: string, patch: { status?: string; my_rating?: number | null }) {
  await guard();
  await db().from("properties").update(patch).eq("id", id);
  revalidatePath("/");
}

export async function refreshNearby(id: string) {
  await guard();
  const p = await getProperty(id);
  if (!p?.lat || !p.lng) return "No location for this property";
  const n = await nearby([p.lat, p.lng]);
  if (!n) return "OpenStreetMap is busy, try again in a minute";
  await db().from("properties").update({ nearby: n }).eq("id", id);
  revalidatePath(`/p/${id}`);
  revalidatePath("/");
  return null;
}

export async function deleteProperty(id: string) {
  await guard();
  await db().from("properties").delete().eq("id", id);
  revalidatePath("/");
  redirect("/");
}

export async function saveSettings(form: FormData) {
  await guard();
  const home = s(form.get("home_label"));
  const office = s(form.get("office_label"));
  const office2 = s(form.get("office2_label"));
  const [h, o, o2] = await Promise.all([geocode(home), geocode(office), geocode(office2)]);
  const { error } = await db()
    .from("settings")
    .upsert({
      id: 1,
      home_label: home,
      home_lat: h?.[0] ?? null,
      home_lng: h?.[1] ?? null,
      office_label: office,
      office_lat: o?.[0] ?? null,
      office_lng: o?.[1] ?? null,
      office2_label: office2,
      office2_lat: o2?.[0] ?? null,
      office2_lng: o2?.[1] ?? null,
      budget_min: n(form.get("budget_min")),
      budget_max: n(form.get("budget_max")),
      buyer_type: s(form.get("buyer_type")) ?? "standard",
      buyer_context: s(form.get("buyer_context")),
    });
  if (error) redirect(`/settings?error=${encodeURIComponent(dbErrorHelp(error))}`);
  revalidatePath("/", "layout");
  // 1 = located (or left empty), 0 = couldn't find that address
  const ok = (label: string | null, ll: unknown) => (!label || ll ? 1 : 0);
  redirect(`/settings?saved=${ok(home, h)}${ok(office, o)}${ok(office2, o2)}`);
}

export async function login(_: unknown, form: FormData) {
  if (form.get("password") !== process.env.APP_PASSWORD) return "Wrong password";
  (await cookies()).set("pr_auth", await authToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 180,
  });
  redirect("/");
}
