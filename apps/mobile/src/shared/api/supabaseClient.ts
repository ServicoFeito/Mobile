import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@servico-feito/db-types";
import { secureStoreAdapter } from "./secureStoreAdapter";

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export function guardaEnv(url = URL, anon = ANON): void {
  if (!url) throw new Error("Falta EXPO_PUBLIC_SUPABASE_URL no .env do app");
  if (!anon) throw new Error("Falta EXPO_PUBLIC_SUPABASE_ANON_KEY no .env do app");
}

export const assertEnvSupabase = (): void => guardaEnv();

export const supabase: SupabaseClient<Database> = createClient<Database>(
  URL ?? "http://invalid.local",
  ANON ?? "invalid",
  {
    auth: {
      storage: secureStoreAdapter,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
);
