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
