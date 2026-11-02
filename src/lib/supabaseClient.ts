import type { SupabaseClient } from "@supabase/supabase-js";

// supabase-js keeps the session, and the verifier of a Google sign-in on its way, under keys starting with this one.
const AUTH_STORAGE_KEY = "jevling.auth";
const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

let client: Promise<SupabaseClient> | null = null;

/** Login exists only when the build has the project's URL and publishable key. */
export function supabaseConfigured(): boolean {
  return Boolean(url && publishableKey);
}

function authKeys(): string[] {
  try {
    return Object.keys(window.localStorage).filter(key => key.startsWith(AUTH_STORAGE_KEY));
  } catch {
    return [];
  }
}

/** A saved session, or a Google sign-in coming back, needs the client at startup. */
export function hasSavedAuth(): boolean {
  return authKeys().length > 0;
}

/** Drops what a sign-in left behind when it never finished, so the next visits skip loading the client. */
export function forgetAuthLeftovers() {
  for (const key of authKeys()) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Without storage there is nothing left behind.
    }
  }
}

/** supabase-js stays out of the main bundle: it loads on the first sign-in or when a session is saved. */
export function loadSupabase(): Promise<SupabaseClient> {
  if (!url || !publishableKey) return Promise.reject(new Error("Supabase is not configured"));
  client ??= import("@supabase/supabase-js")
    .then(({ createClient }) => createClient(url, publishableKey, {
      auth: { flowType: "pkce", storageKey: AUTH_STORAGE_KEY, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    }))
    .catch((error: unknown) => {
      // A failed download (offline) can be retried on the next sign-in.
      client = null;
      throw error;
    });
  return client;
}
