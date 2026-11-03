import "server-only";
import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Property, Settings } from "./types";

// Service-role key stays on the server; tables have RLS on with no policies, so the anon key can't read them.
export const db = () =>
  createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

export async function getProperties(): Promise<Property[]> {
  await connection(); // always live data, never prerendered
  const { data, error } = await db().from("properties").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as Property[];
}

export async function getProperty(id: string): Promise<Property | null> {
  await connection(); // always live data, never prerendered
  const { data } = await db().from("properties").select("*").eq("id", id).maybeSingle();
  return data as Property | null;
}

export async function getSettings(): Promise<Settings | null> {
  await connection(); // always live data, never prerendered
  const { data } = await db().from("settings").select("*").eq("id", 1).maybeSingle();
  return data as Settings | null;
}

/** Turn Supabase errors into a setup instruction a human can act on. */
export function dbErrorHelp(e: unknown): string {
  const msg = typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
  const code = typeof e === "object" && e && "code" in e ? String((e as { code: unknown }).code) : "";
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    return "Supabase isn't connected: add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel → Settings → Environment Variables, then redeploy.";
  if (code === "42P01" || code === "PGRST205" || /does not exist|could not find the table/i.test(msg))
    return "The database tables don't exist yet. In Supabase → SQL Editor, paste and run supabase/schema.sql.";
  if (code === "PGRST204" || code === "42703" || /column/i.test(msg))
    return `Your database is missing new columns (${msg}). In Supabase → SQL Editor, run supabase/schema.sql again. It's safe to re-run.`;
  if (code === "42501" || /permission denied/i.test(msg))
    return "Permission denied. Make sure SUPABASE_SERVICE_ROLE_KEY is the secret / service_role key (not the publishable or anon key), then run supabase/schema.sql again.";
  if (/invalid api key|jwt/i.test(msg)) return "Supabase rejected the key. Copy the secret (service_role) key into SUPABASE_SERVICE_ROLE_KEY again and redeploy.";
  return msg;
}
