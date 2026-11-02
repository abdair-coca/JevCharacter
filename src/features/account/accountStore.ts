import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { connectAccountMemory, disconnectAccountMemory } from "../../creature/memory/memoryStore";
import { forgetAuthLeftovers, hasSavedAuth, loadSupabase, supabaseConfigured } from "../../lib/supabaseClient";
import { createMemoryRemote } from "./memoryRemote";

/** `unavailable` when the build has no Supabase: there is no login and notes stay in the browser. */
export type AccountStatus = "unavailable" | "signedOut" | "connecting" | "signedIn";
type Account = { status: AccountStatus; email: string | null; failed: boolean };

export const accountStore = createStore<Account>(() => ({ status: supabaseConfigured() ? "signedOut" : "unavailable", email: null, failed: false }));

// Google sends these back when the visitor cancels or the sign-in fails.
const RETURN_ERRORS = ["error", "error_code", "error_description"];
let userId: string | null = null;
let listening = false;
// Set while the page leaves for Google, so the first session event does not show the button again meanwhile.
let leaving = false;

function apply(session: Session | null, client: SupabaseClient) {
  const user = session?.user ?? null;
  if (!user && leaving) return;
  accountStore.setState(user ? { status: "signedIn", email: user.email ?? null, failed: false } : { status: "signedOut", email: null });
  if ((user?.id ?? null) === userId) return;
  userId = user?.id ?? null;
  if (user) connectAccountMemory(createMemoryRemote(client, user.id));
  else disconnectAccountMemory();
}

async function connect(): Promise<SupabaseClient> {
  const client = await loadSupabase();
  if (!listening) {
    listening = true;
    // supabase-js must not be called from inside this callback, so the switch waits a tick.
    client.auth.onAuthStateChange((_event, session) => { setTimeout(() => apply(session, client), 0); });
  }
  return client;
}

function cleanReturnUrl() {
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.slice(1));
  for (const name of RETURN_ERRORS) {
    url.searchParams.delete(name);
    hash.delete(name);
  }
  url.hash = hash.toString();
  window.history.replaceState(window.history.state, "", url);
}

/** At startup, only a saved session or a sign-in coming back from Google loads Supabase. */
export function startAccount() {
  if (!supabaseConfigured() || !hasSavedAuth()) return;
  accountStore.setState({ status: "connecting" });
  void connect().then(async client => {
    const { error } = await client.auth.initialize();
    if (error) {
      accountStore.setState({ failed: true });
      cleanReturnUrl();
    }
    const { data } = await client.auth.getSession();
    if (!data.session) forgetAuthLeftovers();
  }).catch(() => accountStore.setState({ status: "signedOut", failed: true }));
}

/** Leaves for Google's sign-in; it comes back to the same view. */
export async function signIn() {
  accountStore.setState({ status: "connecting", failed: false });
  try {
    const client = await connect();
    const { error } = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}${window.location.pathname}` } });
    if (error) throw error;
    leaving = true;
    accountStore.setState({ status: "connecting" });
  } catch {
    accountStore.setState({ status: "signedOut", failed: true });
  }
}

// Back from Google without signing in, the browser may restore this page exactly as it was left.
if (typeof window !== "undefined") {
  window.addEventListener("pageshow", event => {
    if (!event.persisted || !leaving) return;
    leaving = false;
    accountStore.setState({ status: userId ? "signedIn" : "signedOut" });
  });
}

/** Signs out of this browser only: the account's notes leave it, other devices stay signed in. */
export async function signOut() {
  const client = await connect();
  await client.auth.signOut({ scope: "local" });
}

export function useAccount(): Account {
  return useStore(accountStore);
}
